import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');
const PADDLE_ENV = getEnv('PADDLE_ENV');
const DESTINATION_ID = 'ntfset_01m73tkjy55j1sz6287cb8dnsr';

async function paddleGet(endpoint: string) {
  const res = await fetch(`https://sandbox-api.paddle.com${endpoint}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runAudit() {
  console.log('========================================================================');
  console.log('   BIDREADY M4.14.3.1 — TRANSACTION PROVENANCE & EVIDENCE AUDIT (RO)   ');
  console.log('========================================================================\n');

  console.log(`[CHECK 0] Environment: ${PADDLE_ENV}`);
  if (PADDLE_ENV !== 'sandbox') throw new Error('Not in sandbox!');

  // 1. Audit /transactions in Paddle Sandbox
  console.log('\n[1] Querying GET /transactions from Paddle Sandbox...');
  const txnsRes = await paddleGet('/transactions?per_page=50');
  const txns = txnsRes.data?.data || [];
  console.log(`Total transactions found in Sandbox: ${txns.length}`);
  for (const t of txns) {
    console.log(`  - ID: ${t.id} | Status: ${t.status} | Total: ${t.details?.totals?.total} ${t.currency_code} | Customer: ${t.customer_id} | Subscription: ${t.subscription_id} | Created: ${t.created_at} | Billed: ${t.billed_at}`);
  }

  // 2. Audit /subscriptions in Paddle Sandbox
  console.log('\n[2] Querying GET /subscriptions from Paddle Sandbox...');
  const subsRes = await paddleGet('/subscriptions?per_page=50');
  const subs = subsRes.data?.data || [];
  console.log(`Total subscriptions found in Sandbox: ${subs.length}`);
  for (const s of subs) {
    console.log(`  - ID: ${s.id} | Status: ${s.status} | Customer: ${s.customer_id} | Created: ${s.created_at} | Next Billed: ${s.next_billed_at}`);
  }

  // 3. Audit /customers in Paddle Sandbox
  console.log('\n[3] Querying GET /customers from Paddle Sandbox...');
  const custsRes = await paddleGet('/customers?per_page=50');
  const custs = custsRes.data?.data || [];
  console.log(`Total customers found in Sandbox: ${custs.length}`);
  for (const c of custs) {
    console.log(`  - ID: ${c.id} | Email: ${c.email} | Name: ${c.name} | Created: ${c.created_at}`);
  }

  // 4. Audit /notification-settings
  console.log('\n[4] Querying GET /notification-settings/' + DESTINATION_ID);
  const ntfRes = await paddleGet(`/notification-settings/${DESTINATION_ID}`);
  console.log('Destination details:', JSON.stringify(ntfRes.data?.data, null, 2));

  // 5. Audit /simulations and /notifications
  console.log('\n[5] Querying GET /simulations from Paddle Sandbox...');
  const simsRes = await paddleGet('/simulations?per_page=50');
  const sims = simsRes.data?.data || [];
  console.log(`Total simulations registered in Sandbox: ${sims.length}`);
  for (const sm of sims) {
    console.log(`  - ID: ${sm.id} | Name: "${sm.name}" | Type: ${sm.type} | Created: ${sm.created_at}`);
  }

  // 6. Check existence of the specific IDs cited in M4.14.3 report
  console.log('\n[6] Investigating Specific IDs from M4.14.3:');
  const idsToCheck = [
    { type: 'subscription', id: 'sub_01m73t7nbrgefdf099rkm3vzfe' },
    { type: 'subscription', id: 'sub_01m73t7p57zcjbrvwrg8jr86dp' },
    { type: 'subscription', id: 'sub_01m73t7pjqdffm094n850hzp3h' },
    { type: 'customer', id: 'ctm_01m73t7nbrgefdf099rkm3vzfe' },
    { type: 'customer', id: 'ctm_01m73t7p57zcjbrvwrg8jr86dp' },
    { type: 'customer', id: 'ctm_01m73t7pjqdffm094n850hzp3h' },
  ];

  for (const item of idsToCheck) {
    const checkRes = await paddleGet(`/${item.type}s/${item.id}`);
    console.log(`  - ${item.type.toUpperCase()} ${item.id}: Exists in Paddle API? ${checkRes.ok ? 'YES' : 'NO (' + checkRes.status + ' ' + (checkRes.data?.error?.code || '') + ')'}`);
  }

  process.exit(0);
}

runAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
