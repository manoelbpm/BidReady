const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = 'C:\\Users\\PC\\AppData\\Local\\Temp\\edge_paddle_step2_' + Date.now();

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--user-data-dir=' + profileDir,
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1440,1080'
  ]);

  proc.stderr.on('data', () => {});
  await sleep(2500);

  const newTab = await fetch('http://127.0.0.1:9224/json/new?http://localhost:3000/pricing?orgId=e2e00000-0000-4000-a000-000000000010', { method: 'PUT' }).then(r => r.json());
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

  await sleep(3500);

  // In iframe: check email and click "Continuar"
  const step1 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const emailInput = doc.querySelector('input[type="email"]') || doc.querySelector('#email');
        if (emailInput && !emailInput.value) {
          emailInput.value = 'billing-sandbox@bidready.ai';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const btns = Array.from(doc.querySelectorAll('button'));
        const continueBtn = btns.find(b => b.innerText.trim().toLowerCase().includes('continuar') || b.innerText.trim().toLowerCase().includes('continue'));
        if (continueBtn) {
          continueBtn.click();
          return 'Clicked continue button: ' + continueBtn.innerText;
        }
        return 'Continue button not found. Buttons: ' + btns.map(b => b.innerText).join(', ');
      })()
    `,
    returnByValue: true
  });
  console.log('Step 1 result:', step1.result.value);

  await sleep(4000);

  // Inspect payment inputs after clicking Continuar
  const step2 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const inputs = Array.from(doc.querySelectorAll('input')).map(i => ({
          name: i.name,
          id: i.id,
          placeholder: i.placeholder,
          type: i.type,
          className: i.className,
          autocomplete: i.getAttribute('autocomplete'),
          ariaLabel: i.getAttribute('aria-label')
        }));
        const innerIframes = Array.from(doc.querySelectorAll('iframe')).map(ifrm => ({
          name: ifrm.name,
          src: ifrm.src,
          id: ifrm.id
        }));
        const buttons = Array.from(doc.querySelectorAll('button')).map(b => b.innerText.trim());
        const text = doc.body.innerText.slice(0, 400);
        return { inputs, innerIframes, buttons, text };
      })()
    `,
    returnByValue: true
  });
  console.log('Step 2 result:', JSON.stringify(step2.result.value, null, 2));

  ws.close();
  proc.kill();
}

run().catch(console.error);
