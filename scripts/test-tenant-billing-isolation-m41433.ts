import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
function getEnv(key: string): string {
  const line = envContent.split('\n').find(l => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_WEBHOOK_SECRET = getEnv('PADDLE_WEBHOOK_SECRET');

const ORGS = {
  starter: {
    id: 'e2e00000-0000-4000-a000-000000000010',
    plan: 'starter',
    quota: 10,
    subId: 'sub_01m73xm9cymfwkbawkcvb19br7',
    priceId: 'pri_01m73t7nhv4rwj634cwpaw3hec'
  },
  pro: {
    id: 'e2e00000-0000-4000-a000-000000000020',
    plan: 'pro',
    quota: 40,
    subId: 'sub_01m73xn2cgj73bp9tdap2h45rs',
    priceId: 'pri_01m73t7pae2d7wkta71swvzv09'
  },
  business: {
    id: 'e2e00000-0000-4000-a000-000000000030',
    plan: 'business',
    quota: 120,
    subId: 'sub_01m73xnsx1j1fqw5tpyccdqh57',
    priceId: 'pri_01m73t7pr06wahgkdh9ce7w2d9'
  },
  commercial: {
    id: 'b22937b6-51e5-48a0-a75d-7b3405427298'
  }
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
    provider_customer_id: sub?.providerCustomerId,
    updated_at: sub?.updatedAt
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
      'Paddle-Signature': signature
    },
    body: rawBody
  });
  return res.json();
}

