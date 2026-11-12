import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');

async function checkTrafficSource() {
  const listRes = await fetch('https://sandbox-api.paddle.com/notification-settings', {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
  });
  const listData = await listRes.json();
  const setting = listData.data[0];
  console.log('Current destination:', setting.id, 'traffic_source:', setting.traffic_source);

  if (setting.traffic_source !== 'all') {
    console.log('Updating traffic_source to "all" ...');
    const patchRes = await fetch(`https://sandbox-api.paddle.com/notification-settings/${setting.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        traffic_source: 'all',
      }),
    });
    const patchData = await patchRes.json();
    console.log('PATCH Status:', patchRes.status);
    console.log('Updated traffic_source:', patchData.data?.traffic_source);
  }
  process.exit(0);
}

checkTrafficSource().catch((err) => {
  console.error(err);
  process.exit(1);
});
