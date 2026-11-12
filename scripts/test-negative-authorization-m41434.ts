import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
function getEnv(key: string): string {
  const line = envContent.split('\n').find(l => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const PADDLE_WEBHOOK_SECRET = getEnv('PADDLE_WEBHOOK_SECRET');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORGS = {
  starter: {
    id: 'e2e00000-0000-4000-a000-000000000010',
    subId: 'sub_01m73xm9cymfwkbawkcvb19br7',
    plan: 'starter',
    quota: 10,
  },
  pro: {
    id: 'e2e00000-0000-4000-a000-000000000020',
    subId: 'sub_01m73xn2cgj73bp9tdap2h45rs',
    plan: 'pro',
    quota: 40,
  },
  business: {
    id: 'e2e00000-0000-4000-a000-000000000030',
    subId: 'sub_01m73xnsx1j1fqw5tpyccdqh57',
    plan: 'business',
    quota: 120,
  },
  commercial: {
    id: 'b22937b6-51e5-48a0-a75d-7b3405427298',
  },
  competitor: {
    id: '7a9537da-ff33-4f55-a93a-f86813234f34',
  },
};

const SHARED_CUSTOMER_ID = 'ctm_01m73w7d3pc1sna6v8a9fy1vqx';

async function fetchOrgState(orgId: string) {
  const res = await fetch(`http://localhost:3000/api/billing/subscription?orgId=${orgId}`);
  const json = await res.json();
  const sub = json.subscription;
  return {
    organization_id: orgId,
    plan: sub?.planId,
    status: sub?.status,
    monthly_analyses_limit: sub?.monthlyAnalysesLimit,
    provider_subscription_id: sub?.providerSubscriptionId,
    updated_at: sub?.updatedAt,
  };
}

function signWebhook(rawBody: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const signed = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

async function dispatchWebhook(payload: any) {
  const rawBody = JSON.stringify(payload);
  const signature = signWebhook(rawBody, PADDLE_WEBHOOK_SECRET);
  const res = await fetch('http://localhost:3000/api/billing/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Paddle-Signature': signature,
    },
    body: rawBody,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log('================================================================');
  console.log('   M4.14.3.4 — CHECKOUT AUTHORIZATION & NEGATIVE AUDIT SUITE');
  console.log('================================================================');

  // Authenticate user competitor to obtain session token
  console.log('\n[Setup] Authenticating test identities...');
  const { data: compAuth, error: compErr } = await supabase.auth.signInWithPassword({
    email: 'competitor@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (compErr || !compAuth.session) {
    throw new Error('Could not authenticate competitor test user: ' + compErr?.message);
  }
  const competitorToken = compAuth.session.access_token;
  console.log('✓ Competitor session token obtained (belongs to Org: competitor Workspace).');

  const { data: analystAuth, error: anaErr } = await supabase.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (anaErr || !analystAuth.session) {
    throw new Error('Could not authenticate analyst test user: ' + anaErr?.message);
  }
  const analystToken = analystAuth.session.access_token;
  console.log('✓ Analyst session token obtained.');

  // Snapshot initial states
  const baselineStarter = await fetchOrgState(ORGS.starter.id);
  const baselinePro = await fetchOrgState(ORGS.pro.id);
  const baselineBiz = await fetchOrgState(ORGS.business.id);
  const baselineComm = await fetchOrgState(ORGS.commercial.id);

  const testResults: any[] = [];

  // ----------------------------------------------------------------
  // NEGATIVE TEST 1: User of Org A tries to initiate checkout for Org B
  // ----------------------------------------------------------------
  console.log('\n[Negative Test 1] Competitor (Org Competitor) tries to initiate checkout for Starter Org...');
  const res1 = await fetch('http://localhost:3000/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${competitorToken}`,
    },
    body: JSON.stringify({
      planId: 'pro',
      organizationId: ORGS.starter.id,
    }),
  });
  const data1 = await res1.json();
  console.log('Response Status:', res1.status, 'Body:', data1);

  const test1Passed = res1.status === 403 && data1.error.includes('Cross-tenant checkout blocked');
  console.log(`Test 1 Result: ${test1Passed ? '✓ PASSED (403 Forbidden - Cross-tenant attempt blocked)' : '✗ FAILED'}`);
  testResults.push({
    test: '1. Cross-tenant checkout initiation blocked (Org A user -> Org B)',
    passed: test1Passed,
    status: res1.status,
    detail: data1.error,
  });

  // ----------------------------------------------------------------
  // NEGATIVE TEST 2: Webhook with custom_data.organization_id divergent from registered subscription
  // ----------------------------------------------------------------
  console.log('\n[Negative Test 2] Webhook with divergent organization_id for known subscription...');
  // Starter sub sub_01m73xm9cymfwkbawkcvb19br7 belongs to ORGS.starter.id
  // We send a webhook claiming it belongs to ORGS.business.id!
  const divergentEventId = `evt_divergent_test_${Date.now()}`;
  const { status: status2, data: data2 } = await dispatchWebhook({
    event_id: divergentEventId,
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: ORGS.starter.subId, // Belongs to Starter!
      status: 'active',
      customer_id: SHARED_CUSTOMER_ID,
      custom_data: {
        organization_id: ORGS.business.id, // Divergent!
        plan_id: 'starter',
      },
      items: [{ price: { id: 'pri_01m73t7nhv4rwj634cwpaw3hec' }, quantity: 1 }],
    },
  });
  console.log('Webhook Response:', status2, data2);

  // Verify that neither Starter nor Business had their plans or quotas corrupted
  const state2Starter = await fetchOrgState(ORGS.starter.id);
  const state2Biz = await fetchOrgState(ORGS.business.id);

  const test2Passed =
    data2.success === false &&
    data2.error.includes('Conflict: Subscription') &&
    state2Starter.plan === 'starter' &&
    state2Starter.monthly_analyses_limit === 10 &&
    state2Biz.plan === 'business' &&
    state2Biz.monthly_analyses_limit === 120;

  console.log(`Test 2 Result: ${test2Passed ? '✓ PASSED (Conflict rejected at database level, zero corruption)' : '✗ FAILED'}`);
  testResults.push({
    test: '2. Divergent custom_data.organization_id rejected on existing subscription',
    passed: test2Passed,
    detail: data2.error,
  });

  // ----------------------------------------------------------------
  // NEGATIVE TEST 3: Unknown subscription with non-existent organization
  // ----------------------------------------------------------------
  console.log('\n[Negative Test 3] Unknown subscription with completely non-existent organization UUID...');
  const ghostOrgId = '99999999-9999-4999-a999-999999999999';
  const ghostEventId = `evt_ghost_org_${Date.now()}`;
  const { status: status3, data: data3 } = await dispatchWebhook({
    event_id: ghostEventId,
    event_type: 'subscription.created',
    occurred_at: new Date().toISOString(),
    data: {
      id: `sub_ghost_${Date.now()}`,
      status: 'active',
      customer_id: SHARED_CUSTOMER_ID,
      custom_data: {
        organization_id: ghostOrgId,
        plan_id: 'pro',
      },
      items: [{ price: { id: 'pri_01m73t7pae2d7wkta71swvzv09' }, quantity: 1 }],
    },
  });
  console.log('Webhook Response:', status3, data3);

  const test3Passed =
    data3.success === false &&
    data3.error.includes('Organization 99999999-9999-4999-a999-999999999999 does not exist');

  console.log(`Test 3 Result: ${test3Passed ? '✓ PASSED (Unknown org safely rejected with database integrity preserved)' : '✗ FAILED'}`);
  testResults.push({
    test: '3. Unknown subscription with non-existent organization rejected',
    passed: test3Passed,
    detail: data3.error,
  });

  // ----------------------------------------------------------------
  // NEGATIVE TEST 4: Event containing ONLY customer_id (no sub_id or org_id)
  // ----------------------------------------------------------------
  console.log('\n[Negative Test 4] Event containing only customer_id...');
  const custOnlyEventId = `evt_cust_only_${Date.now()}`;
  const { status: status4, data: data4 } = await dispatchWebhook({
    event_id: custOnlyEventId,
    event_type: 'customer.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: SHARED_CUSTOMER_ID,
      email: 'billing-sandbox@bidready.ai',
    },
  });
  console.log('Webhook Response:', status4, data4);

  const state4Starter = await fetchOrgState(ORGS.starter.id);
  const state4Pro = await fetchOrgState(ORGS.pro.id);
  const state4Biz = await fetchOrgState(ORGS.business.id);

  const test4Passed =
    data4.isGenericTestEvent === true &&
    state4Starter.monthly_analyses_limit === 10 &&
    state4Pro.monthly_analyses_limit === 40 &&
    state4Biz.monthly_analyses_limit === 120;

  console.log(`Test 4 Result: ${test4Passed ? '✓ PASSED (customer_id alone never resolves or mutates any tenant)' : '✗ FAILED'}`);
  testResults.push({
    test: '4. customer_id alone treated as generic, zero tenant mutation',
    passed: test4Passed,
    detail: data4.notes,
  });

  // ----------------------------------------------------------------
  // NEGATIVE TEST 5: Duplicate webhook
  // ----------------------------------------------------------------
  console.log('\n[Negative Test 5] Replaying an already processed webhook event...');
  const { status: status5, data: data5 } = await dispatchWebhook({
    event_id: divergentEventId, // Already sent in Test 2!
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: ORGS.starter.subId,
      status: 'active',
    },
  });
  console.log('Webhook Response:', status5, data5);

  const test5Passed = data5.duplicate === true;
  console.log(`Test 5 Result: ${test5Passed ? '✓ PASSED (Idempotency verified: duplicate: true)' : '✗ FAILED'}`);
  testResults.push({
    test: '5. Webhook replay idempotency enforced',
    passed: test5Passed,
    detail: data5.notes,
  });

  // ----------------------------------------------------------------
  // NEGATIVE TEST 6: User with no membership tries to initiate checkout
  // ----------------------------------------------------------------
  console.log('\n[Negative Test 6] Unauthenticated user / User without membership tries checkout...');
  const res6NoAuth = await fetch('http://localhost:3000/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: 'business',
      organizationId: ORGS.starter.id,
    }),
  });
  const data6NoAuth = await res6NoAuth.json();
  console.log('No-Auth Response:', res6NoAuth.status, data6NoAuth);

  const test6Passed = res6NoAuth.status === 401 && data6NoAuth.error.includes('Authentication required');
  console.log(`Test 6 Result: ${test6Passed ? '✓ PASSED (401 Unauthorized for unauthenticated caller)' : '✗ FAILED'}`);
  testResults.push({
    test: '6. Unauthenticated caller blocked from checkout initiation',
    passed: test6Passed,
    status: res6NoAuth.status,
    detail: data6NoAuth.error,
  });

  // ----------------------------------------------------------------
  // Final Database State Verification: Zero unauthorized mutations
  // ----------------------------------------------------------------
  const finalStarter = await fetchOrgState(ORGS.starter.id);
  const finalPro = await fetchOrgState(ORGS.pro.id);
  const finalBiz = await fetchOrgState(ORGS.business.id);
  const finalComm = await fetchOrgState(ORGS.commercial.id);

  const zeroMutation =
    finalStarter.plan === baselineStarter.plan &&
    finalStarter.monthly_analyses_limit === baselineStarter.monthly_analyses_limit &&
    finalPro.plan === baselinePro.plan &&
    finalPro.monthly_analyses_limit === baselinePro.monthly_analyses_limit &&
    finalBiz.plan === baselineBiz.plan &&
    finalBiz.monthly_analyses_limit === baselineBiz.monthly_analyses_limit &&
    finalComm.updated_at === baselineComm.updated_at;

  console.log(`\n[Integrity Proof] Zero unauthorized mutations across all tenants: ${zeroMutation ? '✓ VERIFIED' : '✗ FAILED'}`);

  console.log('\n================================================================');
  console.log('SUMMARY OF NEGATIVE AUDIT TESTS:');
  console.log(JSON.stringify(testResults, null, 2));
  console.log('================================================================');

  const allPassed = testResults.every(t => t.passed) && zeroMutation;
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Execution Error:', err);
  process.exit(1);
});
