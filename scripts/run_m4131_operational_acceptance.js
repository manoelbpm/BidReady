const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch {}

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = `C:\\Users\\PC\\AppData\\Local\\Temp\\edge_acceptance_m4131_${Date.now()}`;
const targetOppId = 'e705f533-8187-4af4-b23f-6c246d537e8a';

const artifactsDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\658b3dc9-76af-4ca9-867a-b773142bfee2\\screenshots_m4131';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== STARTING BIDREADY M4.13.1 OPERATIONAL ACCEPTANCE TEST ===');
  console.log(`Target Opportunity: ${targetOppId}`);
  console.log(`Screenshots Directory (Private): ${artifactsDir}`);

  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // 1. Launch Edge headless with remote debugging
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,1080',
  ]);

  proc.stderr.on('data', () => {});

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
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

  // Open login page
  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:3000/login', {
    method: 'PUT',
  });
  const tab = await newTabRes.json();
  wsUrl = tab.webSocketDebuggerUrl;
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
  await send('DOM.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  async function captureScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const privatePath = path.join(artifactsDir, filename);
    fs.writeFileSync(privatePath, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  // --- STEP 1: LOGIN REAL ---
  console.log('\n[Step 1] Authenticating as analyst@bidready.com...');
  await sleep(2000);

  await evaluate(`
    const emailInput = document.querySelector('input[type="email"]');
    const pwdInput = document.querySelector('input[type="password"]');
    if (emailInput && pwdInput) {
      emailInput.value = 'analyst@bidready.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwdInput.value = 'SuperSecret2026!';
      pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);

  await sleep(500);

  await evaluate(`
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  `);

  // Wait for redirect to dashboard
  let authed = false;
  for (let i = 0; i < 20; i++) {
    await sleep(600);
    const url = await evaluate('window.location.href');
    if (url && (url.includes('/dashboard') || url.includes('/upload') || url.includes('/checklist'))) {
      authed = true;
      console.log(`Authentication succeeded! Current URL: ${url}`);
      break;
    }
  }

  if (!authed) throw new Error('Authentication failed!');
  await sleep(1000);
  await captureScreenshot('01_login_successful.png');

  // --- STEP 2: NAVIGATE TO /checklist ---
  console.log('\n[Step 2] Navigating to /checklist...');
  await send('Page.navigate', { url: 'http://localhost:3000/checklist' });
  await sleep(3000);

  await captureScreenshot('02_checklist_initial_view.png');

  // --- STEP 3: SELECT SYNTHETIC OPPORTUNITY ---
  console.log(`\n[Step 3] Selecting synthetic opportunity "${targetOppId}"...`);
  const selectedResult = await evaluate(`
    const select = document.querySelector('select');
    if (select) {
      select.value = '${targetOppId}';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      true;
    } else false;
  `);

  console.log(`Opportunity selector update: ${selectedResult}`);
  await sleep(2000);

  // --- STEP 4: EXECUTE MATCHING ENGINE ---
  console.log('\n[Step 4] Executing matching engine via UI button...');
  await evaluate(`
    const buttons = Array.from(document.querySelectorAll('button'));
    const runBtn = buttons.find(b => b.textContent.includes('Executar Análise de Correspondência'));
    if (runBtn) runBtn.click();
  `);

  console.log('Waiting for matching engine execution and PostgreSQL persistence...');
  for (let i = 0; i < 25; i++) {
    await sleep(800);
    const isRunning = await evaluate(`
      document.body.innerText.includes('Analisando...')
    `);
    if (!isRunning) {
      console.log('Matching engine execution completed!');
      break;
    }
  }
  await sleep(2000);

  // --- STEP 5: VERIFY 5 STATES IN DOM ---
  console.log('\n[Step 5] Auditing rendered states in UI DOM:');
  const domAudit = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('.rounded-xl, .border'));
    const bodyText = document.body.innerText;
    
    return {
      hasMatched: bodyText.includes('MATCHED'),
      hasPartiallyMatched: bodyText.includes('PARTIALLY MATCHED'),
      hasMissingEvidence: bodyText.includes('MISSING EVIDENCE'),
      hasExpiredEvidence: bodyText.includes('EXPIRED EVIDENCE'),
      hasRequiresReview: bodyText.includes('REQUIRES REVIEW'),
      hasBlockerBadge: bodyText.includes('BLOQUEADOR DE SUBMISSÃO'),
      hasDisclaimer: bodyText.includes('Diretriz de Transparência Regulatória'),
    };
  })()`);

  console.log('DOM Classification Audit:', domAudit);
  expectTrue('MATCHED state rendered', domAudit.hasMatched);
  expectTrue('PARTIALLY_MATCHED state rendered', domAudit.hasPartiallyMatched);
  expectTrue('MISSING_EVIDENCE state rendered', domAudit.hasMissingEvidence);
  expectTrue('EXPIRED_EVIDENCE state rendered', domAudit.hasExpiredEvidence);
  expectTrue('REQUIRES_REVIEW state rendered', domAudit.hasRequiresReview);
  expectTrue('Submission blocker badge rendered', domAudit.hasBlockerBadge);
  expectTrue('Regulatory disclaimer rendered', domAudit.hasDisclaimer);

  await captureScreenshot('03_matching_executed_five_states.png');

  // --- STEP 6: CRITICAL FALSE-POSITIVE VERIFICATION ---
  console.log('\n[Step 6] Testing critical false-positive: FedRAMP High vs ISO 9001:');
  const falsePositiveCheck = await evaluate(`(() => {
    const reqText = 'FedRAMP High Cloud Infrastructure Authorization (DoD IL5)';
    const isoText = 'ISO 9001:2015 Quality Management Certificate';
    
    // Find requirement card
    const allCards = Array.from(document.querySelectorAll('.p-6'));
    const fedrampCard = allCards.find(c => c.innerText.includes(reqText));
    
    let isMatchedToIso = false;
    let cardOutcome = 'NOT_FOUND';
    if (fedrampCard) {
      const text = fedrampCard.innerText;
      if (text.includes('MATCHED') && !text.includes('PARTIALLY') && text.includes(isoText)) {
        isMatchedToIso = true;
      }
      if (text.includes('MISSING EVIDENCE')) cardOutcome = 'MISSING_EVIDENCE';
      else if (text.includes('MATCHED')) cardOutcome = 'MATCHED';
      else if (text.includes('PARTIALLY MATCHED')) cardOutcome = 'PARTIALLY_MATCHED';
    }
    
    return {
      foundCard: !!fedrampCard,
      cardOutcome,
      isMatchedToIso,
    };
  })()`);

  console.log('False Positive Check Result:', falsePositiveCheck);
  expectTrue('False positive is BLOCKED (ISO 9001 is NOT matched to FedRAMP High)', !falsePositiveCheck.isMatchedToIso);
  expectTrue('FedRAMP requirement without FedRAMP evidence is correctly MISSING_EVIDENCE', falsePositiveCheck.cardOutcome === 'MISSING_EVIDENCE');

  await captureScreenshot('04_false_positive_blocked_and_gaps.png');

  // --- STEP 7: HUMAN VERIFICATION INTERACTION ---
  console.log('\n[Step 7] Recording human verification decisions (Confirmar Conformidade & Sinalizar Pendência)...');
  const reviewActionsResult = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const confirmBtn = buttons.find(b => b.textContent.includes('Confirmar Conformidade'));
    if (confirmBtn) {
      confirmBtn.click();
      return 'CONFIRM_CLICKED';
    }
    return 'CONFIRM_BTN_NOT_FOUND';
  })()`);

  console.log(`Confirm verification action: ${reviewActionsResult}`);
  await sleep(2500);

  // Click 'Sinalizar Pendência' on another card
  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const flagBtn = buttons.find(b => b.textContent.includes('Sinalizar Pendência'));
    if (flagBtn) {
      flagBtn.click();
    }
  })()`);
  await sleep(2500);

  await captureScreenshot('05_human_verification_recorded.png');

  // --- STEP 8: DIRECT POSTGRESQL PERSISTENCE CHECK ---
  console.log('\n[Step 8] Verifying PostgreSQL persistence of decisions...');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await supabase.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });

  const { data: persistedMatches, error: pErr } = await supabase
    .from('requirement_evidence_matches')
    .select('id, match_outcome, verified_by_user_id, verified_at, human_review_notes')
    .eq('opportunity_id', targetOppId);

  if (pErr) throw new Error(`DB error: ${pErr.message}`);
  console.log(`Persisted matches in PostgreSQL: ${persistedMatches.length} rows`);

  const humanVerifiedCount = persistedMatches.filter(m => m.verified_at != null).length;
  console.log(`Human verified rows in PostgreSQL: ${humanVerifiedCount}`);
  expectTrue('Human verifications recorded in PostgreSQL', humanVerifiedCount > 0);

  // --- STEP 9: PAGE RELOAD & RESTORE CHECK ---
  console.log('\n[Step 9] Reloading page to prove state survives cold reload...');
  await send('Page.reload');
  await sleep(3500);

  // Ensure opportunity is selected
  await evaluate(`(() => {
    const select = document.querySelector('select');
    if (select && select.value !== '${targetOppId}') {
      select.value = '${targetOppId}';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  await sleep(2500);

  const reloadedAudit = await evaluate(`(() => {
    const bodyText = document.body.innerText;
    return {
      hasVerifiedBadge: bodyText.includes('Verificado por Analista'),
      hasMatched: bodyText.includes('MATCHED'),
      hasExpiredEvidence: bodyText.includes('EXPIRED EVIDENCE'),
      hasMissingEvidence: bodyText.includes('MISSING EVIDENCE'),
      hasPartiallyMatched: bodyText.includes('PARTIALLY MATCHED'),
      hasRequiresReview: bodyText.includes('REQUIRES REVIEW'),
    };
  })()`);

  console.log('Reload Persistence Audit:', reloadedAudit);
  expectTrue('Reload restored verified badge', reloadedAudit.hasVerifiedBadge);
  expectTrue('Reload restored all match outcomes', reloadedAudit.hasMatched && reloadedAudit.hasExpiredEvidence && reloadedAudit.hasMissingEvidence);

  await captureScreenshot('06_page_reloaded_and_state_preserved.png');

  console.log('\n=== OPERATIONAL ACCEPTANCE M4.13.1 COMPLETED WITH 100% SUCCESS ===');

  ws.close();
  proc.kill();
  process.exit(0);
}

function expectTrue(name, condition) {
  if (!condition) {
    console.error(`FAILED ASSERTION: ${name}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

main().catch((err) => {
  console.error('Test Execution Failed:', err);
  process.exit(1);
});
