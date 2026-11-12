import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');
const STARTER_PRICE = getEnv('NEXT_PUBLIC_PADDLE_PRICE_STARTER');
const DESTINATION_ID = 'ntfset_01m73tkjy55j1sz6287cb8dnsr';
const ORG_ID = 'e2e00000-0000-4000-a000-000000000001';

async function testSingleEvent() {
  const subId = `sub_01m73t7nbrgefdf099rkm3vzfe`;
  const customerId = `ctm_01m73t7nbrgefdf099rkm3vzfe`;
  console.log(`Creating single event simulation for ${subId} (Starter $29)...`);

  const simRes = await fetch('https://sandbox-api.paddle.com/simulations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notification_setting_id: DESTINATION_ID,
      name: `Starter Subscription Activated [${Date.now()}]`,
      type: 'subscription.activated',
      payload: {
        id: subId,
        status: 'active',
        customer_id: customerId,
        custom_data: {
          organization_id: ORG_ID,
          plan_id: 'starter',
        },
        items: [
          {
            price: {
              id: STARTER_PRICE,
            },
            quantity: 1,
          },
        ],
      },
    }),
  });

  const simData = await simRes.json();
  console.log('Create Status:', simRes.status);
  if (!simRes.ok) {
    console.error('Error:', JSON.stringify(simData, null, 2));
    process.exit(1);
  }

  const simId = simData.data.id;
  console.log(`Triggering Paddle cloud simulation run (${simId}) ...`);
  const runRes = await fetch(`https://sandbox-api.paddle.com/simulations/${simId}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const runData = await runRes.json();
  console.log('Run Status:', runRes.status);
  console.log('Run ID:', runData.data?.id);

  // Give Paddle cloud 2 seconds to dispatch webhook
  await new Promise((r) => setTimeout(r, 3000));

  // Check the run event result
  const eventsRes = await fetch(`https://sandbox-api.paddle.com/simulations/${simId}/runs/${runData.data?.id}/events`, {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
  });
  const eventsData = await eventsRes.json();
  console.log('Event Delivery in Paddle:', eventsData.data?.[0]?.status);
  console.log('Response from our Server:', eventsData.data?.[0]?.response);

  process.exit(0);
}

testSingleEvent().catch((err) => {
  console.error(err);
  process.exit(1);
});
