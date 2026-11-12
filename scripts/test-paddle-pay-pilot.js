const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = 'C:\\Users\\PC\\AppData\\Local\\Temp\\edge_paddle_pay_' + Date.now();

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--user-data-dir=' + profileDir,
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1440,1080'
  ]);

  proc.stderr.on('data', () => {});
  await sleep(2500);

  const newTab = await fetch('http://127.0.0.1:9225/json/new?http://localhost:3000/pricing?orgId=e2e00000-0000-4000-a000-000000000010', { method: 'PUT' }).then(r => r.json());
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

  // Click Starter button
  console.log('1. Clicking Starter button...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const starter = btns.find(b => b.innerText.includes('Starter'));
        if (starter) starter.click();
      })()
    `
  });

  await sleep(3500);

  // Click Continuar
  console.log('2. Clicking Continuar...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const emailInput = doc.querySelector('input[type="email"]') || doc.querySelector('#email');
        if (emailInput && !emailInput.value) {
          emailInput.value = 'billing-starter@bidready.ai';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const btns = Array.from(doc.querySelectorAll('button'));
        const continueBtn = btns.find(b => b.innerText.trim().toLowerCase().includes('continuar') || b.innerText.trim().toLowerCase().includes('continue'));
        if (continueBtn) continueBtn.click();
      })()
    `
  });

  await sleep(4000);

  // Fill Payment details and click Assinar agora
  console.log('3. Filling Payment details...');
  const payResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;

        function setInputValue(selector, value) {
          const el = doc.querySelector(selector);
          if (!el) return false;
          el.focus();
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }

        const cardSet = setInputValue('#cardNumber', '4242 4242 4242 4242');
        const holderSet = setInputValue('#cardHolder', 'BidReady E2E Starter Test');
        const expSet = setInputValue('#expiry', '12/28');
        const cvvSet = setInputValue('#cvv', '100');

        const btns = Array.from(doc.querySelectorAll('button'));
        const subscribeBtn = btns.find(b => 
          b.innerText.trim().toLowerCase().includes('assinar') || 
          b.innerText.trim().toLowerCase().includes('subscribe') ||
          b.innerText.trim().toLowerCase().includes('pagar') ||
          b.innerText.trim().toLowerCase().includes('pay')
        );

        if (subscribeBtn) {
          subscribeBtn.click();
          return { cardSet, holderSet, expSet, cvvSet, clickedBtn: subscribeBtn.innerText.trim() };
        }

        return { cardSet, holderSet, expSet, cvvSet, clickedBtn: false, buttons: btns.map(b => b.innerText.trim()) };
      })()
    `,
    returnByValue: true
  });

  console.log('Payment form result:', JSON.stringify(payResult.result.value, null, 2));

  // Wait for Paddle processing
  console.log('Waiting 10 seconds for Paddle transaction processing...');
  await sleep(10000);

  // Take screenshot of confirmation
  const scr = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  fs.writeFileSync('C:\\Users\\PC\\.gemini\\antigravity\\brain\\658b3dc9-76af-4ca9-867a-b773142bfee2\\screenshots_m41432\\starter_after_pay.png', Buffer.from(scr.data, 'base64'));
  console.log('Saved screenshot: starter_after_pay.png');

  // Check iframe text or body
  const afterText = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        if (!f) return 'Paddle iframe closed or removed';
        const doc = f.contentDocument || f.contentWindow.document;
        return doc.body.innerText.slice(0, 500);
      })()
    `,
    returnByValue: true
  });
  console.log('Iframe content after pay:', afterText.result.value);

  ws.close();
  proc.kill();
}

run().catch(console.error);
