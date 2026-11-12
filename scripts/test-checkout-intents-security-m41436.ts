import fs from 'fs';
import path from 'path';
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
const APP_URL = 'http://localhost:3000';

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('   BIDREADY M4.14.3.6 — CHECKOUT INTENTS SECURITY ISOLATION    ');
  console.log('================================================================\n');

  // 1. Anonymous Client
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Authenticated Clients
  const { data: ownerAuth, error: ownerAuthErr } = await anonClient.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });
  if (ownerAuthErr || !ownerAuth.session) {
    throw new Error(`Auth failed: ${ownerAuthErr?.message}`);
  }
  const ownerToken = ownerAuth.session.access_token;
  const authenticatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${ownerToken}` } },
  });

  const testOrgId = 'e2e00000-0000-4000-a000-000000000010';
  let passed = 0;
  let total = 0;

  function assert(title: string, success: boolean, detail: string) {
    total++;
    if (success) {
      console.log(`  ✓ [TEST ${total}] ${title}: PASSED`);
      passed++;
    } else {
      console.error(`  ✗ [TEST ${total}] ${title}: FAILED (${detail})`);
    }
  }

  console.log('----------------------------------------------------------------');
  console.log('SECTION 1: DIRECT ACCESS AUDIT FOR ANONYMOUS ROLE (anon)');
  console.log('----------------------------------------------------------------');

  // Test 1: Direct SELECT by anon
  const { data: anonSel, error: anonSelErr } = await anonClient
    .from('checkout_intents')
    .select('*');
  assert(
    'Anon direct SELECT is blocked (permission denied)',
    anonSelErr !== null && (anonSelErr.code === '42501' || anonSelErr.message.includes('permission denied')),
    `Code: ${anonSelErr?.code}, Msg: ${anonSelErr?.message}`
  );

  // Test 2: Direct INSERT by anon
  const { data: anonIns, error: anonInsErr } = await anonClient
    .from('checkout_intents')
    .insert({
      intent_token: 'intent_illegal_anon_1',
      organization_id: testOrgId,
      user_id: ownerAuth.user.id,
      plan_id: 'starter',
      price_id: 'pri_test',
    });
  assert(
    'Anon direct INSERT is blocked (permission denied)',
    anonInsErr !== null && (anonInsErr.code === '42501' || anonInsErr.message.includes('permission denied')),
    `Code: ${anonInsErr?.code}, Msg: ${anonInsErr?.message}`
  );

  // Test 3: Direct UPDATE by anon
  const { data: anonUpd, error: anonUpdErr } = await anonClient
    .from('checkout_intents')
    .update({ status: 'consumed' })
    .eq('organization_id', testOrgId);
  assert(
    'Anon direct UPDATE is blocked (permission denied)',
    anonUpdErr !== null && (anonUpdErr.code === '42501' || anonUpdErr.message.includes('permission denied')),
    `Code: ${anonUpdErr?.code}, Msg: ${anonUpdErr?.message}`
  );

  // Test 4: Direct DELETE by anon
  const { data: anonDel, error: anonDelErr } = await anonClient
    .from('checkout_intents')
    .delete()
    .eq('organization_id', testOrgId);
  assert(
    'Anon direct DELETE is blocked (permission denied)',
    anonDelErr !== null && (anonDelErr.code === '42501' || anonDelErr.message.includes('permission denied')),
    `Code: ${anonDelErr?.code}, Msg: ${anonDelErr?.message}`
  );

  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 2: DIRECT ACCESS AUDIT FOR AUTHENTICATED USERS (authenticated)');
  console.log('----------------------------------------------------------------');

  // Test 5: Direct SELECT by authenticated user
  const { data: authSel, error: authSelErr } = await authenticatedClient
    .from('checkout_intents')
    .select('*');
  assert(
    'Authenticated direct SELECT is blocked (permission denied)',
    authSelErr !== null && (authSelErr.code === '42501' || authSelErr.message.includes('permission denied')),
    `Code: ${authSelErr?.code}, Msg: ${authSelErr?.message}`
  );

  // Test 6: Direct INSERT by authenticated user
  const { data: authIns, error: authInsErr } = await authenticatedClient
    .from('checkout_intents')
    .insert({
      intent_token: 'intent_illegal_auth_1',
      organization_id: testOrgId,
      user_id: ownerAuth.user.id,
      plan_id: 'starter',
      price_id: 'pri_test',
    });
  assert(
    'Authenticated direct INSERT is blocked (permission denied)',
    authInsErr !== null && (authInsErr.code === '42501' || authInsErr.message.includes('permission denied')),
    `Code: ${authInsErr?.code}, Msg: ${authInsErr?.message}`
  );

  // Test 7: Direct UPDATE by authenticated user (status / price_id tampering attempt)
  const { data: authUpd, error: authUpdErr } = await authenticatedClient
    .from('checkout_intents')
    .update({ status: 'consumed', price_id: 'pri_forged_cheap' })
    .eq('organization_id', testOrgId);
  assert(
    'Authenticated direct UPDATE is blocked (permission denied)',
    authUpdErr !== null && (authUpdErr.code === '42501' || authUpdErr.message.includes('permission denied')),
    `Code: ${authUpdErr?.code}, Msg: ${authUpdErr?.message}`
  );

  // Test 8: Direct DELETE by authenticated user
  const { data: authDel, error: authDelErr } = await authenticatedClient
    .from('checkout_intents')
    .delete()
    .eq('organization_id', testOrgId);
  assert(
    'Authenticated direct DELETE is blocked (permission denied)',
    authDelErr !== null && (authDelErr.code === '42501' || authDelErr.message.includes('permission denied')),
    `Code: ${authDelErr?.code}, Msg: ${authDelErr?.message}`
  );

  // Test 9: Direct RPC invocation of create_checkout_intent by authenticated user
  const { data: rpcAuth, error: rpcAuthErr } = await authenticatedClient.rpc('create_checkout_intent', {
    p_organization_id: testOrgId,
    p_user_id: ownerAuth.user.id,
    p_plan_id: 'starter',
    p_price_id: 'pri_test',
    p_expires_in_seconds: 3600,
  });
  assert(
    'Authenticated direct RPC execution of create_checkout_intent is blocked',
    rpcAuthErr !== null && (rpcAuthErr.code === '42501' || rpcAuthErr.message.includes('permission denied')),
    `Code: ${rpcAuthErr?.code}, Msg: ${rpcAuthErr?.message}`
  );

  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 3: PRIVILEGED SERVER-SIDE CHECKOUT API ROUTE VERIFICATION');
  console.log('----------------------------------------------------------------');

  // Test 10: Server API handles authorized intent creation securely
  const res10 = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      planId: 'starter',
      organizationId: testOrgId,
    }),
  });
  const data10 = await res10.json();
  assert(
    'Privileged server route (/api/billing/checkout) successfully creates intent',
    res10.status === 200 && data10.success === true && !!data10.intentToken,
    `Status ${res10.status}, Body: ${JSON.stringify(data10)}`
  );

  console.log('\n================================================================');
  console.log(`SECURITY AUDIT COMPLETE: ${passed} OF ${total} TESTS PASSED.`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runSecurityAudit().catch(err => {
  console.error('\nSECURITY AUDIT EXCEPTION:\n', err);
  process.exit(1);
});
