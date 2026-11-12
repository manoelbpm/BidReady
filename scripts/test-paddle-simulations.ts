import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');

async function checkSimulations() {
  console.log('Testing Simulations API on https://sandbox-api.paddle.com/simulation-types ...');
  const res = await fetch('https://sandbox-api.paddle.com/simulation-types', {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', JSON.stringify(data, null, 2));

  console.log('\nTesting GET /simulations ...');
  const resSim = await fetch('https://sandbox-api.paddle.com/simulations', {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
  });
  console.log('Status:', resSim.status);
  const dataSim = await resSim.json();
  console.log('Data:', JSON.stringify(dataSim, null, 2));

  process.exit(0);
}

checkSimulations().catch((err) => {
  console.error(err);
  process.exit(1);
});
