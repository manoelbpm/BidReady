const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const defaultProfile = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('--- CHECKING PADDLE SANDBOX ACCESS IN EDGE DEFAULT PROFILE ---');
  console.log(`Profile: ${defaultProfile}`);

  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${defaultProfile}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
  ]);

  proc.stderr.on('data', () => {});

  let wsUrl = '';
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const json = await res.json();
        console.log(`Connected to Edge (${json.Browser}) via CDP.`);
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    const tabsRes = await fetch('http://127.0.0.1:9222/json/new?https://sandbox-vendors.paddle.com', {
      method: 'PUT',
    });
    const tab = await tabsRes.json();
    wsUrl = tab.webSocketDebuggerUrl;
  }

  console.log(`Target Page WebSocket: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  let messageId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    const id = messageId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject, method } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(`[${method}] ${data.error.message}`));
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('Waiting for navigation to https://sandbox-vendors.paddle.com ...');
  await sleep(5000);

  const evalResult = await send('Runtime.evaluate', {
    expression: `({
      url: window.location.href,
      title: document.title,
      bodyTextSnippet: document.body ? document.body.innerText.slice(0, 300) : ''
    })`,
    returnByValue: true,
  });

  console.log('Result:', evalResult.result.value);

  ws.close();
  proc.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
