import { PlanId } from '@/types/billing';

export type PaddleEnvironment = 'sandbox' | 'production';

export interface PaddleConfigValidation {
  valid: boolean;
  environment: PaddleEnvironment;
  isLive: boolean;
  errors: string[];
}

/**
 * Standard Paddle Sandbox Price IDs (Used strictly in Sandbox environment for testing and local dev).
 * NEVER permitted in production/live mode.
 */
export const SANDBOX_PADDLE_PRICES: Record<PlanId, string> = {
  free: '',
  starter: 'pri_01m73t7nhv4rwj634cwpaw3hec',
  pro: 'pri_01m73t7pae2d7wkta71swvzv09',
  business: 'pri_01m73t7pr06wahgkdh9ce7w2d9',
};

const SANDBOX_PRICE_SET = new Set<string>([
  SANDBOX_PADDLE_PRICES.starter,
  SANDBOX_PADDLE_PRICES.pro,
  SANDBOX_PADDLE_PRICES.business,
]);

/**
 * Detects whether the current environment is configured for Paddle Live/Production.
 */
export function isPaddleLive(): boolean {
  const env = (process.env.PADDLE_ENV || '').toLowerCase().trim();
  return env === 'production' || env === 'live';
}

/**
 * Returns the current Paddle environment name ('sandbox' or 'production').
 */
export function getPaddleEnvironment(): PaddleEnvironment {
  return isPaddleLive() ? 'production' : 'sandbox';
}

/**
 * Returns the authoritative Paddle API base URL.
 */
export function getPaddleApiBaseUrl(): string {
  return isPaddleLive() ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

/**
 * Validates the coherence of the Paddle configuration for the current environment.
 * In Live mode, strictly enforces that all production credentials and non-sandbox price IDs are set.
 */
export function validatePaddleConfig(): PaddleConfigValidation {
  const isLive = isPaddleLive();
  const environment = getPaddleEnvironment();
  const errors: string[] = [];

  const apiKey = (process.env.PADDLE_API_KEY || '').trim();
  const clientToken = (
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
    process.env.PADDLE_CLIENT_TOKEN ||
    ''
  ).trim();
  const webhookSecret = (
    process.env.PADDLE_WEBHOOK_SECRET ||
    process.env.PADDLE_WEBHOOK_SECRET_KEY ||
    ''
  ).trim();

  const starterPrice = (
    process.env.PADDLE_PRICE_STARTER ||
    process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER ||
    ''
  ).trim();
  const proPrice = (
    process.env.PADDLE_PRICE_PRO ||
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO ||
    ''
  ).trim();
  const businessPrice = (
    process.env.PADDLE_PRICE_BUSINESS ||
    process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS ||
    ''
  ).trim();

  if (isLive) {
    // 1. Live API Key Enforcement
    if (!apiKey) {
      errors.push('PADDLE_API_KEY is required in production environment.');
    } else if (
      apiKey.includes('test_') ||
      apiKey.includes('sandbox_') ||
      apiKey.startsWith('paddletest')
    ) {
      errors.push('PADDLE_API_KEY appears to be a sandbox/test key but PADDLE_ENV is set to production.');
    }

    // 2. Live Client Token Enforcement
    if (!clientToken) {
      errors.push('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is required in production environment.');
    } else if (clientToken.includes('test_') || clientToken.includes('sandbox_')) {
      errors.push('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is a sandbox token but PADDLE_ENV is production.');
    }

    // 3. Live Webhook Secret Enforcement
    if (!webhookSecret) {
      errors.push('PADDLE_WEBHOOK_SECRET is required in production environment.');
    }

    // 4. Live Price IDs Enforcement
    if (!starterPrice) {
      errors.push('PADDLE_PRICE_STARTER is required in production environment.');
    } else if (SANDBOX_PRICE_SET.has(starterPrice)) {
      errors.push(`PADDLE_PRICE_STARTER is using Sandbox Price ID (${starterPrice}) in production. Live Price IDs must be created in Paddle Live dashboard.`);
    }

    if (!proPrice) {
      errors.push('PADDLE_PRICE_PRO is required in production environment.');
    } else if (SANDBOX_PRICE_SET.has(proPrice)) {
      errors.push(`PADDLE_PRICE_PRO is using Sandbox Price ID (${proPrice}) in production. Live Price IDs must be created in Paddle Live dashboard.`);
    }

    if (!businessPrice) {
      errors.push('PADDLE_PRICE_BUSINESS is required in production environment.');
    } else if (SANDBOX_PRICE_SET.has(businessPrice)) {
      errors.push(`PADDLE_PRICE_BUSINESS is using Sandbox Price ID (${businessPrice}) in production. Live Price IDs must be created in Paddle Live dashboard.`);
    }
  }

  return {
    valid: errors.length === 0,
    environment,
    isLive,
    errors,
  };
}

/**
 * Resolves the server-authoritative Price ID for a given SaaS plan.
 * Throws an explicit error in production if required Live Price IDs are missing or invalid.
 */
export function resolvePaddlePriceId(planId: PlanId): string {
  if (planId === 'free') return '';

  const isLive = isPaddleLive();
  const validation = validatePaddleConfig();

  if (isLive && !validation.valid) {
    throw new Error(
      `Paddle Live Configuration Blocked: Cannot resolve Price ID for plan "${planId}" due to incomplete production configuration: ${validation.errors.join('; ')}`
    );
  }

  if (planId === 'starter') {
    const envPrice = process.env.PADDLE_PRICE_STARTER || process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER;
    if (envPrice) return envPrice.trim();
    if (!isLive) return SANDBOX_PADDLE_PRICES.starter;
    throw new Error('Missing PADDLE_PRICE_STARTER in production');
  }

  if (planId === 'pro') {
    const envPrice = process.env.PADDLE_PRICE_PRO || process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO;
    if (envPrice) return envPrice.trim();
    if (!isLive) return SANDBOX_PADDLE_PRICES.pro;
    throw new Error('Missing PADDLE_PRICE_PRO in production');
  }

  if (planId === 'business') {
    const envPrice = process.env.PADDLE_PRICE_BUSINESS || process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS;
    if (envPrice) return envPrice.trim();
    if (!isLive) return SANDBOX_PADDLE_PRICES.business;
    throw new Error('Missing PADDLE_PRICE_BUSINESS in production');
  }

  throw new Error(`Unsupported plan for Paddle billing: "${planId}"`);
}

/**
 * Maps any incoming Paddle Price ID back to its SaaS PlanId.
 * Checks dynamic environment variables first, then fallback sandbox catalog.
 */
export function mapPaddlePriceToPlan(priceId: string): PlanId | null {
  if (!priceId) return null;
  const cleanId = priceId.trim();

  // 1. Dynamic Environment Variables Check (Both Server and Public)
  const starterPrice = process.env.PADDLE_PRICE_STARTER || process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER;
  if (starterPrice && cleanId === starterPrice.trim()) return 'starter';

  const proPrice = process.env.PADDLE_PRICE_PRO || process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO;
  if (proPrice && cleanId === proPrice.trim()) return 'pro';

  const businessPrice = process.env.PADDLE_PRICE_BUSINESS || process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS;
  if (businessPrice && cleanId === businessPrice.trim()) return 'business';

  // 2. Known Sandbox Catalog Check (always supported in sandbox)
  if (cleanId === SANDBOX_PADDLE_PRICES.starter) return 'starter';
  if (cleanId === SANDBOX_PADDLE_PRICES.pro) return 'pro';
  if (cleanId === SANDBOX_PADDLE_PRICES.business) return 'business';

  return null;
}
