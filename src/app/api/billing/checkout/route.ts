import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getAdminClient, isServiceRoleConfigured } from '@/lib/supabase/admin';
import { SAAS_PLANS, PlanId } from '@/types/billing';
import { resolvePaddlePriceId, getPaddleEnvironment } from '@/lib/billing/paddle-config';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const authHeader = request.headers.get('authorization');

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase configuration missing.' },
        { status: 500 }
      );
    }

    // 1. Authenticate user from Bearer Token or Next.js Cookies
    let authenticatedUser: { id: string; email?: string } | null = null;
    let authClient = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: userError } = await client.auth.getUser(token);
      if (!userError && user) {
        authenticatedUser = { id: user.id, email: user.email };
        authClient = client;
      }
    } else {
      try {
        const serverClient = await createServerClient();
        const { data: { user } } = await serverClient.auth.getUser();
        if (user) {
          authenticatedUser = { id: user.id, email: user.email };
          authClient = serverClient;
        }
      } catch {
        // Not in cookie browser context
      }
    }

    if (!authenticatedUser || !authClient) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to initiate checkout.' },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json().catch(() => ({}));
    const { planId, organizationId } = body;

    if (!planId || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: Both planId and organizationId are required.' },
        { status: 400 }
      );
    }

    const validPlan = SAAS_PLANS[planId as PlanId];
    if (!validPlan || planId === 'free') {
      return NextResponse.json(
        { success: false, error: `Invalid planId: '${planId}'.` },
        { status: 400 }
      );
    }

    // 3. Verify Organization Membership & Billing Privileges
    // Query organization_members to ensure user belongs to the requested organization and has owner/admin role
    const { data: member, error: memberError } = await authClient
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', authenticatedUser.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: User is not an authorized member of organization '${organizationId}'. Cross-tenant checkout blocked.`,
        },
        { status: 403 }
      );
    }

    const allowedRoles = ['owner', 'admin'];
    if (!allowedRoles.includes(member.role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: User role '${member.role}' lacks billing privileges for organization '${organizationId}'. Only owners and admins may initiate checkout.`,
        },
        { status: 403 }
      );
    }

    // 4. Server-Authoritative Price ID Resolution
    let authoritativePriceId = '';
    try {
      authoritativePriceId = resolvePaddlePriceId(planId as PlanId);
    } catch (configErr) {
      const msg = configErr instanceof Error ? configErr.message : 'Paddle configuration error';
      return NextResponse.json(
        { success: false, error: msg },
        { status: 500 }
      );
    }

    // 5. Generate and Persist Server-Side Checkout Intent via Privileged RPC
    const serverRpcClient = isServiceRoleConfigured()
      ? getAdminClient()
      : createSupabaseClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

    const { data: intentResult, error: intentError } = await serverRpcClient.rpc(
      'create_checkout_intent',
      {
        p_organization_id: organizationId,
        p_user_id: authenticatedUser.id,
        p_plan_id: planId,
        p_price_id: authoritativePriceId,
        p_expires_in_seconds: 3600,
      }
    );

    if (intentError || !intentResult || !intentResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Checkout Intent Error: ${intentError?.message || intentResult?.error || 'Failed to register intent'}`,
        },
        { status: 500 }
      );
    }

    const intentToken = intentResult.intent_token;

    // 6. Construct Server-Authorized Checkout Context
    const authorizedCheckout = {
      organizationId,
      planId,
      priceId: authoritativePriceId,
      userEmail: authenticatedUser.email || 'billing-sandbox@bidready.ai',
      customData: {
        organization_id: organizationId,
        plan_id: planId,
        intent_id: intentToken,
        authorized_by_user_id: authenticatedUser.id,
        authorized_at: new Date().toISOString(),
      },
    };

    return NextResponse.json({
      success: true,
      intentToken,
      authorizedCheckout,
      mode: getPaddleEnvironment(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json(
      { success: false, error: `Checkout Authorization Error: ${message}` },
      { status: 500 }
    );
  }
}
