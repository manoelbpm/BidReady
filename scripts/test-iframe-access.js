const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = 'C:\\Users\\PC\\AppData\\Local\\Temp\\edge_paddle_test_' + Date.now();

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--user-data-dir=' + profileDir,
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1440,1080'
  ]);

  proc.stderr.on('data', () => {});
  await sleep(2500);

  const newTab = await fetch('http://127.0.0.1:9223/json/new?http://localhost:3000/pricing?orgId=e2e00000-0000-4000-a000-000000000010', { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(newTab.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    const handler = (msg) => {
      const d = JSON.parse(msg.data);
      if (d.id === curId) {
        ws.removeEventListener('message', handler);
        if (d.error) reject(d.error);
        else resolve(d.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await sleep(3500);

  // Click Starter
  console.log('Clicking Starter button...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const starter = btns.find(b => b.innerText.includes('Starter'));
        if (starter) starter.click();
      })()
    `
  });

  await sleep(4000);

  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        if (!f) return 'No paddle iframe found';
        try {
          const doc = f.contentDocument || f.contentWindow.document;
          if (!doc) return 'No contentDocument (null)';
          const inputs = Array.from(doc.querySelectorAll('input')).map(i => ({
            name: i.name,
            id: i.id,
            placeholder: i.placeholder,
            type: i.type,
            className: i.className
          }));
          const buttons = Array.from(doc.querySelectorAll('button')).map(b => b.innerText.trim());
          const text = doc.body.innerText.slice(0, 300);
          return { inputs, buttons, text };
        } catch (e) {
          return 'Cross-origin exception: ' + e.message;
        }
      })()
    `,
    returnByValue: true
  });

  console.log('Iframe access evaluation:', JSON.stringify(res.result.value, null, 2));

  // Also check if CDP Target domain can attach to iframe target
  const targets = await send('Target.getTargets');
  console.log('CDP Targets from Target.getTargets:', targets.targetInfos.map(t => ({ type: t.type, url: t.url.slice(0, 80) })));

  ws.close();
  proc.kill();
}

run().catch(console.error);
