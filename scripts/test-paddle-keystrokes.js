const { spawn } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = 'C:\\Users\\PC\\AppData\\Local\\Temp\\edge_paddle_keystrokes_' + Date.now();

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--user-data-dir=' + profileDir,
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1440,1080'
  ]);

  proc.stderr.on('data', () => {});
  await sleep(2500);

  const newTab = await fetch('http://127.0.0.1:9226/json/new?http://localhost:3000/pricing?orgId=e2e00000-0000-4000-a000-000000000010', { method: 'PUT' }).then(r => r.json());
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

  // Step 1: Continuar
  console.log('2. Continuing to payment step...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const btns = Array.from(doc.querySelectorAll('button'));
        const continueBtn = btns.find(b => b.innerText.trim().toLowerCase().includes('continuar') || b.innerText.trim().toLowerCase().includes('continue'));
        if (continueBtn) continueBtn.click();
      })()
    `
  });

  await sleep(4000);

  // Step 2: Use React-compatible setter + events
  console.log('3. Typing into card fields with React-compatible setter...');
  const fillResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const win = f.contentWindow;

        function setReactInput(el, val) {
          if (!el) return false;
          el.focus();
          const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
          if (setter) {
            setter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new win.Event('input', { bubbles: true }));
          el.dispatchEvent(new win.Event('change', { bubbles: true }));
          el.dispatchEvent(new win.Event('blur', { bubbles: true }));
          return el.value;
        }

        const card = setReactInput(doc.querySelector('#cardNumber'), '4242424242424242');
        const holder = setReactInput(doc.querySelector('#cardHolder'), 'BidReady E2E Starter');
        const exp = setReactInput(doc.querySelector('#expiry'), '12/28');
        const cvv = setReactInput(doc.querySelector('#cvv'), '100');

        return { card, holder, exp, cvv };
      })()
    `,
    returnByValue: true
  });
  console.log('Fields filled:', fillResult.result.value);

  await sleep(1500);

  // Check if inputs have values and validation state
  const stateCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const cardInput = doc.querySelector('#cardNumber');
        const expInput = doc.querySelector('#expiry');
        const cvvInput = doc.querySelector('#cvv');
        const holderInput = doc.querySelector('#cardHolder');
        return {
          cardVal: cardInput?.value,
          expVal: expInput?.value,
          cvvVal: cvvInput?.value,
          holderVal: holderInput?.value,
          errors: Array.from(doc.querySelectorAll('.error, [role=\"alert\"], p')).map(p => p.innerText.trim()).filter(t => t.includes('válido') || t.includes('valid'))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('State check before click:', stateCheck.result.value);

  // Click Assinar agora
  console.log('4. Clicking Assinar agora...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const btns = Array.from(doc.querySelectorAll('button'));
        const subscribeBtn = btns.find(b => 
          b.innerText.trim().toLowerCase().includes('assinar') || 
          b.innerText.trim().toLowerCase().includes('subscribe') ||
          b.innerText.trim().toLowerCase().includes('pagar') ||
          b.innerText.trim().toLowerCase().includes('pay')
        );
        if (subscribeBtn) {
          subscribeBtn.click();
          return 'Clicked: ' + subscribeBtn.innerText;
        }
        return 'Not found';
      })()
    `
  });

  console.log('Waiting 12 seconds for transaction processing...');
  await sleep(12000);

  const afterPay = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        if (!f) return 'Paddle iframe closed or removed';
        const doc = f.contentDocument || f.contentWindow.document;
        return {
          text: doc.body.innerText.slice(0, 600),
          url: f.src
        };
      })()
    `,
    returnByValue: true
  });
  console.log('After pay result:', JSON.stringify(afterPay.result.value, null, 2));

  ws.close();
  proc.kill();
}

run().catch(console.error);
