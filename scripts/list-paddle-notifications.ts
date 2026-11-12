import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key: string): string {
  const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');

async function listNotifications() {
  const r = await fetch('https://sandbox-api.paddle.com/notifications?per_page=10', {
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}` }
  });
  const data = await r.json();
  console.log('Notifications count:', data.data?.length);
  for (const n of (data.data || [])) {
    console.log(`- ID: ${n.id} | Type: ${n.type} | Status: ${n.status} | Destination: ${n.notification_setting_id} | Delivered: ${n.delivered_at}`);
  }
  process.exit(0);
}

listNotifications().catch((err) => {
  console.error(err);
  process.exit(1);
});
