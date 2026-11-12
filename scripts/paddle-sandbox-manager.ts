import fs from 'fs';
import path from 'path';

// Safely load .env.local
const envPath = path.resolve('.env.local');
try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
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

const PADDLE_ENV = process.env.PADDLE_ENV || 'sandbox';
const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
const CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';
const PADDLE_BASE_URL = 'https://sandbox-api.paddle.com';

// 1. STRICT SAFETY GATES
if (PADDLE_ENV !== 'sandbox') {
  console.error('CRITICAL ABORT: PADDLE_ENV is NOT set to "sandbox". Live environment access is strictly forbidden!');
  process.exit(1);
}

if (PADDLE_API_KEY.includes('pdl_live_') || CLIENT_TOKEN.startsWith('live_')) {
  console.error('CRITICAL ABORT: Detected live production credentials. Only Sandbox credentials (pdl_sdbx_ / test_) are permitted!');
  process.exit(1);
}

const isValidApiKeyPrefix = PADDLE_API_KEY.startsWith('pdl_sdbx_apikey_') || PADDLE_API_KEY.startsWith('pdl_sandbox_apikey_');
const isValidClientTokenPrefix = CLIENT_TOKEN.startsWith('test_');

console.log('=== PADDLE SANDBOX PRE-FLIGHT CREDENTIAL AUDIT ===');
console.log(`Environment: ${PADDLE_ENV}`);
console.log(`Endpoint: ${PADDLE_BASE_URL}`);
console.log(`API Key: present=${PADDLE_API_KEY.length > 0}, length=${PADDLE_API_KEY.length}, valid_sandbox_prefix=${isValidApiKeyPrefix}`);
console.log(`Client Token: present=${CLIENT_TOKEN.length > 0}, length=${CLIENT_TOKEN.length}, valid_sandbox_prefix=${isValidClientTokenPrefix}`);

if (!isValidApiKeyPrefix) {
  console.error('\n[BLOCKER DETECTED] PADDLE_API_KEY is missing or does not have a valid Sandbox prefix.');
  console.error('Expected prefix: pdl_sdbx_apikey_... or pdl_sandbox_apikey_...');
  console.error('Please configure your secret Sandbox API key in .env.local.');
  process.exit(1);
}

if (!isValidClientTokenPrefix) {
  console.warn('\n[NOTICE] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not yet set or missing "test_" prefix.');
  console.warn('Frontend checkout overlay will require a valid test_ token.');
}

