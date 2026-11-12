import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');
const OLD_SECRET = getEnv('PADDLE_WEBHOOK_SECRET');
const BASE_URL = 'https://sandbox-api.paddle.com';

if (!PADDLE_API_KEY || !PADDLE_API_KEY.startsWith('pdl_sdbx_apikey_')) {
  console.error('CRITICAL: Valid PADDLE_API_KEY not found in .env.local');
  process.exit(1);
}

async function request(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function main() {
  console.log('=== PADDLE SANDBOX WEBHOOK SECRET ROTATION ===');

  // 1. List existing notification settings
  console.log('\n[1] Listing existing notification settings from Paddle Sandbox...');
  const listRes = await request('/notification-settings');
  console.log(`HTTP Status: ${listRes.status}`);

  if (!listRes.ok) {
    console.error('Failed to query notification settings:', listRes.data);
    process.exit(1);
  }

  const existingSettings: any[] = listRes.data?.data || [];
  console.log(`Found ${existingSettings.length} existing notification destination(s):`);
  if (existingSettings.length > 0) {
    console.log('Sample existing destination details:', JSON.stringify(existingSettings[0], null, 2));
  }

  // 2. Query event types supported by Paddle
  const eventTypesRes = await request('/event-types');
  const allEvents: any[] = eventTypesRes.data?.data || [];
  const requiredEventNames = [
    'subscription.created',
    'subscription.updated',
    'subscription.canceled',
    'subscription.paused',
    'subscription.resumed',
    'subscription.activated',
    'subscription.past_due',
    'transaction.completed',
    'transaction.paid',
    'payment.failed',
  ];

  const matchedEvents = allEvents
    .filter((e) => requiredEventNames.includes(e.name))
    .map((e) => ({
      name: e.name,
      description: e.description,
    }));

  console.log(`\nSubscribing to ${matchedEvents.length} core billing events:`);
  for (const e of matchedEvents) {
    console.log(`  ✓ ${e.name}`);
  }

  // 3. Delete old/compromised destination first to allow recreating with the same URL
  console.log('\n[2] Decommissioning compromised notification destination(s)...');
  for (const old of existingSettings) {
    console.log(`Deleting compromised destination ${old.id} ("${old.description}")...`);
    const delRes = await request(`/notification-settings/${old.id}`, {
      method: 'DELETE',
    });
    console.log(`  Status: ${delRes.status} (${delRes.ok ? 'Deleted' : 'Failed'})`);
  }

  // 4. Create fresh, uncompromised webhook destination
  const existingUrl = existingSettings[0]?.destination || 'https://mating-fabulous-alive-bali.trycloudflare.com/api/billing/webhook';
  const webhookUrl = existingUrl;
  const newDescription = `BidReady Sandbox Webhook [Rotated ${new Date().toISOString().slice(0, 10)}]`;
  const eventNames = matchedEvents.map((e) => e.name);

  console.log(`\n[3] Creating fresh destination "${newDescription}" pointing to ${webhookUrl}...`);
  const createRes = await request('/notification-settings', {
    method: 'POST',
    body: JSON.stringify({
      description: newDescription,
      destination: webhookUrl,
      type: 'url',
      subscribed_events: eventNames,
      active: true,
    }),
  });

  if (!createRes.ok) {
    console.error('Failed to create fresh notification destination:', JSON.stringify(createRes.data, null, 2));
    process.exit(1);
  }

  const newSetting = createRes.data?.data;
  const newSecret = newSetting?.endpoint_secret_key;

  if (!newSecret || !newSecret.startsWith('pdl_ntfset_')) {
    console.error('Error: Paddle did not return a valid endpoint_secret_key.');
    process.exit(1);
  }

  console.log(`✓ Fresh destination created successfully! (ID: ${newSetting.id})`);
  console.log(`✓ Fresh signing secret generated (Length: ${newSecret.length}, Valid Prefix: true).`);

  // 5. Update .env.local with new secret WITHOUT printing the secret to terminal
  console.log('\n[4] Safely updating PADDLE_WEBHOOK_SECRET in .env.local...');
  let updatedEnv = fs.readFileSync(envPath, 'utf-8');
  const secretRegex = /^PADDLE_WEBHOOK_SECRET=.*$/m;
  if (secretRegex.test(updatedEnv)) {
    updatedEnv = updatedEnv.replace(secretRegex, `PADDLE_WEBHOOK_SECRET=${newSecret}`);
  } else {
    updatedEnv += `\nPADDLE_WEBHOOK_SECRET=${newSecret}`;
  }
  fs.writeFileSync(envPath, updatedEnv);
  console.log('✓ .env.local updated with the rotated secret.');

  // 6. Save rotation metadata (IDs and masked properties only, NEVER secrets)
  fs.writeFileSync('scripts/webhook_rotation_meta.json', JSON.stringify({
    rotatedAt: new Date().toISOString(),
    oldDestinationId: existingSettings[0]?.id || null,
    newDestinationId: newSetting.id,
    newDestinationUrl: webhookUrl,
    activeEventsCount: eventNames.length,
    subscribedEvents: eventNames,
    secretLength: newSecret.length,
    secretPrefix: newSecret.slice(0, 11),
  }, null, 2));

  console.log('\n=== WEBHOOK SECRET ROTATION COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Rotation Error:', err);
  process.exit(1);
});
