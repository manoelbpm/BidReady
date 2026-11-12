import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
function getEnv(key: string): string {
  const line = envContent.split('\n').find(l => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const PADDLE_WEBHOOK_SECRET = getEnv('PADDLE_WEBHOOK_SECRET');
const APP_URL = 'http://localhost:3000';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function signPaddleWebhook(rawBody: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${ts}:${rawBody}`);
  const h1 = hmac.digest('hex');
  return `ts=${ts};h1=${h1}`;
}

async function runDeliveryAndVerification() {
  console.log('================================================================');
  console.log('   BIDREADY M4.14.3.7 — WEBHOOK DELIVERY & IDEMPOTENCY CHECK    ');
  console.log('================================================================\n');

  // Load the real event from Paddle Sandbox
  const eventPayload = {
    event_id: 'evt_01m745bvxwxb8dmjfbwmy25kqb',
    event_type: 'subscription.activated',
    occurred_at: '2026-11-11T02:00:37.564807Z',
    data: {
      id: 'sub_01m745bvsvg78gcye75msxkx04',
      status: 'active',
      customer_id: 'ctm_01m745bfz0xa5a083jfdmfqg3a',
      address_id: 'add_01m745bj2vm9tgkanr33k6e35p',
      business_id: null,
      currency_code: 'USD',
      created_at: '2026-11-11T02:00:37.435Z',
      updated_at: '2026-11-11T02:00:37.435Z',
      started_at: '2026-11-11T02:00:36.81526Z',
      first_billed_at: '2026-11-11T02:00:36.81526Z',
      next_billed_at: '2026-12-11T02:00:36.81526Z',
      paused_at: null,
      canceled_at: null,
      discount: null,
      collection_mode: 'automatic',
      billing_details: null,
      current_billing_period: {
        ends_at: '2026-12-11T02:00:36.81526Z',
        starts_at: '2026-11-11T02:00:36.81526Z'
      },
      billing_cycle: {
        interval: 'month',
        frequency: 1
      },
      scheduled_change: null,
      items: [
        {
          price: {
            id: 'pri_01m73t7nhv4rwj634cwpaw3hec',
            name: null,
            type: 'standard',
            status: 'active',
            product_id: 'pro_01m73t7nbrgefdf099rkm3vzfe',
            unit_price: {
              amount: '2900',
              currency_code: 'USD'
            },
            billing_cycle: {
              interval: 'month',
              frequency: 1
            }
          },
          status: 'active',
          product: {
            id: 'pro_01m73t7nbrgefdf099rkm3vzfe',
            name: 'BidReady Starter',
            type: 'standard',
            status: 'active'
          },
          quantity: 1,
          recurring: true
        }
      ],
      custom_data: {
        plan_id: 'starter',
        intent_id: 'intent_1794362424385_f7b53cfefa1c43a581dc1e627807da84',
        authorized_at: '2026-11-11T02:00:23.738Z',
        organization_id: 'e2e00000-0000-4000-a000-000000000040',
        authorized_by_user_id: 'f8936e3d-49d9-4c64-8941-888c76b53f66'
      }
    }
  };

  const rawBody = JSON.stringify(eventPayload);
  const signature = signPaddleWebhook(rawBody, PADDLE_WEBHOOK_SECRET);

  console.log('[1/4] Sending Native Webhook to /api/billing/webhook with HMAC signature...');
  const res1 = await fetch(`${APP_URL}/api/billing/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signature,
    },
    body: rawBody,
  });

  const body1 = await res1.json();
  console.log(`  Response Status: ${res1.status}`);
  console.log(`  Response Body:`, JSON.stringify(body1, null, 2));

  if (!res1.ok || !body1.success || body1.duplicate !== false) {
    throw new Error(`First webhook delivery failed: ${JSON.stringify(body1)}`);
  }
  console.log('  ✓ Webhook accepted and processed successfully!');

  // 2. Verify Supabase State
  console.log('\n[2/4] Verifying Supabase Intent & Subscription State...');
  const { data: intentData, error: intentErr } = await adminClient
    .from('checkout_intents')
    .select('*')
    .eq('intent_token', 'intent_1794362424385_f7b53cfefa1c43a581dc1e627807da84')
    .single();

  if (intentErr || !intentData) {
    throw new Error(`Failed to query intent: ${intentErr?.message}`);
  }

  console.log('  Checkout Intent State:');
  console.log(`    ID: ${intentData.id}`);
  console.log(`    Status: ${intentData.status} (Expected: consumed)`);
  console.log(`    Consumed By Sub ID: ${intentData.consumed_by_provider_sub_id}`);
  console.log(`    Consumed At: ${intentData.consumed_at}`);

  if (intentData.status !== 'consumed' || intentData.consumed_by_provider_sub_id !== 'sub_01m745bvsvg78gcye75msxkx04') {
    throw new Error(`Intent state assertion failed: status=${intentData.status}, subId=${intentData.consumed_by_provider_sub_id}`);
  }
  console.log('  ✓ Intent successfully and atomically transitioned to consumed!');

  const { data: subData, error: subErr } = await adminClient
    .from('saas_subscriptions')
    .select('*')
    .eq('organization_id', 'e2e00000-0000-4000-a000-000000000040')
    .single();

  if (subErr || !subData) {
    throw new Error(`Failed to query subscription: ${subErr?.message}`);
  }

  console.log('\n  SaaS Subscription State:');
  console.log(`    Organization ID: ${subData.organization_id}`);
  console.log(`    Plan: ${subData.plan} (Expected: starter)`);
  console.log(`    Status: ${subData.status} (Expected: active)`);
  console.log(`    Monthly Analyses Limit: ${subData.monthly_analyses_limit} (Expected: 10)`);
  console.log(`    Provider Subscription ID: ${subData.provider_subscription_id}`);
  console.log(`    Provider Customer ID: ${subData.provider_customer_id}`);

  if (
    subData.plan !== 'starter' ||
    subData.status !== 'active' ||
    subData.monthly_analyses_limit !== 10 ||
    subData.provider_subscription_id !== 'sub_01m745bvsvg78gcye75msxkx04'
  ) {
    throw new Error(`Subscription assertion failed: ${JSON.stringify(subData)}`);
  }
  console.log('  ✓ SaaS Subscription verified and bound exclusively to target organization!');

  // 3. Test Idempotency with Duplicate Webhook
  console.log('\n[3/4] Testing Webhook Idempotency by Re-sending Same Event...');
  const res2 = await fetch(`${APP_URL}/api/billing/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': signature,
    },
    body: rawBody,
  });

  const body2 = await res2.json();
  console.log(`  Duplicate Response Status: ${res2.status}`);
  console.log(`  Duplicate Response Body:`, JSON.stringify(body2, null, 2));

  if (!res2.ok || !body2.success || body2.duplicate !== true) {
    throw new Error(`Idempotency verification failed: ${JSON.stringify(body2)}`);
  }
  console.log('  ✓ Webhook idempotency confirmed (duplicate: true)!');

  // 4. Verify Pricing Page shows Active Starter Plan
  console.log('\n[4/4] Verifying Subscription API endpoint for Test Organization...');
  const subApiRes = await fetch(`${APP_URL}/api/billing/subscription?orgId=e2e00000-0000-4000-a000-000000000040`);
  const subApiBody = await subApiRes.json();
  console.log('  Subscription API response:', JSON.stringify(subApiBody, null, 2));

  if (subApiBody.subscription?.planId !== 'starter' || subApiBody.quota?.limit !== 10) {
    throw new Error(`Subscription API verification failed: ${JSON.stringify(subApiBody)}`);
  }
  console.log('  ✓ Subscription API reports plan=starter, limit=10 analyses!');

  console.log('\n================================================================');
  console.log('   M4.14.3.7 ETAPA 3 VERIFICATION COMPLETE: ALL CHECKS PASSED   ');
  console.log('================================================================');
}

runDeliveryAndVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
