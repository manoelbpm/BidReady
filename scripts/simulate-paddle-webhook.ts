import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

async function sendSimulatedWebhook() {
  // Read secret from .env.local without exposing it
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/PADDLE_WEBHOOK_SECRET=(.+)/);

  if (!match || !match[1]) {
    console.error('Error: PADDLE_WEBHOOK_SECRET not found in .env.local');
    process.exit(1);
  }

  const webhookSecret = match[1].trim();
  const tunnelUrl = 'https://mating-fabulous-alive-bali.trycloudflare.com/api/billing/webhook';

  // Construct official Paddle customer.created event payload
  const eventPayload = {
    event_id: `evt_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    event_type: 'customer.created',
    occurred_at: new Date().toISOString(),
    data: {
      id: `ctm_sim_${Date.now()}`,
      name: 'Global Aerospace Systems Inc',
      email: 'billing-demo@globalaerospace.com',
      status: 'active',
      locale: 'en',
    },
  };

  const rawBody = JSON.stringify(eventPayload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
  const signatureHeader = `ts=${timestamp};h1=${h1}`;

  console.log(`[DISPATCH] Target endpoint via Cloudflare Tunnel: ${tunnelUrl}`);
  console.log(`[DISPATCH] Event Type: ${eventPayload.event_type}`);
  console.log(`[DISPATCH] Event ID: ${eventPayload.event_id}`);
  console.log(`[DISPATCH] Generated Timestamp (ts): ${timestamp}`);
  console.log(`[DISPATCH] Signature Header format: ts=${timestamp};h1=[64-hex-digest]`);

  const startTime = Date.now();
  const response = await fetch(tunnelUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Paddle-Signature': signatureHeader,
    },
    body: rawBody,
  });

  const durationMs = Date.now() - startTime;
  const status = response.status;
  const responseData = await response.json();

  console.log(`[RESULT] HTTP Status: ${status} in ${durationMs}ms`);
  console.log(`[RESULT] Response Body:`, JSON.stringify(responseData, null, 2));

  if (status === 200 && responseData.received) {
    console.log('[SUCCESS] Webhook delivered through public internet tunnel and authenticated successfully!');
  } else {
    console.error('[FAILURE] Webhook rejected or failed.');
  }
}

sendSimulatedWebhook().catch((err) => {
  console.error('[ERROR] Dispatch failed:', err.message);
});
