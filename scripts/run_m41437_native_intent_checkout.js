const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
function getEnv(key) {
  const line = envContent.split('\n').find(l => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');
const PADDLE_WEBHOOK_SECRET = getEnv('PADDLE_WEBHOOK_SECRET');
const STARTER_PRICE = getEnv('NEXT_PUBLIC_PADDLE_PRICE_STARTER');
const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = `C:\\Users\\PC\\AppData\\Local\\Temp\\edge_m41437_${Date.now()}`;
const artifactsDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\658b3dc9-76af-4ca9-867a-b773142bfee2\\screenshots_m41437';

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function paddleApi(endpoint) {
  const res = await fetch(`https://sandbox-api.paddle.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json().catch(() => ({}));
}

function signWebhook(rawBody, secret) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${ts}:${rawBody}`);
  const h1 = hmac.digest('hex');
  return `ts=${ts};h1=${h1}`;
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pending.has(data.id)) {
        const p = this.pending.get(data.id);
        this.pending.delete(data.id);
        clearTimeout(p.timer);
        if (data.error) p.reject(new Error(`[${p.method}] ${data.error.message}`));
        else p.resolve(data.result);
      }
    };
    await new Promise((r, rej) => {
      this.ws.onopen = r;
      this.ws.onerror = rej;
    });
  }

  send(method, params = {}, timeoutMs = 25000) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`[${method}] timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, method, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = path.join(artifactsDir, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`     📸 Screenshot saved: ${filename}`);
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function main() {
  console.log('================================================================');
  console.log('   BIDREADY M4.14.3.7 — ETAPA 3: NATIVE INTENT CHECKOUT E2E   ');
  console.log('   Exclusively Paddle Sandbox — Real Interactive Purchase     ');
  console.log('================================================================\n');

  const testOrgId = 'e2e00000-0000-4000-a000-000000000040';
  const testOrgName = 'BidReady Native Intent Test';
  const planId = 'starter';
  const priceId = STARTER_PRICE;
  const billingEmail = 'billing-intent-test@bidready.ai';

  console.log(`[TARGET CONFIG]`);
  console.log(`  Organization: ${testOrgName} (${testOrgId})`);
  console.log(`  Plan: ${planId} ($29/mo -> 10 quota)`);
  console.log(`  Price ID: ${priceId}`);
  console.log(`  Test Card: 4242 4242 4242 4242 | 12/28 | 100\n`);

  // 1. Launch Browser
  console.log('[1/6] Launching Edge Browser with Remote Debugging...');
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9229',
    `--user-data-dir=${profileDir}`,
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1440,1080',
  ]);
  proc.stderr.on('data', () => {});
  await sleep(3000);

  // 2. Authenticate
  console.log('[2/6] Authenticating as test persona analyst@bidready.com...');
  const loginTab = await fetch('http://127.0.0.1:9229/json/new?http://localhost:3000/login', { method: 'PUT' }).then(r => r.json());
  const loginClient = new CDPClient(loginTab.webSocketDebuggerUrl);
  await loginClient.connect();
  await loginClient.send('Page.enable');
  await loginClient.send('Runtime.enable');
  await sleep(2000);

  await loginClient.evaluate(`
    const emailInput = document.querySelector('input[type="email"]');
    const pwdInput = document.querySelector('input[type="password"]');
    if (emailInput && pwdInput) {
      emailInput.value = 'analyst@bidready.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwdInput.value = 'SuperSecret2026!';
      pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  `);

  for (let i = 0; i < 15; i++) {
    await sleep(600);
    const url = await loginClient.evaluate('window.location.href');
    if (url && !url.includes('/login')) {
      console.log(`  ✓ Authenticated successfully! Current URL: ${url}`);
      break;
    }
  }
  await loginClient.captureScreenshot('01_auth_success.png');
  loginClient.close();

  // 3. Open Pricing page with testOrgId
  console.log(`\n[3/6] Opening /pricing?orgId=${testOrgId}...`);
  const pricingTab = await fetch(`http://127.0.0.1:9229/json/new?http://localhost:3000/pricing?orgId=${testOrgId}`, { method: 'PUT' }).then(r => r.json());
  const client = new CDPClient(pricingTab.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  let paddleLoaded = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    paddleLoaded = await client.evaluate('Boolean(window.Paddle && window.Paddle.Checkout)');
    if (paddleLoaded) break;
  }
  console.log(`  ✓ Paddle.js Sandbox loaded: ${paddleLoaded}`);
  await client.captureScreenshot('02_pricing_page.png');

  // 4. Click Starter button to trigger /api/billing/checkout and open Paddle overlay
  console.log('\n[4/6] Selecting Starter plan to initiate checkout intent & open overlay...');
  const clickResult = await client.evaluate(`
    (() => {
      const btn = document.querySelector('button[data-testid="select-plan-starter"]');
      if (btn) {
        btn.click();
        return 'Clicked button via data-testid';
      }
      const allBtns = Array.from(document.querySelectorAll('button'));
      const match = allBtns.find(b => b.innerText.includes('Starter'));
      if (match) {
        match.click();
        return 'Clicked button via text match: ' + match.innerText;
      }
      return 'Button not found';
    })()
  `);
  console.log(`  ✓ Plan button click: ${clickResult}`);

  // Wait for Paddle iframe
  let iframeOpened = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const hasIframe = await client.evaluate('Boolean(document.querySelector("iframe.paddle-frame"))');
    if (hasIframe) {
      iframeOpened = true;
      break;
    }
  }
  if (!iframeOpened) {
    throw new Error('Paddle checkout overlay failed to open');
  }
  console.log('  ✓ Paddle checkout iframe overlay opened successfully!');
  await sleep(2500);
  await client.captureScreenshot('03_checkout_step1_details.png');

  // 5. Fill Step 1 email and continue
  console.log('\n[5/6] Filling buyer email and test credit card...');
  await client.evaluate(`
    (() => {
      const f = document.querySelector('iframe.paddle-frame');
      const doc = f.contentDocument || f.contentWindow.document;
      const win = f.contentWindow;

      const emailInput = doc.querySelector('input[type="email"]') || doc.querySelector('#email');
      if (emailInput && (!emailInput.value || emailInput.value.trim() === '')) {
        emailInput.focus();
        const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(emailInput, '${billingEmail}');
        else emailInput.value = '${billingEmail}';
        emailInput.dispatchEvent(new win.Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new win.Event('change', { bubbles: true }));
      }

      const btns = Array.from(doc.querySelectorAll('button'));
      const continueBtn = btns.find(b => 
        b.innerText.trim().toLowerCase().includes('continuar') || 
        b.innerText.trim().toLowerCase().includes('continue')
      );
      if (continueBtn) continueBtn.click();
    })()
  `);

  // Wait for Step 2 payment inputs
  await sleep(4000);
  const fillResult = await client.evaluate(`
    (() => {
      const f = document.querySelector('iframe.paddle-frame');
      const doc = f.contentDocument || f.contentWindow.document;
      const win = f.contentWindow;

      function setReactInput(el, val) {
        if (!el) return false;
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new win.Event('input', { bubbles: true }));
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
        el.dispatchEvent(new win.Event('blur', { bubbles: true }));
        return el.value;
      }

      const card = setReactInput(doc.querySelector('#cardNumber'), '4242424242424242');
      const holder = setReactInput(doc.querySelector('#cardHolder'), '${testOrgName}');
      const exp = setReactInput(doc.querySelector('#expiry'), '12/28');
      const cvv = setReactInput(doc.querySelector('#cvv'), '100');

      return { card, holder, exp, cvv };
    })()
  `);
  console.log(`  ✓ Card fields populated:`, fillResult);
  await sleep(1500);
  await client.captureScreenshot('04_checkout_step2_payment_filled.png');

  // Click pay / subscribe
  console.log('  Submitting payment transaction...');
  await client.evaluate(`
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
      if (subscribeBtn) subscribeBtn.click();
    })()
  `);

  // Wait for confirmation
  let confirmed = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const confirmationText = await client.evaluate(`
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        if (!f) return '';
        const doc = f.contentDocument || f.contentWindow.document;
        return doc ? doc.body.innerText : '';
      })()
    `);
    if (
      confirmationText.includes('sucesso') || 
      confirmationText.includes('success') || 
      confirmationText.includes('concluída')
    ) {
      confirmed = true;
      console.log(`  ✓ Paddle Sandbox checkout completed and confirmed!`);
      break;
    }
  }
  await client.captureScreenshot('05_checkout_step3_success.png');
  client.close();

  // 6. Verification directly in Paddle API
  console.log('\n[6/6] Fetching live transaction and subscription from Paddle Sandbox API...');
  await sleep(3000);

  const txList = await paddleApi('/transactions?per_page=15');
  const matchedTx = (txList.data || []).find(t => 
    t.custom_data?.organization_id === testOrgId && 
    (t.status === 'completed' || t.status === 'billed')
  );

  const subList = await paddleApi('/subscriptions?per_page=15');
  const matchedSub = (subList.data || []).find(s => 
    s.custom_data?.organization_id === testOrgId && 
    (s.status === 'active' || s.status === 'trialing')
  );

  console.log('\n================================================================');
  console.log('   REAL PADDLE SANDBOX ENTITIES CREATED:');
  console.log('================================================================');
  console.log(`  Transaction ID:  ${matchedTx ? matchedTx.id : 'NOT FOUND IN FIRST PAGE'}`);
  console.log(`  Transaction Status: ${matchedTx ? matchedTx.status : 'N/A'}`);
  console.log(`  Subscription ID: ${matchedSub ? matchedSub.id : 'NOT FOUND IN FIRST PAGE'}`);
  console.log(`  Subscription Status: ${matchedSub ? matchedSub.status : 'N/A'}`);
  console.log(`  Customer ID:     ${matchedTx ? matchedTx.customer_id : (matchedSub ? matchedSub.customer_id : 'N/A')}`);
  console.log(`  Custom Data:     ${JSON.stringify(matchedTx?.custom_data || matchedSub?.custom_data || {})}`);

  const results = {
    testOrgId,
    testOrgName,
    planId,
    priceId,
    billingEmail,
    checkoutConfirmed: confirmed,
    transaction: matchedTx || null,
    subscription: matchedSub || null,
  };

  fs.writeFileSync('scripts/m41437_native_checkout_result.json', JSON.stringify(results, null, 2));
  console.log('\nResults persisted to scripts/m41437_native_checkout_result.json');

  try {
    proc.kill();
  } catch {}
}

main().catch(err => {
  console.error('Fatal E2E Native Checkout Error:', err);
  process.exit(1);
});
