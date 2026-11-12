import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PlanId, SAAS_PLANS, SubscriptionStatus } from '@/types/billing';
import { VALID_SUBSCRIPTION_STATUSES } from '@/lib/billing/paddle-sandbox';

const VALID_PLANS: readonly PlanId[] = ['free', 'starter', 'pro', 'business'];

function safeCompareKeys(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const bufProvided = Buffer.from(provided, 'utf-8');
  const bufExpected = Buffer.from(expected, 'utf-8');
  if (bufProvided.length !== bufExpected.length) return false;
  return crypto.timingSafeEqual(bufProvided, bufExpected);
}


/**
 * GET /api/billing/subscription?organizationId=...
 * Legitimate tenant administrative read access: allows authenticated owners/admins to view subscription status.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const organizationId = url.searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId query parameter' }, { status: 400 });
  }

  // 1. Verify User Authentication
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  let authenticatedUserId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
    return NextResponse.json({ error: 'Unauthorized: authentication required' }, { status: 401 });
  }

  // 2. Tenant Membership Verification
  const { data: member, error: memberErr } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', authenticatedUserId)
    .maybeSingle();

  if (memberErr || !member) {
    return NextResponse.json({ error: 'Forbidden: user is not a member of this organization' }, { status: 403 });
  }

  // 3. Fetch Subscription Details
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('saas_subscriptions')
    .select('id, organization_id, plan, status, monthly_analyses_limit, analyses_used_in_period, current_period_start, current_period_end, cancel_at_period_end')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (subErr) {
    return NextResponse.json({ error: 'Failed to retrieve subscription' }, { status: 500 });
  }

  return NextResponse.json({ subscription: sub }, { status: 200 });
}

/**
 * POST /api/billing/subscription
 * Commercial Subscription Mutation Handler.
 * STRICT SECURITY POLICY (M4.14.4.12):
 * - Tenant owners/admins CANNOT self-grant commercial plans, activate billing status, or alter provider bindings.
 * - Commercial mutations are strictly reserved for:
 *     1) Cryptographically verified Paddle webhooks, OR
 *     2) Platform Administrators with valid platform service authorization (`x-platform-admin-key`).
 */
export async function POST(req: NextRequest) {
  // 1. Maintenance mode check
  if (process.env.BILLING_MAINTENANCE_MODE === 'true') {
    return NextResponse.json(
      { error: 'Billing administrative updates are disabled during maintenance' },
      { status: 503, headers: { 'Retry-After': '60' } }
    );
  }

  // 2. Identify Platform-Level Authorization vs Tenant User Authorization
  // Exclusively requires PLATFORM_ADMIN_SECRET.
  // SUPABASE_SERVICE_ROLE_KEY is strictly NOT accepted as fallback for commercial mutations.
  const platformAdminKey = req.headers.get('x-platform-admin-key') || req.headers.get('x-platform-admin-secret');
  const configuredPlatformSecret = process.env.PLATFORM_ADMIN_SECRET;

  const isPlatformAdmin = safeCompareKeys(platformAdminKey, configuredPlatformSecret);



  let authenticatedUserId: string | null = null;

  if (!isPlatformAdmin) {
    // Authenticate Supabase User
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

    // Rejection of unauthenticated callers: HTTP 401
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: authentication required' },
        { status: 401 }
      );
    }
  }

  // 3. Body extraction and structure validation
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const {
    organizationId,
    plan,
    status,
    providerSubscriptionId,
    providerCustomerId,
    cancelAtPeriodEnd,
    monthlyLimit,
    gracePeriodEndsAt,
  } = body;

  if (!organizationId || typeof organizationId !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid required field: organizationId' },
      { status: 400 }
    );
  }

  if (!plan || !VALID_PLANS.includes(plan as PlanId)) {
    return NextResponse.json(
      { error: `Invalid plan "${plan}". Must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 }
    );
  }

  if (!status || !VALID_SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)) {
    return NextResponse.json(
      { error: `Invalid status "${status}". Must be one of: ${VALID_SUBSCRIPTION_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  // 4. Server-Side Validation of Analysis Limit (Strict Official Catalog)
  const officialPlanDef = SAAS_PLANS[plan as PlanId];
  const catalogLimit = officialPlanDef.monthlyAnalysesLimit;

  if (monthlyLimit !== undefined && monthlyLimit !== null && monthlyLimit !== catalogLimit) {
    return NextResponse.json(
      {
        error: `Client manipulation rejected: monthlyLimit ${monthlyLimit} does not match official catalog limit of ${catalogLimit} for plan "${plan}".`,
      },
      { status: 400 }
    );
  }

  // 5. Tenant Role and Commercial Mutation Access Control
  if (!isPlatformAdmin) {
    // The caller is a tenant user (authenticatedUserId)
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    if (memberErr || !member) {
      // Caller is not a member of this tenant: HTTP 403
      return NextResponse.json(
        { error: 'Forbidden: user is not a member of this organization' },
        { status: 403 }
      );
    }

    if (member.role !== 'owner' && member.role !== 'admin') {
      // Caller belongs to tenant but lacks admin role: HTTP 403
      return NextResponse.json(
        { error: 'Forbidden: administrative privilege required (owner or admin only)' },
        { status: 403 }
      );
    }

    // STRICT PROHIBITION: Tenant owners/admins cannot self-grant commercial plans, activate status, or alter provider bindings!
    if (plan !== 'free' || status === 'active' || providerSubscriptionId) {
      return NextResponse.json(
        {
          error: 'Forbidden: Tenant administrators cannot self-grant commercial subscription plans, activate billing status, or bind payment provider identifiers. Commercial tier changes must be processed via Paddle checkout.',
        },
        { status: 403 }
      );
    }
  }

  // 6. Execution of Privileged Procedure via Admin Client (Authorized Platform Admin Only)
  const { data, error } = await supabaseAdmin.rpc('apply_paddle_subscription_update', {
    p_organization_id: organizationId,
    p_plan: plan,
    p_status: status,
    p_provider_subscription_id: providerSubscriptionId ? String(providerSubscriptionId).trim() : null,
    p_provider_customer_id: providerCustomerId ? String(providerCustomerId).trim() : null,
    p_cancel_at_period_end: Boolean(cancelAtPeriodEnd),
    p_monthly_analyses_limit: catalogLimit,
    p_grace_period_ends_at: gracePeriodEndsAt || null,
  });

  if (error) {
    const errorMsg = error.message || 'Database error applying subscription update';
    if (errorMsg.includes('CROSS-TENANT COLLISION') || errorMsg.includes('already assigned')) {
      return NextResponse.json({ error: errorMsg }, { status: 409 });
    }
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  return NextResponse.json({ success: true, result: data }, { status: 200 });
}
