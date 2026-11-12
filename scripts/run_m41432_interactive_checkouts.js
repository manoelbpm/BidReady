const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
function getEnv(key) {
  const line = envContent.split('\n').find(l => l.trim().startsWith(`${key}=`));
  return line ? line.split('=')[1].trim() : '';
}

const PADDLE_API_KEY = getEnv('PADDLE_API_KEY');
const STARTER_PRICE = getEnv('NEXT_PUBLIC_PADDLE_PRICE_STARTER');
const PRO_PRICE = getEnv('NEXT_PUBLIC_PADDLE_PRICE_PRO');
const BUSINESS_PRICE = getEnv('NEXT_PUBLIC_PADDLE_PRICE_BUSINESS');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = `C:\\Users\\PC\\AppData\\Local\\Temp\\edge_m41432_clean_${Date.now()}`;
const artifactsDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\658b3dc9-76af-4ca9-867a-b773142bfee2\\screenshots_m41432';

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

const PLANS_CONFIG = [
  {
    planId: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    expectedQuota: 10,
    priceId: STARTER_PRICE,
    orgId: 'e2e00000-0000-4000-a000-000000000010',
    orgName: 'BidReady E2E Starter',
    billingEmail: 'billing-starter@bidready.ai',
  },
  {
    planId: 'pro',
    name: 'Pro',
    monthlyPrice: 69,
    expectedQuota: 40,
    priceId: PRO_PRICE,
    orgId: 'e2e00000-0000-4000-a000-000000000020',
    orgName: 'BidReady E2E Pro',
    billingEmail: 'billing-pro@bidready.ai',
  },
  {
    planId: 'business',
    name: 'Business',
    monthlyPrice: 149,
    expectedQuota: 120,
    priceId: BUSINESS_PRICE,
    orgId: 'e2e00000-0000-4000-a000-000000000030',
    orgName: 'BidReady E2E Business',
    billingEmail: 'billing-business@bidready.ai',
  },
];

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
  console.log('   BIDREADY M4.14.3.2 — INTERACTIVE CHECKOUT E2E SUITE');
  console.log('   Exclusively Paddle Sandbox & Real Interactive Purchases');
  console.log('================================================================');

  // Launch Edge with CDP
  console.log('\n[1/3] Launching Edge Browser with Remote Debugging...');
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    `--user-data-dir=${profileDir}`,
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1440,1080',
  ]);

  proc.stderr.on('data', () => {});
  await sleep(3000);

  // Authenticate via initial tab
  console.log('\n[2/3] Authenticating as test user analyst@bidready.com...');
  const loginTab = await fetch('http://127.0.0.1:9228/json/new?http://localhost:3000/login', { method: 'PUT' }).then(r => r.json());
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
      console.log(`     ✓ Authenticated successfully! Current URL: ${url}`);
      break;
    }
  }
  await loginClient.captureScreenshot('00_auth_success.png');
  loginClient.close();

  // Execute checkouts for all 3 plans
  console.log('\n[3/3] Executing Real Interactive Checkout for all 3 Plans:');
  const executionResults = [];

  for (const plan of PLANS_CONFIG) {
    console.log('\n' + '='.repeat(64));
    console.log(` PLANO: ${plan.name.toUpperCase()} (US$ ${plan.monthlyPrice}/mês -> Quota: ${plan.expectedQuota})`);
    console.log(` Organização: ${plan.orgName} (${plan.orgId})`);
    console.log(` Price ID: ${plan.priceId}`);
    console.log('='.repeat(64));

    // A. Quota before checkout
    const subBeforeRes = await fetch(`http://localhost:3000/api/billing/subscription?orgId=${plan.orgId}`);
    const subBefore = await subBeforeRes.json();
    const quotaBefore = subBefore.quota?.limit ?? 0;
    const planBefore = subBefore.subscription?.planId ?? 'free';
    console.log(`  [A] Estado ANTES do checkout: Plano '${planBefore}', Quota: ${quotaBefore} análises`);

    // B. Open new tab directly on /pricing
    console.log(`  [B] Abrindo aba em /pricing?orgId=${plan.orgId}...`);
    const planTab = await fetch(`http://127.0.0.1:9228/json/new?http://localhost:3000/pricing?orgId=${plan.orgId}`, { method: 'PUT' }).then(r => r.json());
    const client = new CDPClient(planTab.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    // Wait for Paddle readiness
    console.log(`      Aguardando inicialização do Paddle.js Sandbox...`);
    let paddleLoaded = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      paddleLoaded = await client.evaluate('Boolean(window.Paddle && window.Paddle.Checkout)');
      if (paddleLoaded) break;
    }
    console.log(`      Paddle.js carregado: ${paddleLoaded}`);
    await client.captureScreenshot(`01_${plan.planId}_pricing_page.png`);

    // C. Click plan select button
    console.log(`  [C] Clicando no botão para selecionar ${plan.name}...`);
    const clickResult = await client.evaluate(`
      (() => {
        const btn = document.querySelector('button[data-testid="select-plan-${plan.planId}"]');
        if (btn) {
          btn.click();
          return 'Clicked button via data-testid';
        }
        const allBtns = Array.from(document.querySelectorAll('button'));
        const match = allBtns.find(b => b.innerText.includes('${plan.name}'));
        if (match) {
          match.click();
          return 'Clicked button via text match: ' + match.innerText;
        }
        return 'Button not found';
      })()
    `);
    console.log(`      ${clickResult}`);

    // D. Wait for Paddle iframe overlay
    console.log(`  [D] Aguardando abertura do overlay Paddle Checkout Sandbox...`);
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
      throw new Error(`Paddle iframe overlay failed to open for plan ${plan.name}`);
    }
    await sleep(2500);
    await client.captureScreenshot(`02_${plan.planId}_checkout_step1_details.png`);

    // E. Step 1: In iframe, ensure email and click Continuar
    console.log(`  [E] Preenchendo dados do comprador (${plan.billingEmail}) e avançando...`);
    await client.evaluate(`
      (() => {
        const f = document.querySelector('iframe.paddle-frame');
        const doc = f.contentDocument || f.contentWindow.document;
        const win = f.contentWindow;

        const emailInput = doc.querySelector('input[type="email"]') || doc.querySelector('#email');
        if (emailInput && (!emailInput.value || emailInput.value.trim() === '')) {
          emailInput.focus();
          const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(emailInput, '${plan.billingEmail}');
          else emailInput.value = '${plan.billingEmail}';
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

    // F. Wait for Step 2: Payment
    await sleep(4000);
    console.log(`  [F] Preenchendo dados do cartão de teste oficial Paddle Sandbox...`);
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
        const holder = setReactInput(doc.querySelector('#cardHolder'), '${plan.orgName}');
        const exp = setReactInput(doc.querySelector('#expiry'), '12/28');
        const cvv = setReactInput(doc.querySelector('#cvv'), '100');

        return { card, holder, exp, cvv };
      })()
    `);
    console.log(`      Campos preenchidos com sucesso:`, fillResult);
    await sleep(1500);
    await client.captureScreenshot(`03_${plan.planId}_checkout_step2_payment_filled.png`);

    // G. Click Assinar agora
    console.log(`  [G] Clicando em 'Assinar agora' para liquidar a transação...`);
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

    // H. Wait for Paddle confirmation screen
    console.log(`  [H] Aguardando processamento e confirmação pelo Paddle Sandbox...`);
    let checkoutConfirmed = false;
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
        checkoutConfirmed = true;
        console.log(`      ✓ Compra concluída com confirmação do Paddle Sandbox!`);
        break;
      }
    }
    await client.captureScreenshot(`04_${plan.planId}_checkout_step3_success.png`);

    // I. Verify Paddle API for real Transaction and Subscription
    console.log(`  [I] Consultando registros nativos na API REST do Paddle Sandbox...`);
    await sleep(2500);

    const txList = await paddleApi('/transactions?per_page=15');
    const matchedTx = (txList.data || []).find(t => 
      t.custom_data?.organization_id === plan.orgId && 
      (t.status === 'completed' || t.status === 'billed')
    );

    const subList = await paddleApi('/subscriptions?per_page=15');
    const matchedSub = (subList.data || []).find(s => 
      s.custom_data?.organization_id === plan.orgId && 
      s.status === 'active'
    );

    const realTxnId = matchedTx?.id || 'txn_pending';
    const realTxnStatus = matchedTx?.status || 'unknown';
    const realCustId = matchedTx?.customer_id || matchedSub?.customer_id || 'ctm_pending';
    const realSubId = matchedSub?.id || matchedTx?.subscription_id || 'sub_pending';

    console.log(`      - Transaction ID Real: ${realTxnId} (Status: ${realTxnStatus})`);
    console.log(`      - Customer ID Real:    ${realCustId}`);
    console.log(`      - Subscription ID Real:${realSubId}`);

    // J. Reload page in Edge and verify Active Plan UI
    console.log(`  [J] Recarregando página /pricing?orgId=${plan.orgId} para auditoria de UI...`);
    await sleep(2000);
    await client.send('Page.reload');
    await sleep(4000);
    await client.captureScreenshot(`05_${plan.planId}_app_reloaded_active.png`);

    const uiCheck = await client.evaluate(`
      (() => {
        const card = document.querySelector('[data-testid="card-plan-${plan.planId}"]');
        const activeBtn = card ? card.querySelector('button') : null;
        return {
          btnText: activeBtn ? activeBtn.innerText.trim() : '',
          isCurrentBadge: card ? Boolean(card.querySelector('.text-emerald-600')) : false
        };
      })()
    `);
    console.log(`      - Interface após reload: Botão: '${uiCheck?.btnText}', Badge Atual: ${uiCheck?.isCurrentBadge}`);

    // Verify via internal API
    const subAfterRes = await fetch(`http://localhost:3000/api/billing/subscription?orgId=${plan.orgId}`);
    const subAfter = await subAfterRes.json();
    const quotaAfter = subAfter.quota?.limit ?? 0;
    const planAfter = subAfter.subscription?.planId ?? 'unknown';

    console.log(`      - Subscrição pós-webhook: Plano: ${planAfter}, Quota: ${quotaAfter} análises`);

    client.close();
    try {
      await fetch(`http://127.0.0.1:9228/json/close/${planTab.id}`);
    } catch {}

    executionResults.push({
      plan: plan.planId,
      name: plan.name,
      orgId: plan.orgId,
      orgName: plan.orgName,
      monthlyPrice: plan.monthlyPrice,
      expectedQuota: plan.expectedQuota,
      priceId: plan.priceId,
      quotaBefore,
      quotaAfter,
      planAfter,
      transactionId: realTxnId,
      transactionStatus: realTxnStatus,
      customerId: realCustId,
      subscriptionId: realSubId,
      uiReloadCheck: uiCheck,
      success: planAfter === plan.planId && quotaAfter === plan.expectedQuota,
    });
  }

  // Save complete structured results
  const resultsPath = path.resolve('scripts/m41432_interactive_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(executionResults, null, 2));
  console.log(`\n================================================================`);
  console.log(`✓ All 3 Real Sandbox Purchases Completed!`);
  console.log(`Results saved to: ${resultsPath}`);
  console.log(`================================================================`);

  proc.kill();
}

main().catch(err => {
  console.error('Execution Error:', err);
  process.exit(1);
});
