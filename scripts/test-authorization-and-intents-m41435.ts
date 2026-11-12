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
const APP_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function signPaddleWebhook(rawBody: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${ts}:${rawBody}`);
  const h1 = hmac.digest('hex');
  return `ts=${ts};h1=${h1}`;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   BIDREADY M4.14.3.5 — FINAL AUTHORIZATION & INTENT CLOSURE   ');
  console.log('================================================================\n');

  // Obtain test tokens
  console.log('[AUTH SETUP] Obtaining JWT tokens for test personas...');
  
  // 1. Owner persona: analyst@bidready.com
  const { data: ownerAuth, error: ownerAuthErr } = await supabase.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (ownerAuthErr || !ownerAuth.session) {
    throw new Error(`Failed to sign in as analyst@bidready.com: ${ownerAuthErr?.message}`);
  }
  const ownerToken = ownerAuth.session.access_token;
  const ownerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${ownerToken}` } },
  });
  console.log('  ✓ Persona 1: analyst@bidready.com (Owner in e2e orgs) authenticated.');

  // 2. Member persona: member_user@bidready.com
  const { data: memberAuth, error: memberAuthErr } = await supabase.auth.signInWithPassword({
    email: 'member_user@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (memberAuthErr || !memberAuth.session) {
    throw new Error(`Failed to sign in as member_user@bidready.com: ${memberAuthErr?.message}`);
  }
  const memberToken = memberAuth.session.access_token;
  console.log('  ✓ Persona 2: member_user@bidready.com (Member role in Starter org) authenticated.');

  // 3. Competitor persona: competitor@bidready.com
  const { data: compAuth, error: compAuthErr } = await supabase.auth.signInWithPassword({
    email: 'competitor@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (compAuthErr || !compAuth.session) {
    throw new Error(`Failed to sign in as competitor@bidready.com: ${compAuthErr?.message}`);
  }
  const competitorToken = compAuth.session.access_token;
  console.log('  ✓ Persona 3: competitor@bidready.com (Owner in competitor org) authenticated.\n');

  const testOrgStarter = 'e2e00000-0000-4000-a000-000000000010';
  const testOrgCompetitor = '7a9537da-ff33-4f55-a93a-f86813234f34';
  const unassociatedOrg = 'e2e00000-0000-4000-a000-000000000001';

  let passedCount = 0;
  let totalCount = 0;

  function assert(title: string, condition: boolean, detail: string) {
    totalCount++;
    if (condition) {
      console.log(`  ✓ [TEST ${totalCount}] ${title}: PASSED`);
      passedCount++;
    } else {
      console.error(`  ✗ [TEST ${totalCount}] ${title}: FAILED (${detail})`);
    }
  }

  console.log('----------------------------------------------------------------');
  console.log('SECTION 1: 5 INDEPENDENT AUTHORIZATION TESTS (/api/billing/checkout)');
  console.log('----------------------------------------------------------------');

  // Test 1: Unauthenticated request -> HTTP 401
  const res1 = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: 'starter', organizationId: testOrgStarter }),
  });
  const data1 = await res1.json();
  assert(
    'Scenario 1: Unauthenticated request rejected with HTTP 401',
    res1.status === 401 && data1.success === false && data1.error.includes('Unauthorized'),
    `Status ${res1.status}, data: ${JSON.stringify(data1)}`
  );

  // Test 2: Authenticated user without association to organization -> HTTP 403
  const res2 = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${competitorToken}`,
    },
    body: JSON.stringify({ planId: 'starter', organizationId: unassociatedOrg }),
  });
  const data2 = await res2.json();
  assert(
    'Scenario 2: Authenticated user without membership rejected with HTTP 403',
    res2.status === 403 && data2.success === false && data2.error.includes('not an authorized member'),
    `Status ${res2.status}, data: ${JSON.stringify(data2)}`
  );

  // Test 3: Authenticated user with role 'member' -> HTTP 403
  const res3 = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ planId: 'starter', organizationId: testOrgStarter }),
  });
  const data3 = await res3.json();
  assert(
    'Scenario 3: Authenticated user with role "member" rejected with HTTP 403',
    res3.status === 403 && data3.success === false && data3.error.includes('lacks billing privileges'),
    `Status ${res3.status}, data: ${JSON.stringify(data3)}`
  );

  // Test 4: Authenticated user with role 'owner' or 'admin' -> HTTP 200 + Checkout Intent created
  const res4 = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ planId: 'starter', organizationId: testOrgStarter }),
  });
  const data4 = await res4.json();
  console.log('DEBUG data4:', JSON.stringify(data4));
  
  // Verify database record in checkout_intents via privileged audit RPC
  let intentInDb = null;
  if (data4.intentToken) {
    const { data: auditData } = await ownerClient.rpc('get_checkout_intent_audit', {
      p_intent_token: data4.intentToken,
    });
    intentInDb = auditData;
  }

  assert(
    'Scenario 4: Owner/admin authorized with HTTP 200 and server-side intent generated',
    res4.status === 200 &&
    data4.success === true &&
    !!data4.intentToken &&
    !!data4.authorizedCheckout &&
    intentInDb !== null &&
    intentInDb.status === 'pending' &&
    intentInDb.organization_id === testOrgStarter &&
    intentInDb.plan_id === 'starter',
    `Status ${res4.status}, intentInDb: ${JSON.stringify(intentInDb)}`
  );

  // Test 5: User of Org A attempting checkout for Org B -> HTTP 403
  const res5 = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${competitorToken}`,
    },
    body: JSON.stringify({ planId: 'pro', organizationId: testOrgStarter }),
  });
  const data5 = await res5.json();
  assert(
    'Scenario 5: User of Org A attempting checkout for Org B blocked with HTTP 403',
    res5.status === 403 && data5.success === false && data5.error.includes('Cross-tenant checkout blocked'),
    `Status ${res5.status}, data: ${JSON.stringify(data5)}`
  );

  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 2: CHECKOUT INTENT LIFECYCLE & WEBHOOK INTEGRITY TESTS');
  console.log('----------------------------------------------------------------');

  const webhookEndpoint = `${APP_URL}/api/billing/webhook`;

  // Test 6: Brand new subscription webhook with completely unknown intent_id -> Rejection
  const unknownSubId = `sub_unknown_${Date.now()}`;
  const payload6 = {
    event_id: `evt_unknown_intent_${Date.now()}`,
    event_type: 'subscription.created',
    data: {
      id: unknownSubId,
      status: 'active',
      customer_id: 'ctm_test_unauth',
      custom_data: {
        organization_id: testOrgStarter,
        plan_id: 'starter',
        intent_id: 'intent_fake_nonexistent_token_12345',
      },
      items: [{ price: { id: 'pri_01m73t7nhv4rwj634cwpaw3hec' } }],
    },
  };
  const body6 = JSON.stringify(payload6);
  const res6 = await fetch(webhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signPaddleWebhook(body6, PADDLE_WEBHOOK_SECRET),
    },
    body: body6,
  });
  const data6 = await res6.json();
  assert(
    'Scenario 6: First subscription with unknown intent token rejected by database',
    data6.success === false && data6.error.includes('No checkout intent found'),
    `Result: ${JSON.stringify(data6)}`
  );

  // Test 7: Brand new subscription webhook without any intent -> Rejection
  const payload7 = {
    event_id: `evt_no_intent_${Date.now()}`,
    event_type: 'subscription.created',
    data: {
      id: `sub_no_intent_${Date.now()}`,
      status: 'active',
      customer_id: 'ctm_test_unauth',
      custom_data: {
        organization_id: testOrgCompetitor,
        plan_id: 'business',
      },
      items: [{ price: { id: 'pri_01m73t7pr06wahgkdh9ce7w2d9' } }],
    },
  };
  const body7 = JSON.stringify(payload7);
  const res7 = await fetch(webhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signPaddleWebhook(body7, PADDLE_WEBHOOK_SECRET),
    },
    body: body7,
  });
  const data7 = await res7.json();
  assert(
    'Scenario 7: First subscription without intent rejected by database',
    data7.success === false && data7.error.includes('No checkout intent found'),
    `Result: ${JSON.stringify(data7)}`
  );

  // Test 8: Expired intent rejection
  const expiredToken = `intent_expired_${Date.now()}`;
  await supabase.rpc('create_test_checkout_intent_fixture', {
    p_intent_token: expiredToken,
    p_organization_id: testOrgStarter,
    p_user_id: ownerAuth.user.id,
    p_plan_id: 'starter',
    p_price_id: 'pri_01m73t7nhv4rwj634cwpaw3hec',
    p_status: 'pending',
    p_expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  });

  const payload8 = {
    event_id: `evt_expired_intent_${Date.now()}`,
    event_type: 'subscription.created',
    data: {
      id: `sub_expired_${Date.now()}`,
      status: 'active',
      customer_id: 'ctm_test_unauth',
      custom_data: {
        organization_id: testOrgStarter,
        plan_id: 'starter',
        intent_id: expiredToken,
      },
      items: [{ price: { id: 'pri_01m73t7nhv4rwj634cwpaw3hec' } }],
    },
  };
  const body8 = JSON.stringify(payload8);
  const res8 = await fetch(webhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signPaddleWebhook(body8, PADDLE_WEBHOOK_SECRET),
    },
    body: body8,
  });
  const data8 = await res8.json();
  assert(
    'Scenario 8: Expired checkout intent rejected by database',
    data8.success === false && data8.error.includes('expired'),
    `Result: ${JSON.stringify(data8)}`
  );

  // Test 9: Replay / already consumed intent rejection
  const consumedToken = `intent_consumed_${Date.now()}`;
  await supabase.rpc('create_test_checkout_intent_fixture', {
    p_intent_token: consumedToken,
    p_organization_id: testOrgStarter,
    p_user_id: ownerAuth.user.id,
    p_plan_id: 'starter',
    p_price_id: 'pri_01m73t7nhv4rwj634cwpaw3hec',
    p_status: 'consumed',
    p_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    p_consumed_by: 'sub_already_claimed_999',
  });

  const payload9 = {
    event_id: `evt_consumed_intent_${Date.now()}`,
    event_type: 'subscription.created',
    data: {
      id: `sub_replay_attack_${Date.now()}`,
      status: 'active',
      customer_id: 'ctm_test_unauth',
      custom_data: {
        organization_id: testOrgStarter,
        plan_id: 'starter',
        intent_id: consumedToken,
      },
      items: [{ price: { id: 'pri_01m73t7nhv4rwj634cwpaw3hec' } }],
    },
  };
  const body9 = JSON.stringify(payload9);
  const res9 = await fetch(webhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signPaddleWebhook(body9, PADDLE_WEBHOOK_SECRET),
    },
    body: body9,
  });
  const data9 = await res9.json();
  assert(
    'Scenario 9: Replay of already consumed intent rejected by database',
    data9.success === false && data9.error.includes('already consumed'),
    `Result: ${JSON.stringify(data9)}`
  );

  // Test 10: Plan tampering (intent for starter, payload claims pro)
  const tamperPlanToken = `intent_tamper_plan_${Date.now()}`;
  await supabase.rpc('create_test_checkout_intent_fixture', {
    p_intent_token: tamperPlanToken,
    p_organization_id: testOrgStarter,
    p_user_id: ownerAuth.user.id,
    p_plan_id: 'starter',
    p_price_id: 'pri_01m73t7nhv4rwj634cwpaw3hec',
    p_status: 'pending',
    p_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const payload10 = {
    event_id: `evt_tamper_plan_${Date.now()}`,
    event_type: 'subscription.created',
    data: {
      id: `sub_tamper_plan_${Date.now()}`,
      status: 'active',
      customer_id: 'ctm_test_unauth',
      custom_data: {
        organization_id: testOrgStarter,
        plan_id: 'pro', // Mismatch with intent (starter)!
        intent_id: tamperPlanToken,
      },
      items: [{ price: { id: 'pri_01m73t7pae2d7wkta71swvzv09' } }],
    },
  };
  const body10 = JSON.stringify(payload10);
  const res10 = await fetch(webhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signPaddleWebhook(body10, PADDLE_WEBHOOK_SECRET),
    },
    body: body10,
  });
  const data10 = await res10.json();
  assert(
    'Scenario 10: Plan tampering rejected by database',
    data10.success === false && data10.error.includes('Plan mismatch'),
    `Result: ${JSON.stringify(data10)}`
  );

  // Test 11: Cross-tenant organization tampering (intent created for Starter org, payload attempts Competitor org)
  const tamperOrgToken = `intent_tamper_org_${Date.now()}`;
  await supabase.rpc('create_test_checkout_intent_fixture', {
    p_intent_token: tamperOrgToken,
    p_organization_id: testOrgStarter,
    p_user_id: ownerAuth.user.id,
    p_plan_id: 'starter',
    p_price_id: 'pri_01m73t7nhv4rwj634cwpaw3hec',
    p_status: 'pending',
    p_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const payload11 = {
    event_id: `evt_tamper_org_${Date.now()}`,
    event_type: 'subscription.created',
    data: {
      id: `sub_tamper_org_${Date.now()}`,
      status: 'active',
      customer_id: 'ctm_test_unauth',
      custom_data: {
        organization_id: testOrgCompetitor, // Cross-tenant spoofing attempt
        plan_id: 'starter',
        intent_id: tamperOrgToken,
      },
      items: [{ price: { id: 'pri_01m73t7nhv4rwj634cwpaw3hec' } }],
    },
  };
  const body11 = JSON.stringify(payload11);
  const res11 = await fetch(webhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signPaddleWebhook(body11, PADDLE_WEBHOOK_SECRET),
    },
    body: body11,
  });
  const data11 = await res11.json();
  assert(
    'Scenario 11: Cross-tenant organization spoofing rejected by database',
    data11.success === false && data11.error.includes('Cross-tenant organization mismatch'),
    `Result: ${JSON.stringify(data11)}`
  );

  // Test 12: Legitimate Authorized Checkout -> Atomic Intent Consumption -> Idempotent Association
  const legitimateToken = data4.intentToken;
  const legitimateSubId = `sub_legitimate_test_${Date.now()}`;
  const payload12 = {
    event_id: `evt_legit_flow_${Date.now()}`,
    event_type: 'subscription.created',
    data: {
      id: legitimateSubId,
      status: 'active',
      customer_id: 'ctm_test_legit',
      custom_data: {
        organization_id: testOrgStarter,
        plan_id: 'starter',
        intent_id: legitimateToken,
      },
      items: [{ price: { id: 'pri_01m73t7nhv4rwj634cwpaw3hec' } }],
    },
  };
  const body12 = JSON.stringify(payload12);
  const res12 = await fetch(webhookEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signPaddleWebhook(body12, PADDLE_WEBHOOK_SECRET),
    },
    body: body12,
  });
  const data12 = await res12.json();

  // Verify intent is now marked 'consumed' in database using audit RPC
  const { data: updatedIntent } = await ownerClient.rpc('get_checkout_intent_audit', {
    p_intent_token: legitimateToken,
  });

  assert(
    'Scenario 12: Legitimate intent consumed atomically and bound to subscription',
    data12.success === true &&
    updatedIntent?.status === 'consumed' &&
    updatedIntent?.consumed_by_provider_sub_id === legitimateSubId &&
    !!updatedIntent?.consumed_at,
    `Result: ${JSON.stringify(data12)}, updatedIntent: ${JSON.stringify(updatedIntent)}`
  );

  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 3: DATABASE PRESERVATION AUDIT');
  console.log('----------------------------------------------------------------');

  // Verify Global Defense Systems Corp
  const { data: commercialOrg } = await ownerClient
    .from('organizations')
    .select('id, name')
    .eq('id', 'b22937b6-51e5-48a0-a75d-7b3405427298')
    .single();

  const { data: commercialSub } = await ownerClient
    .from('saas_subscriptions')
    .select('*')
    .eq('organization_id', 'b22937b6-51e5-48a0-a75d-7b3405427298')
    .single();

  assert(
    'Commercial client Global Defense Systems Corp fully preserved',
    commercialOrg?.name === 'Global Defense Systems Corp' &&
    commercialSub?.status === 'active' &&
    commercialSub?.plan === 'business',
    `Commercial Sub: ${JSON.stringify(commercialSub)}`
  );

  // Reset Starter org subscription back to its pristine interactive state
  await supabase
    .from('saas_subscriptions')
    .update({
      provider_subscription_id: 'sub_01m73xm9cymfwkbawkcvb19br7',
      provider_customer_id: 'ctm_01m73w7d3pc1sna6v8a9fy1vqx',
      plan: 'starter',
      status: 'active',
      monthly_analyses_limit: 10,
    })
    .eq('organization_id', testOrgStarter);

  console.log('\n================================================================');
  console.log(`AUDIT COMPLETE: ${passedCount} OF ${totalCount} TESTS PASSED.`);
  console.log('================================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('\nAUDIT SUITE ENCOUNTERED UNHANDLED EXCEPTION:\n', err);
  process.exit(1);
});
