import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

async function revalidatePaddle() {
  loadEnv();

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    console.error('Missing PADDLE_API_KEY in .env.local');
    process.exit(1);
  }

  const subId = 'sub_01m73xm9cymfwkbawkcvb19br7';
  console.log(`Querying Paddle Sandbox API for subscription ${subId}...`);

  const res = await fetch(`https://sandbox-api.paddle.com/subscriptions/${subId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    console.error(`HTTP error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const subData = await res.json();
  const sub = subData.data;

  console.log('\n--- LIVE PADDLE SANDBOX SUBSCRIPTION DATA ---');
  console.log(`Subscription ID:        ${sub.id}`);
  console.log(`Customer ID:            ${sub.customer_id}`);
  console.log(`Status:                 ${sub.status}`);
  console.log(`Product ID:             ${sub.items?.[0]?.price?.product_id}`);
  console.log(`Price ID:               ${sub.items?.[0]?.price?.id}`);
  console.log(`Organization ID:        ${sub.custom_data?.organization_id}`);
  console.log(`Billing Period Start:   ${sub.current_billing_period?.starts_at}`);
  console.log(`Billing Period End:     ${sub.current_billing_period?.ends_at}`);
  console.log(`Created At:             ${sub.created_at}`);
  console.log(`Started At:             ${sub.started_at}`);
  console.log(`First Billed At:        ${sub.first_billed_at}`);
  console.log(`Next Billed At:         ${sub.next_billed_at}`);
}

revalidatePaddle().catch(console.error);