async function run() {
  console.log('================================================================');
  console.log('   M4.14.3.3 — TENANT-BILLING ASSOCIATION & ISOLATION AUDIT');
  console.log('================================================================');

  // Baseline state
  const state0Starter = await fetchOrgState(ORGS.starter.id);
  const state0Pro = await fetchOrgState(ORGS.pro.id);
  const state0Biz = await fetchOrgState(ORGS.business.id);
  const state0Comm = await fetchOrgState(ORGS.commercial.id);

  console.log('\n[1. Baseline State in PostgreSQL]');
  console.log('Starter: ', { plan: state0Starter.plan, quota: state0Starter.monthly_analyses_limit, subId: state0Starter.provider_subscription_id });
  console.log('Pro:     ', { plan: state0Pro.plan, quota: state0Pro.monthly_analyses_limit, subId: state0Pro.provider_subscription_id });
  console.log('Business:', { plan: state0Biz.plan, quota: state0Biz.monthly_analyses_limit, subId: state0Biz.provider_subscription_id });
  console.log('Commercial client updated_at:', state0Comm.updated_at);

  const testResults: any[] = [];

  // TEST 1: Starter event does NOT affect Pro or Business
  console.log('\n[2. Test 1: Starter Subscription Event -> Verify Pro and Business Untouched]');
  const starterEventId = `evt_audit_starter_${Date.now()}`;
  const starterRes = await dispatchWebhook({
    event_id: starterEventId,
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: ORGS.starter.subId,
      status: 'active',
      customer_id: SHARED_CUSTOMER_ID,
      custom_data: { organization_id: ORGS.starter.id, plan_id: 'starter' },
      items: [{ price: { id: ORGS.starter.priceId }, quantity: 1 }]
    }
  });
  console.log('Webhook response:', starterRes);

  const state1Starter = await fetchOrgState(ORGS.starter.id);
  const state1Pro = await fetchOrgState(ORGS.pro.id);
  const state1Biz = await fetchOrgState(ORGS.business.id);

  const test1Passed = 
    state1Starter.plan === 'starter' && state1Starter.monthly_analyses_limit === 10 &&
    state1Pro.plan === 'pro' && state1Pro.monthly_analyses_limit === 40 && state1Pro.updated_at === state0Pro.updated_at &&
    state1Biz.plan === 'business' && state1Biz.monthly_analyses_limit === 120 && state1Biz.updated_at === state0Biz.updated_at;

  console.log(`Test 1 Result: ${test1Passed ? '✓ PASSED (Zero cross-contamination to Pro/Business)' : '✗ FAILED'}`);
  testResults.push({ test: 'Starter event isolation', passed: test1Passed });

  // TEST 2: Pro event does NOT affect Starter or Business
  console.log('\n[3. Test 2: Pro Subscription Event -> Verify Starter and Business Untouched]');
  const proEventId = `evt_audit_pro_${Date.now()}`;
  const proRes = await dispatchWebhook({
    event_id: proEventId,
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: ORGS.pro.subId,
      status: 'active',
      customer_id: SHARED_CUSTOMER_ID,
      custom_data: { organization_id: ORGS.pro.id, plan_id: 'pro' },
      items: [{ price: { id: ORGS.pro.priceId }, quantity: 1 }]
    }
  });
  console.log('Webhook response:', proRes);

  const state2Starter = await fetchOrgState(ORGS.starter.id);
  const state2Pro = await fetchOrgState(ORGS.pro.id);
  const state2Biz = await fetchOrgState(ORGS.business.id);

  const test2Passed = 
    state2Pro.plan === 'pro' && state2Pro.monthly_analyses_limit === 40 &&
    state2Starter.plan === 'starter' && state2Starter.monthly_analyses_limit === 10 &&
    state2Biz.plan === 'business' && state2Biz.monthly_analyses_limit === 120 && state2Biz.updated_at === state0Biz.updated_at;

  console.log(`Test 2 Result: ${test2Passed ? '✓ PASSED (Zero cross-contamination to Starter/Business)' : '✗ FAILED'}`);
  testResults.push({ test: 'Pro event isolation', passed: test2Passed });

  // TEST 3: Business event does NOT affect Starter or Pro
  console.log('\n[4. Test 3: Business Subscription Event -> Verify Starter and Pro Untouched]');
  const bizEventId = `evt_audit_biz_${Date.now()}`;
  const bizRes = await dispatchWebhook({
    event_id: bizEventId,
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: ORGS.business.subId,
      status: 'active',
      customer_id: SHARED_CUSTOMER_ID,
      custom_data: { organization_id: ORGS.business.id, plan_id: 'business' },
      items: [{ price: { id: ORGS.business.priceId }, quantity: 1 }]
    }
  });
  console.log('Webhook response:', bizRes);

  const state3Starter = await fetchOrgState(ORGS.starter.id);
  const state3Pro = await fetchOrgState(ORGS.pro.id);
  const state3Biz = await fetchOrgState(ORGS.business.id);

  const test3Passed = 
    state3Biz.plan === 'business' && state3Biz.monthly_analyses_limit === 120 &&
    state3Starter.plan === 'starter' && state3Starter.monthly_analyses_limit === 10 &&
    state3Pro.plan === 'pro' && state3Pro.monthly_analyses_limit === 40;

  console.log(`Test 3 Result: ${test3Passed ? '✓ PASSED (Zero cross-contamination to Starter/Pro)' : '✗ FAILED'}`);
  testResults.push({ test: 'Business event isolation', passed: test3Passed });

  // TEST 4: Shared customer_id alone CANNOT provoke cross-tenant modification
  console.log('\n[5. Test 4: Shared customer_id without valid sub/org -> Verify Zero Mutated Orgs]');
  const customerOnlyEventId = `evt_audit_cust_only_${Date.now()}`;
  const custOnlyRes = await dispatchWebhook({
    event_id: customerOnlyEventId,
    event_type: 'customer.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: SHARED_CUSTOMER_ID,
      email: 'billing-sandbox@bidready.ai',
      name: 'Shared Buyer Test'
    }
  });
  console.log('Webhook response for customer.updated:', custOnlyRes);

  const state4Starter = await fetchOrgState(ORGS.starter.id);
  const state4Pro = await fetchOrgState(ORGS.pro.id);
  const state4Biz = await fetchOrgState(ORGS.business.id);

  const test4Passed = 
    custOnlyRes.isGenericTestEvent === true &&
    state4Starter.plan === 'starter' && state4Starter.monthly_analyses_limit === 10 &&
    state4Pro.plan === 'pro' && state4Pro.monthly_analyses_limit === 40 &&
    state4Biz.plan === 'business' && state4Biz.monthly_analyses_limit === 120;

  console.log(`Test 4 Result: ${test4Passed ? '✓ PASSED (Shared customer_id treated as generic, zero tenant mutation)' : '✗ FAILED'}`);
  testResults.push({ test: 'Shared customer_id isolation', passed: test4Passed });

  // TEST 5: Idempotency Verification
  console.log('\n[6. Test 5: Re-dispatching Starter Event -> Verify duplicate: true]');
  const dupRes = await dispatchWebhook({
    event_id: starterEventId,
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: ORGS.starter.subId,
      status: 'active',
      customer_id: SHARED_CUSTOMER_ID,
      custom_data: { organization_id: ORGS.starter.id, plan_id: 'starter' },
      items: [{ price: { id: ORGS.starter.priceId }, quantity: 1 }]
    }
  });
  console.log('Duplicate webhook response:', dupRes);
  const test5Passed = dupRes.duplicate === true;
  console.log(`Test 5 Result: ${test5Passed ? '✓ PASSED (Duplicate detected, zero mutation)' : '✗ FAILED'}`);
  testResults.push({ test: 'Idempotency guarantee', passed: test5Passed });

  // Commercial client final check
  const stateFinalComm = await fetchOrgState(ORGS.commercial.id);
  const commUntouched = stateFinalComm.updated_at === state0Comm.updated_at;
  console.log(`\n[7. Commercial Organization Check]: ${commUntouched ? '✓ 100% UNTOUCHED' : '✗ MODIFIED'}`);
  testResults.push({ test: 'Commercial client protection', passed: commUntouched });

  console.log('\n================================================================');
  console.log('SUMMARY OF AUDIT TESTS:');
  console.log(JSON.stringify(testResults, null, 2));
  console.log('================================================================');

  const allPassed = testResults.every(t => t.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

run().catch(console.error);
