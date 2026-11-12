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

async function testTxn() {
  console.log('Testing transaction creation on https://sandbox-api.paddle.com/transactions ...');
  const res = await fetch('https://sandbox-api.paddle.com/transactions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ price_id: STARTER_PRICE, quantity: 1 }],
      custom_data: {
        organization_id: 'e2e00000-0000-4000-a000-000000000001',
        plan_id: 'starter',
      },
    }),
  });

  const json = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Transaction ID:', json.data?.id);
  console.log('Status:', json.data?.status);
  console.log('Checkout URL:', json.data?.checkout?.url);
  process.exit(0);
}

testTxn().catch((err) => {
  console.error(err);
  process.exit(1);
});
