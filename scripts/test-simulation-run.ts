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

async function testSimulation() {
  const destinationId = 'ntfset_01m73tkjy55j1sz6287cb8dnsr';

  console.log('Creating simulation on https://sandbox-api.paddle.com/simulations ...');
  const simRes = await fetch('https://sandbox-api.paddle.com/simulations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notification_setting_id: destinationId,
      name: 'E2E Starter Checkout Scenario',
      type: 'subscription_creation',
    }),
  });

  const simData = await simRes.json();
  console.log('Create Simulation Status:', simRes.status);
  console.log('Create Simulation Response:', JSON.stringify(simData, null, 2));

  if (!simRes.ok) {
    process.exit(1);
  }

  const simId = simData.data.id;
  console.log(`\nTriggering simulation run for ${simId} ...`);
  const runRes = await fetch(`https://sandbox-api.paddle.com/simulations/${simId}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const runData = await runRes.json();
  console.log('Run Simulation Status:', runRes.status);
  console.log('Run Simulation Response:', JSON.stringify(runData, null, 2));

  process.exit(0);
}

testSimulation().catch((err) => {
  console.error(err);
  process.exit(1);
});
