import { createClient } from '@supabase/supabase-js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const oppId = 'e705f533-8187-4af4-b23f-6c246d537e8a';
const org1Id = 'b22937b6-51e5-48a0-a75d-7b3405427298';
const org2Id = '7a9537da-ff33-4f55-a93a-f86813234f34';

async function main() {
  console.log('--- VERIFYING M4.13.1 MULTI-TENANT ISOLATION ---');

  // Authenticate Org 1
  const client1 = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth1 = await client1.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });
  const token1 = auth1.data.session!.access_token;
  console.log(`Org 1 Authenticated (Token: ${token1.slice(0, 15)}...)`);

  // Authenticate Org 2
  const client2 = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth2 = await client2.auth.signInWithPassword({
    email: 'competitor@bidready.com',
    password: 'SuperSecret2026!',
  });
  const token2 = auth2.data.session!.access_token;
  console.log(`Org 2 Authenticated (Token: ${token2.slice(0, 15)}...)`);

  // Test 1: GET /api/opportunities
  console.log('\n[Test 1] GET /api/opportunities:');
  const res1Opp = await fetch('http://localhost:3000/api/opportunities', {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const data1Opp = await res1Opp.json();
  const org1HasOpp = (data1Opp.opportunities || []).some((o: any) => o.id === oppId);
  console.log(`  Org 1 can see opportunity: ${org1HasOpp} (Status ${res1Opp.status})`);

  const res2Opp = await fetch('http://localhost:3000/api/opportunities', {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const data2Opp = await res2Opp.json();
  const org2HasOpp = (data2Opp.opportunities || []).some((o: any) => o.id === oppId);
  console.log(`  Org 2 can see Org 1 opportunity: ${org2HasOpp} (Status ${res2Opp.status})`);
  if (org2HasOpp) throw new Error('Multi-tenant violation: Org 2 saw Org 1 opportunity!');

  // Test 2: GET /api/opportunities/[id]/matches
  console.log('\n[Test 2] GET /api/opportunities/[id]/matches for Org 1 Opportunity:');
  const res1Matches = await fetch(`http://localhost:3000/api/opportunities/${oppId}/matches`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log(`  Org 1 access status: ${res1Matches.status}`);

  const res2Matches = await fetch(`http://localhost:3000/api/opportunities/${oppId}/matches`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const data2Matches = await res2Matches.json();
  console.log(`  Org 2 access status: ${res2Matches.status} (Error: ${data2Matches.error})`);
  if (res2Matches.status === 200 && data2Matches.success) {
    throw new Error('Multi-tenant violation: Org 2 accessed Org 1 matches!');
  }

  // Test 3: POST /api/opportunities/[id]/matches/run by Org 2
  console.log('\n[Test 3] POST /api/opportunities/[id]/matches/run by Org 2:');
  const res2Run = await fetch(`http://localhost:3000/api/opportunities/${oppId}/matches/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
  });
  const data2Run = await res2Run.json();
  console.log(`  Org 2 run status: ${res2Run.status} (Error: ${data2Run.error})`);
  if (res2Run.status === 200 && data2Run.success) {
    throw new Error('Multi-tenant violation: Org 2 executed matching on Org 1 opportunity!');
  }

  // Test 4: PostgreSQL Direct RLS Query
  console.log('\n[Test 4] Direct PostgreSQL RLS Query:');
  const { data: org1Direct } = await client1
    .from('opportunities')
    .select('id, title')
    .eq('id', oppId);
  console.log(`  Org 1 direct query returned: ${org1Direct?.length} record(s)`);

  const { data: org2Direct } = await client2
    .from('opportunities')
    .select('id, title')
    .eq('id', oppId);
  console.log(`  Org 2 direct query returned: ${org2Direct?.length} record(s) (RLS Enforced)`);
  if (org2Direct && org2Direct.length > 0) {
    throw new Error('PostgreSQL RLS violation: Org 2 directly read Org 1 opportunity!');
  }

  console.log('\n--- MULTI-TENANT ISOLATION FULLY VERIFIED ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
