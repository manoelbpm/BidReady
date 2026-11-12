import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
function getEnv(key: string): string {
  const line = envContent.split('\n').find(l => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const APP_URL = 'http://localhost:3000';

async function runNegativeTests() {
  console.log('================================================================');
  console.log('   BIDREADY M4.14.3.7 — ETAPA 2: NEGATIVE TESTS & PRIVILEGES   ');
  console.log('================================================================\n');

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authenticate owner persona (analyst@bidready.com)
  const { data: ownerAuth, error: ownerAuthErr } = await anonClient.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (ownerAuthErr || !ownerAuth.session) {
    throw new Error(`Failed to sign in as owner: ${ownerAuthErr?.message}`);
  }
  const ownerToken = ownerAuth.session.access_token;
  const ownerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${ownerToken}` } },
  });

  // Authenticate member persona (member_user@bidready.com)
  const { data: memberAuth, error: memberAuthErr } = await anonClient.auth.signInWithPassword({
    email: 'member_user@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (memberAuthErr || !memberAuth.session) {
    throw new Error(`Failed to sign in as member: ${memberAuthErr?.message}`);
  }
  const memberToken = memberAuth.session.access_token;

  // Authenticate competitor persona (competitor@bidready.com)
  const { data: compAuth, error: compAuthErr } = await anonClient.auth.signInWithPassword({
    email: 'competitor@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (compAuthErr || !compAuth.session) {
    throw new Error(`Failed to sign in as competitor: ${compAuthErr?.message}`);
  }
  const compToken = compAuth.session.access_token;

  const starterOrgId = 'e2e00000-0000-4000-a000-000000000010';
  const competitorOrgId = '7a9537da-ff33-4f55-a93a-f86813234f34';
  const unassociatedOrgId = 'e2e00000-0000-4000-a000-000000000001';

  let passed = 0;
  let total = 0;

  function report(name: string, ok: boolean, detail: string) {
    total++;
    if (ok) {
      console.log(`  ✓ [TEST ${total}] ${name}: PASSED`);
      console.log(`    Detail: ${detail}`);
      passed++;
    } else {
      console.error(`  ✗ [TEST ${total}] ${name}: FAILED`);
      console.error(`    Detail: ${detail}`);
    }
  }

  // 1. Direct RPC by anon
  console.log('--- TEST 1: Direct RPC by anon ---');
  const resRpcAnon = await anonClient.rpc('create_checkout_intent', {
    p_organization_id: starterOrgId,
    p_user_id: ownerAuth.user.id,
    p_plan_id: 'starter',
    p_price_id: 'pri_01m73t7nhv4rwj634cwpaw3hec',
  });
  const rpcAnonBlocked = resRpcAnon.error !== null && (resRpcAnon.error.code === '42501' || resRpcAnon.error.message.includes('permission denied'));
  report(
    'anon calling create_checkout_intent RPC directly',
    rpcAnonBlocked,
    `Error code: ${resRpcAnon.error?.code}, Message: "${resRpcAnon.error?.message}"`
  );

  // 2. Direct RPC by authenticated
  console.log('\n--- TEST 2: Direct RPC by authenticated ---');
  const resRpcAuth = await ownerClient.rpc('create_checkout_intent', {
    p_organization_id: starterOrgId,
    p_user_id: ownerAuth.user.id,
    p_plan_id: 'starter',
    p_price_id: 'pri_01m73t7nhv4rwj634cwpaw3hec',
  });
  const rpcAuthBlocked = resRpcAuth.error !== null && (resRpcAuth.error.code === '42501' || resRpcAuth.error.message.includes('permission denied'));
  report(
    'authenticated calling create_checkout_intent RPC directly',
    rpcAuthBlocked,
    `Error code: ${resRpcAuth.error?.code}, Message: "${resRpcAuth.error?.message}"`
  );

  // 3. User without membership in target organization -> HTTP 403
  console.log('\n--- TEST 3: User without membership -> HTTP 403 ---');
  const resNoMember = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      organizationId: competitorOrgId,
      planId: 'starter',
    }),
  });
  const bodyNoMember = await resNoMember.json();
  report(
    'User without membership calling /api/billing/checkout',
    resNoMember.status === 403,
    `Status: ${resNoMember.status}, Error: "${bodyNoMember.error}"`
  );

  // 4. User with role member (non-admin) -> HTTP 403
  console.log('\n--- TEST 4: User with role member -> HTTP 403 ---');
  const resMemberRole = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`,
    },
    body: JSON.stringify({
      organizationId: starterOrgId,
      planId: 'starter',
    }),
  });
  const bodyMemberRole = await resMemberRole.json();
  report(
    'User with member role calling /api/billing/checkout',
    resMemberRole.status === 403,
    `Status: ${resMemberRole.status}, Error: "${bodyMemberRole.error}"`
  );

  // 5. User owner/admin authorized -> HTTP 200 via route
  console.log('\n--- TEST 5: User owner/admin authorized -> HTTP 200 via route ---');
  const resOwner = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      organizationId: starterOrgId,
      planId: 'starter',
    }),
  });
  const bodyOwner = await resOwner.json();
  const ownerOk = resOwner.status === 200 && bodyOwner.success === true && !!bodyOwner.intentToken;
  report(
    'Authorized owner initiating checkout via route',
    ownerOk,
    `Status: ${resOwner.status}, Success: ${bodyOwner.success}, IntentToken: ${bodyOwner.intentToken?.substring(0, 16)}...`
  );

  // 6. Cross-tenant attempt (User of Org B trying Org A) -> HTTP 403
  console.log('\n--- TEST 6: Cross-tenant attempt -> HTTP 403 ---');
  const resCross = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${compToken}`,
    },
    body: JSON.stringify({
      organizationId: starterOrgId,
      planId: 'starter',
    }),
  });
  const bodyCross = await resCross.json();
  report(
    'Cross-tenant checkout attempt',
    resCross.status === 403,
    `Status: ${resCross.status}, Error: "${bodyCross.error}"`
  );

  // 7. Unauthenticated request to /api/billing/checkout -> HTTP 401
  console.log('\n--- TEST 7: Unauthenticated request -> HTTP 401 ---');
  const resUnauth = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationId: starterOrgId,
      planId: 'starter',
    }),
  });
  const bodyUnauth = await resUnauth.json();
  report(
    'Unauthenticated request calling /api/billing/checkout',
    resUnauth.status === 401,
    `Status: ${resUnauth.status}, Error: "${bodyUnauth.error}"`
  );

  console.log('\n================================================================');
  console.log(`RESULT: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runNegativeTests().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
