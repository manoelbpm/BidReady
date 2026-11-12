import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');

async function checkRun() {
  const r = await fetch('https://sandbox-api.paddle.com/simulations/ntfsim_01m73vqw4m125jvccz4wsjadye/runs/ntfsimrun_01m73vqwf47bfqgejy7rm67emq', {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` }
  });
  const data = await r.json();
  console.log('Run details:', JSON.stringify(data, null, 2));
  process.exit(0);
}

checkRun().catch((err) => {
  console.error(err);
  process.exit(1);
});
