const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = `C:\\Users\\PC\\AppData\\Local\\Temp\\edge_paddle_diag_${Date.now()}`;
const artifactsDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\658b3dc9-76af-4ca9-867a-b773142bfee2\\screenshots_m41432';

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('--- Launching Edge with CDP & Web Security Disabled ---');
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1440,1080'
  ]);

  proc.stderr.on('data', () => {});

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        break;
      }
    } catch {}
  }

  // Open pricing page with Starter org
  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:3000/pricing?orgId=e2e00000-0000-4000-a000-000000000010', {
    method: 'PUT'
  });
  const tab = await newTabRes.json();
  wsUrl = tab.webSocketDebuggerUrl;
  console.log('Connected to tab:', wsUrl);

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    const msgId = id++;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) p.reject(data.error);
      else p.resolve(data.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');
  await send('Target.setDiscoverTargets', { discover: true });

  console.log('Waiting for page load and Paddle.js initialization...');
  await sleep(4000);

  // Take screenshot of pricing page
  const scr1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactsDir, '01_starter_pricing_loaded.png'), Buffer.from(scr1.data, 'base64'));
  console.log('Screenshot saved: 01_starter_pricing_loaded.png');

  // Check Paddle readiness in window
  const paddleStatus = await send('Runtime.evaluate', {
    expression: 'Boolean(window.Paddle && window.Paddle.Checkout)',
    returnByValue: true
  });
  console.log('Paddle object available on page:', paddleStatus.result.value);

  // Click on Starter Upgrade button
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find Starter card button
        const buttons = Array.from(document.querySelectorAll('button'));
        const starterBtn = buttons.find(b => b.textContent.includes('Starter') || b.closest('[data-plan="starter"]') || b.innerText.includes('Upgrade to Starter') || b.innerText.includes('Select Starter'));
        if (starterBtn) {
          starterBtn.click();
          return 'Clicked button: ' + starterBtn.innerText;
        }
        // Try any button in Starter column
        const allPlanBtns = document.querySelectorAll('button');
        for (const b of allPlanBtns) {
          if (b.innerText.toLowerCase().includes('starter')) {
            b.click();
            return 'Clicked: ' + b.innerText;
          }
        }
        return 'No Starter button found. Found buttons: ' + Array.from(allPlanBtns).map(b => b.innerText.trim()).filter(Boolean).join(', ');
      })()
    `,
    returnByValue: true
  });
  console.log('Click result:', clickRes.result.value);

  await sleep(4000);

  // Take screenshot of overlay
  const scr2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactsDir, '02_starter_checkout_overlay.png'), Buffer.from(scr2.data, 'base64'));
  console.log('Screenshot saved: 02_starter_checkout_overlay.png');

  // Inspect frames / iframes in DOM
  const iframesInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const frames = Array.from(document.querySelectorAll('iframe'));
        return frames.map(f => ({
          name: f.name,
          src: f.src,
          className: f.className,
          id: f.id,
          style: f.getAttribute('style')
        }));
      })()
    `,
    returnByValue: true
  });
  console.log('Detected iframes on page:', JSON.stringify(iframesInfo.result.value, null, 2));

  // Check all targets discovered by CDP
  const targetsRes = await fetch('http://127.0.0.1:9222/json/list');
  const targets = await targetsRes.json();
  console.log('Discovered CDP targets:', targets.map(t => ({ type: t.type, title: t.title, url: t.url })));

  ws.close();
  proc.kill();
  console.log('--- Diagnostic Complete ---');
}

run().catch(e => console.error('Error:', e));
