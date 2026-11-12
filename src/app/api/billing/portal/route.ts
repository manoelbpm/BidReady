import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getPaddleApiBaseUrl,
  isPaddleLive,
  validatePaddleConfig,
} from '@/lib/billing/paddle-config';

/**
 * POST /api/billing/portal
 * Generates an authenticated Paddle Customer Portal Session URL
 * allowing self-service billing management (updating card, viewing invoices, canceling).
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const paddleApiKey = process.env.PADDLE_API_KEY || '';

    if (isPaddleLive()) {
      const validation = validatePaddleConfig();
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: `Paddle Live configuration incomplete: ${validation.errors.join('; ')}`,
          },
          { status: 500 }
        );
      }
    } else if (!paddleApiKey) {
      return NextResponse.json(
        { success: false, error: 'Paddle API key is not configured.' },
        { status: 500 }
      );
    }

    // 1. Authenticate user from Bearer Token or Next.js Cookies
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    let authenticatedUserId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error: userErr } = await client.auth.getUser();
        if (!userErr && user?.id) {
          authenticatedUserId = user.id;
        }
      }
    }

    if (!authenticatedUserId) {
      try {
        const serverClient = await createServerClient();
        const { data: { user } } = await serverClient.auth.getUser();
        if (user?.id) authenticatedUserId = user.id;
      } catch {
        // Non-cookie context
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await req.json().catch(() => ({}));
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: organizationId is required.' },
        { status: 400 }
      );
    }

    // 3. Verify Organization Membership (Owner or Admin role required)
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    if (memberErr || !member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Owner or admin billing privileges required.' },
        { status: 403 }
      );
    }

    // 4. Retrieve Subscription & Customer ID
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('saas_subscriptions')
      .select('provider_customer_id, provider_subscription_id, plan, status')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (subErr || !sub || !sub.provider_customer_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active payment customer found for this organization. A subscription must be created first.',
        },
        { status: 404 }
      );
    }

    // 5. Request Customer Portal Session from Paddle API
    const paddleBaseUrl = getPaddleApiBaseUrl();

    const portalRes = await fetch(
      `${paddleBaseUrl}/customers/${sub.provider_customer_id}/portal-sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paddleApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_ids: sub.provider_subscription_id ? [sub.provider_subscription_id] : [],
        }),
      }
    );

    if (!portalRes.ok) {
      const errText = await portalRes.text();
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create Paddle portal session: ${portalRes.statusText}`,
          details: errText,
        },
        { status: 502 }
      );
    }

    const portalData = await portalRes.json();
    const portalUrl =
      portalData?.data?.urls?.general?.overview ||
      portalData?.data?.urls?.subscriptions?.[0]?.cancel_subscription ||
      null;

    return NextResponse.json({
      success: true,
      portalUrl,
      sessionId: portalData?.data?.id,
      expiresAt: portalData?.data?.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json(
      { success: false, error: `Customer Portal Error: ${message}` },
      { status: 500 }
    );
  }
}