async function paddleRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${PADDLE_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

async function main() {
  // 1. Authenticate & List Existing Products
  console.log('\n[1] Authenticating against Paddle Sandbox API (GET /products)...');
  const productsRes = await paddleRequest('/products?per_page=100');
  console.log(`Authentication HTTP Status: ${productsRes.status}`);

  if (!productsRes.ok) {
    console.error('Authentication Error:', JSON.stringify(productsRes.data, null, 2));
    process.exit(1);
  }

  const existingProducts: any[] = productsRes.data?.data || [];
  console.log(`✓ Authenticated successfully! Existing products found: ${existingProducts.length}`);
  for (const p of existingProducts) {
    console.log(`  - Product: "${p.name}" (ID: ${p.id}, Status: ${p.status})`);
  }

  // 2. List Existing Prices
  console.log('\n[2] Inspecting Existing Catalog Prices (GET /prices)...');
  const pricesRes = await paddleRequest('/prices?per_page=100');
  const existingPrices: any[] = pricesRes.data?.data || [];
  console.log(`Existing prices found: ${existingPrices.length}`);
  for (const pr of existingPrices) {
    const amount = (parseInt(pr.unit_price?.amount || '0', 10) / 100).toFixed(2);
    const interval = `${pr.billing_cycle?.frequency || ''} ${pr.billing_cycle?.interval || 'one-time'}`;
    console.log(`  - Price ID: ${pr.id} | Product: ${pr.product_id} | Amount: ${pr.unit_price?.currency_code} $${amount} / ${interval} | Status: ${pr.status}`);
  }

  // 3. Match or Create Required Plans
  const plans = [
    {
      key: 'STARTER',
      name: 'BidReady Starter',
      description: 'BidReady Starter Plan - 10 document analyses per month',
      amountCents: '2900',
      monthlyUsd: 29,
    },
    {
      key: 'PRO',
      name: 'BidReady Pro',
      description: 'BidReady Pro Enterprise Plan - 40 document analyses per month',
      amountCents: '6900',
      monthlyUsd: 69,
    },
    {
      key: 'BUSINESS',
      name: 'BidReady Business',
      description: 'BidReady Business Global Plan - 120 document analyses per month',
      amountCents: '14900',
      monthlyUsd: 149,
    },
  ];

  const resolvedPriceIds: Record<string, { productId: string; priceId: string; amountUsd: number }> = {};

  for (const plan of plans) {
    console.log(`\n--- Plan: ${plan.name} (US$ ${plan.monthlyUsd}/mo) ---`);

    // Find existing product or create
    let product = existingProducts.find(
      (p) =>
        p.name?.toLowerCase().includes(plan.name.toLowerCase()) ||
        p.name?.toLowerCase().includes(plan.key.toLowerCase())
    );

    if (!product) {
      console.log(`Creating product "${plan.name}" in Paddle Sandbox...`);
      const createProdRes = await paddleRequest('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: plan.name,
          description: plan.description,
          tax_category: 'standard',
        }),
      });

      if (!createProdRes.ok) {
        throw new Error(`Failed to create product "${plan.name}": ${JSON.stringify(createProdRes.data)}`);
      }

      product = createProdRes.data?.data;
      console.log(`✓ Created product "${product.name}" (ID: ${product.id})`);
    } else {
      console.log(`✓ Found existing product: "${product.name}" (ID: ${product.id})`);
    }

    // Find existing price or create
    let price = existingPrices.find(
      (pr) =>
        pr.product_id === product.id &&
        pr.unit_price?.amount === plan.amountCents &&
        pr.unit_price?.currency_code === 'USD' &&
        pr.billing_cycle?.interval === 'month' &&
        pr.billing_cycle?.frequency === 1 &&
        pr.status === 'active'
    );

    if (!price) {
      console.log(`Creating recurring price of US$ ${plan.monthlyUsd}/month for Product ${product.id}...`);
      const createPriceRes = await paddleRequest('/prices', {
        method: 'POST',
        body: JSON.stringify({
          product_id: product.id,
          description: `${plan.name} Monthly Subscription`,
          unit_price: {
            amount: plan.amountCents,
            currency_code: 'USD',
          },
          billing_cycle: {
            interval: 'month',
            frequency: 1,
          },
          tax_mode: 'account_setting',
        }),
      });

      if (!createPriceRes.ok) {
        throw new Error(`Failed to create price for "${plan.name}": ${JSON.stringify(createPriceRes.data)}`);
      }

      price = createPriceRes.data?.data;
      console.log(`✓ Created price for "${plan.name}": ${price.id}`);
    } else {
      console.log(`✓ Found existing active price for "${plan.name}": ${price.id}`);
    }

    resolvedPriceIds[plan.key] = {
      productId: product.id,
      priceId: price.id,
      amountUsd: plan.monthlyUsd,
    };
  }

  console.log('\n=== CATALOG CONFIGURATION COMPLETE ===');
  console.log(resolvedPriceIds);

  // 4. Update .env.local with the resolved Price IDs
  console.log('\n[4] Updating .env.local with resolved Sandbox Price IDs...');
  let envFile = fs.readFileSync(envPath, 'utf-8');

  const updates: Record<string, string> = {
    NEXT_PUBLIC_PADDLE_PRICE_STARTER: resolvedPriceIds.STARTER.priceId,
    NEXT_PUBLIC_PADDLE_PRICE_PRO: resolvedPriceIds.PRO.priceId,
    NEXT_PUBLIC_PADDLE_PRICE_BUSINESS: resolvedPriceIds.BUSINESS.priceId,
  };

  for (const [key, val] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envFile)) {
      envFile = envFile.replace(regex, `${key}=${val}`);
    } else {
      envFile += `\n${key}=${val}`;
    }
  }

  fs.writeFileSync(envPath, envFile);
  console.log('✓ .env.local successfully updated with Sandbox Price IDs.');
}

main().catch((err) => {
  console.error('Fatal execution error:', err.message);
  process.exit(1);
});
