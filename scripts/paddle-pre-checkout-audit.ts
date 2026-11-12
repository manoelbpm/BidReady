import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');
const PADDLE_WEBHOOK_SECRET = getEnv('PADDLE_WEBHOOK_SECRET');
const PADDLE_ENV = getEnv('PADDLE_ENV');
const OLD_SECRET = 'pdl_ntfset_01m7339szfwss239gws4jx82dk_koWhylX9INlgglh2ii0ipvq4uPVYW5mr';

const PRICE_STARTER = getEnv('NEXT_PUBLIC_PADDLE_PRICE_STARTER');
const PRICE_PRO = getEnv('NEXT_PUBLIC_PADDLE_PRICE_PRO');
const PRICE_BUSINESS = getEnv('NEXT_PUBLIC_PADDLE_PRICE_BUSINESS');

function signPayload(rawBody: string, secret: string, tsOffset: number = 0): string {
  const ts = Math.floor(Date.now() / 1000) + tsOffset;
  const signedPayload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

async function runAudit() {
  console.log('====================================================');
  console.log('   BIDREADY M4.14.2 — PRE-CHECKOUT SECURITY AUDIT   ');
  console.log('====================================================\n');

  // Check 0: Environment validation
  console.log('[CHECK 0] Environment Integrity:');
  console.log(`  - PADDLE_ENV: ${PADDLE_ENV} (Must be sandbox)`);
  if (PADDLE_ENV !== 'sandbox') {
    throw new Error('SECURITY VIOLATION: PADDLE_ENV is not sandbox!');
  }
  console.log(`  - PADDLE_API_KEY: Prefix '${PADDLE_API_KEY.slice(0, 15)}...' (Length: ${PADDLE_API_KEY.length})`);
  console.log(`  - PADDLE_WEBHOOK_SECRET: Prefix '${PADDLE_WEBHOOK_SECRET.slice(0, 11)}...' (Length: ${PADDLE_WEBHOOK_SECRET.length})`);
  console.log(`  - Rotated from old secret: ${PADDLE_WEBHOOK_SECRET !== OLD_SECRET ? 'YES (Secret changed)' : 'FAIL (Old secret still present)'}`);

  // Check 1: Catalog linkage in Paddle Sandbox
  console.log('\n[CHECK 1] Paddle Sandbox Catalog Linkage:');
  const pricesRes = await fetch('https://sandbox-api.paddle.com/prices?include=product', {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
  });
  const pricesData = await pricesRes.json();
  const prices: any[] = pricesData.data || [];

  const expectedPlans = [
    { id: PRICE_STARTER, name: 'Starter', expectedAmount: '2900', expectedUsd: 29 },
    { id: PRICE_PRO, name: 'Pro', expectedAmount: '6900', expectedUsd: 69 },
    { id: PRICE_BUSINESS, name: 'Business', expectedAmount: '14900', expectedUsd: 149 },
  ];

  for (const exp of expectedPlans) {
    const found = prices.find((p) => p.id === exp.id);
    if (!found) {
      throw new Error(`Catalog mismatch: Price ID ${exp.id} (${exp.name}) not found in Paddle Sandbox!`);
    }
    const unitPrice = found.unit_price?.amount;
    const currency = found.unit_price?.currency_code;
    const interval = found.billing_cycle?.interval;
    const frequency = found.billing_cycle?.frequency;
    const status = found.status;
    const product = found.product;

    console.log(`  ✓ Plan: ${exp.name}`);
    console.log(`    - Price ID: ${found.id}`);
    console.log(`    - Status: ${status}`);
    console.log(`    - Amount: $${Number(unitPrice) / 100} ${currency} (Expected: $${exp.expectedUsd} USD)`);
    console.log(`    - Billing: Every ${frequency} ${interval}`);
    console.log(`    - Linked Product: ${product?.id} ("${product?.name}") - Status: ${product?.status}`);

    if (currency !== 'USD' || Number(unitPrice) / 100 !== exp.expectedUsd || status !== 'active') {
      throw new Error(`Price specification mismatch for ${exp.name}`);
    }
  }

  // Check 2: Live Next.js Webhook Server Acceptance with NEW secret
  console.log('\n[CHECK 2] Webhook Endpoint Verification against http://localhost:3000/api/billing/webhook:');
  
  const testEventId = `evt_audit_new_${Date.now()}`;
  const validPayload = JSON.stringify({
    event_id: testEventId,
    event_type: 'subscription.created',
    occurred_at: new Date().toISOString(),
    data: {
      id: `sub_audit_${Date.now()}`,
      status: 'active',
      custom_data: {
        organization_id: 'e2e00000-0000-4000-a000-000000000001',
        plan_id: 'pro',
      },
    },
  });

  const validSignature = signPayload(validPayload, PADDLE_WEBHOOK_SECRET);
  console.log('  -> Scenario A: Valid request signed with NEW rotated secret...');
  const resValid = await fetch('http://localhost:3000/api/billing/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': validSignature,
    },
    body: validPayload,
  });
  const resValidBody = await resValid.json();
  console.log(`     HTTP Status: ${resValid.status} (Expected: 200)`);
  console.log(`     Response:`, resValidBody);
  if (resValid.status !== 200 || !resValidBody.received) {
    throw new Error(`Failed Scenario A: New secret not accepted!`);
  }

  // Check 3: Live Webhook Rejection with OLD compromised secret
  console.log('\n  -> Scenario B: Rejection test using OLD compromised secret...');
  const oldPayload = JSON.stringify({
    event_id: `evt_audit_old_${Date.now()}`,
    event_type: 'subscription.created',
    occurred_at: new Date().toISOString(),
    data: {
      id: `sub_compromised_${Date.now()}`,
      status: 'active',
    },
  });
  const oldSignature = signPayload(oldPayload, OLD_SECRET);
  const resOld = await fetch('http://localhost:3000/api/billing/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': oldSignature,
    },
    body: oldPayload,
  });
  const resOldBody = await resOld.json();
  console.log(`     HTTP Status: ${resOld.status} (Expected: 401 Unauthorized)`);
  console.log(`     Response:`, resOldBody);
  if (resOld.status !== 401) {
    throw new Error(`SECURITY VIOLATION: Request signed with old secret was NOT rejected with 401!`);
  }

  // Check 4: Idempotency Verification
  console.log('\n  -> Scenario C: Idempotency test (Re-sending Scenario A payload with same event_id)...');
  const resDup = await fetch('http://localhost:3000/api/billing/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': validSignature,
    },
    body: validPayload,
  });
  const resDupBody = await resDup.json();
  console.log(`     HTTP Status: ${resDup.status} (Expected: 200)`);
  console.log(`     Response:`, resDupBody);
  console.log(`     Duplicate flag: ${resDupBody.duplicate} (Expected: true)`);
  if (resDup.status !== 200 || resDupBody.duplicate !== true) {
    throw new Error(`Failed Scenario C: Idempotency check failed for duplicate event_id!`);
  }

  console.log('\n====================================================');
  console.log('   ALL PRE-CHECKOUT AUDIT CHECKS PASSED (100%)      ');
  console.log('====================================================');
  process.exit(0);
}

runAudit().catch((err) => {
  console.error('\nAUDIT FAILED:', err);
  process.exit(1);
});
