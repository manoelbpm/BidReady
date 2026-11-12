import crypto from 'crypto';
import { PlanId, SAAS_PLANS, SubscriptionStatus } from '@/types/billing';
import { SubscriptionService } from './subscription-service';
import { WebhookRepository } from '@/lib/supabase/repositories/webhook-repository';
import { mapPaddlePriceToPlan } from './paddle-config';

export interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id?: string;
    subscription_id?: string;
    customer_id?: string;
    status?: string;
    custom_data?: {
      organization_id?: string;
      plan_id?: PlanId;
      intent_id?: string;
      intent_token?: string;
    };
    items?: Array<{
      price?: {
        id?: string;
      };
      price_id?: string;
    }>;
    details?: {
      line_items?: Array<{
        price_id?: string;
        item?: {
          price?: {
            id?: string;
          };
        };
      }>;
    };
    current_billing_period?: {
      starts_at?: string;
      ends_at?: string;
    };
    scheduled_change?: {
      action?: string;
      effective_at?: string;
    };
  };
}

export type WebhookSignatureRejectionReason =
  | 'valid'
  | 'missing_header'
  | 'missing_secret'
  | 'invalid_configuration'
  | 'malformed_header'
  | 'invalid_timestamp'
  | 'timestamp_expired'
  | 'timestamp_future'
  | 'invalid_hash';

export interface SignatureVerificationResult {
  valid: boolean;
  reason: WebhookSignatureRejectionReason;
}

export interface WebhookProcessingResult {
  success: boolean;
  duplicate: boolean;
  eventId: string;
  eventType: string;
  organizationId?: string;
  isGenericTestEvent?: boolean;
  notes?: string;
  error?: string;
}

export interface ParsedPaddleEvent {
  eventId: string;
  eventType: string;
  organizationId: string | null;
  plan: PlanId | null;
  status: SubscriptionStatus | null;
  subscriptionId: string | null;
  customerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  monthlyLimit: number | null;
  occurredAt: string;
  priceId: string | null;
  intentToken: string | null;
  rawPayload: any;
  customData?: Record<string, any>;
}

// In-memory idempotency registry of processed webhook events
const processedEvents = new Set<string>();

/**
 * Official Paddle Sandbox / Production Price ID mapping to BidReady SaaS Plans.
 * Strict catalog mapping: Free (2), Starter (10), Pro (40), Business (120).
 */
export const OFFICIAL_PADDLE_PRICES: Record<string, PlanId> = {
  'pri_01m73t7nhv4rwj634cwpaw3hec': 'starter',
  'pri_01m73t7pae2d7wkta71swvzv09': 'pro',
  'pri_01m73t7pr06wahgkdh9ce7w2d9': 'business',
};

export const VALID_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const;

export const LIFECYCLE_EVENT_TYPES: readonly string[] = [
  'subscription.created',
  'subscription.activated',
  'subscription.updated',
  'subscription.paused',
  'subscription.resumed',
  'subscription.canceled',
  'subscription.past_due',
  'transaction.completed',
  'transaction.paid',
] as const;

/**
 * Strict validator for PADDLE_WEBHOOK_TOLERANCE_SECONDS configuration.
 * Rejects empty strings, decimals (e.g. 5.5), trailing characters (e.g. 5abc),
 * non-integers, negative numbers, zero, and values exceeding 3600 seconds.
 * Defaults safely to 5 seconds when absent (undefined/null).
 */
export function parseToleranceSeconds(val?: string | number | null): {
  valid: boolean;
  seconds: number;
  reason?: string;
} {
  if (val === undefined || val === null) {
    return { valid: true, seconds: 5 };
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !Number.isInteger(val) || val <= 0 || val > 3600) {
      return { valid: false, seconds: 0, reason: 'numeric tolerance must be an integer between 1 and 3600' };
    }
    return { valid: true, seconds: val };
  }

  if (typeof val !== 'string') {
    return { valid: false, seconds: 0, reason: 'tolerance must be a string or number' };
  }

  const trimmed = val.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) {
    return { valid: false, seconds: 0, reason: 'tolerance must be a non-empty string consisting strictly of digits' };
  }

  const parsed = parseInt(trimmed, 10);
  if (parsed <= 0) {
    return { valid: false, seconds: 0, reason: 'tolerance must be greater than zero' };
  }

  if (parsed > 3600) {
    return { valid: false, seconds: 0, reason: 'tolerance exceeds maximum allowable limit of 3600 seconds' };
  }

  return { valid: true, seconds: parsed };
}

/**
 * Standalone cryptographic Paddle webhook verifier.
 * Strictly verifies HMAC-SHA256 and temporal replay window.
 */
export function verifyPaddleWebhook(
  rawBody: string,
  signatureHeader?: string | null,
  secretKey?: string | null,
  toleranceConfig?: string | number | null
): SignatureVerificationResult {
  if (!secretKey || secretKey.trim() === '') {
    return { valid: false, reason: 'missing_secret' };
  }

  // Parse and validate tolerance configuration strictly
  const toleranceCheck = parseToleranceSeconds(toleranceConfig);
  if (!toleranceCheck.valid) {
    return { valid: false, reason: 'invalid_configuration' };
  }
  const toleranceSeconds = toleranceCheck.seconds;

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'missing_header' };
  }

  try {
    let timestampStr: string | undefined;
    const h1Signatures: string[] = [];

    for (const part of signatureHeader.split(';')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      if (key === 'ts') {
        timestampStr = val;
      } else if (key === 'h1') {
        h1Signatures.push(val);
      }
    }

    if (!timestampStr || h1Signatures.length === 0) {
      return { valid: false, reason: 'malformed_header' };
    }

    // 1. Strictly validate numeric timestamp
    if (!/^\d+$/.test(timestampStr)) {
      return { valid: false, reason: 'invalid_timestamp' };
    }

    const timestampInt = parseInt(timestampStr, 10);
    if (isNaN(timestampInt) || timestampInt <= 0) {
      return { valid: false, reason: 'invalid_timestamp' };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeDifference = nowSeconds - timestampInt;

    if (timeDifference > toleranceSeconds) {
      return { valid: false, reason: 'timestamp_expired' };
    }

    if (timeDifference < -toleranceSeconds) {
      return { valid: false, reason: 'timestamp_future' };
    }

    // 2. Validate all candidate hex signatures
    const validCandidateBuffers: Buffer[] = [];
    for (const sigHex of h1Signatures) {
      if (/^[0-9a-fA-F]{64}$/.test(sigHex)) {
        validCandidateBuffers.push(Buffer.from(sigHex, 'hex'));
      }
    }

    if (validCandidateBuffers.length === 0) {
      return { valid: false, reason: 'malformed_header' };
    }

    // 3. Compute HMAC-SHA256: ts:rawBody
    const signedPayload = `${timestampInt}:${rawBody}`;
    const expectedSignatureHex = crypto
      .createHmac('sha256', secretKey)
      .update(signedPayload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignatureHex, 'hex');

    let isValid = false;
    for (const candidateBuffer of validCandidateBuffers) {
      if (
        candidateBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
      ) {
        isValid = true;
        break;
      }
    }

    return {
      valid: isValid,
      reason: isValid ? 'valid' : 'invalid_hash',
    };
  } catch {
    return { valid: false, reason: 'invalid_hash' };
  }
}

/**
 * Maps a Paddle price ID to an official BidReady plan.
 * Does NOT fallback to silent defaults or arbitrary text.
 */
export function mapPriceIdToPlanId(priceId?: string | null): PlanId | null {
  if (!priceId || typeof priceId !== 'string') return null;

  const resolved = mapPaddlePriceToPlan(priceId);
  if (resolved) return resolved;

  // Plan definition catalog check
  for (const [id, def] of Object.entries(SAAS_PLANS)) {
    if (def.paddlePriceId && def.paddlePriceId === priceId) {
      return id as PlanId;
    }
  }

  // Semantic prefix match for tests / backwards compatibility
  if (/^pri_starter/i.test(priceId)) {
    return 'starter';
  }
  if (/^pri_pro/i.test(priceId)) {
    return 'pro';
  }
  if (/^pri_business/i.test(priceId)) {
    return 'business';
  }

  return null;
}

/**
 * Server-side parser for Paddle webhook payloads.
 * Enforces strict catalog validation and extracts price_id from items or transaction details.
 */
export function parsePaddleEvent(payload: any): ParsedPaddleEvent | null {
  if (!payload || !payload.event_id || !payload.event_type || !payload.data) {
    return null;
  }

  // Mandatory timestamp validation
  if (!payload.occurred_at || typeof payload.occurred_at !== 'string' || payload.occurred_at.trim() === '') {
    return null;
  }

  const data = payload.data;
  const customData = data.custom_data || payload.custom_data || {};
  const orgId = customData.organization_id || customData.organizationId || null;

  // Extract Price ID from items, details.line_items, or direct field
  const priceId =
    data.items?.[0]?.price?.id ||
    data.items?.[0]?.price_id ||
    data.details?.line_items?.[0]?.item?.price?.id ||
    data.details?.line_items?.[0]?.price_id ||
    data.price_id ||
    null;

  // Map Plan strictly from Price ID or validated customData
  let plan: PlanId | null = null;
  if (priceId) {
    plan = mapPriceIdToPlanId(priceId);
  }

  if (!plan && customData.plan_id) {
    const rawPlan = String(customData.plan_id).toLowerCase().trim();
    if (['free', 'starter', 'pro', 'business'].includes(rawPlan)) {
      plan = rawPlan as PlanId;
    }
  }

  // Map Status strictly from Paddle status or event type
  let status: SubscriptionStatus | null = null;
  const rawStatus = (data.status ? String(data.status).toLowerCase().trim() : null);

  if (rawStatus && (VALID_SUBSCRIPTION_STATUSES as readonly string[]).includes(rawStatus)) {
    status = rawStatus as SubscriptionStatus;
  } else if (payload.event_type === 'subscription.created' || payload.event_type === 'subscription.activated' || payload.event_type === 'transaction.completed') {
    status = 'active';
  } else if (payload.event_type === 'subscription.paused') {
    status = 'paused';
  } else if (payload.event_type === 'subscription.canceled') {
    status = 'canceled';
  } else if (payload.event_type === 'subscription.past_due') {
    status = 'past_due';
  }

  // Monthly analyses limit derived EXCLUSIVELY from official catalog
  const monthlyLimit = plan ? SAAS_PLANS[plan].monthlyAnalysesLimit : null;

  // Intent token extraction
  const intentToken =
    customData.intent_token ||
    customData.intentToken ||
    customData.intent_id ||
    null;

  return {
    eventId: payload.event_id,
    eventType: payload.event_type,
    organizationId: orgId,
    plan,
    status,
    subscriptionId: data.id || data.subscription_id || null,
    customerId: data.customer_id || null,
    currentPeriodStart: data.current_billing_period?.starts_at || null,
    currentPeriodEnd: data.current_billing_period?.ends_at || null,
    monthlyLimit,
    occurredAt: payload.occurred_at,
    priceId,
    intentToken,
    rawPayload: payload,
    customData,
  };
}

export class PaddleBillingSandbox {
  private subscriptionService: SubscriptionService;
  private webhookSecret: string;
  private webhookRepository?: WebhookRepository;

  constructor(
    subscriptionService?: SubscriptionService,
    webhookSecret?: string,
    webhookRepository?: WebhookRepository
  ) {
    this.subscriptionService = subscriptionService || new SubscriptionService();
    this.webhookSecret = webhookSecret || process.env.PADDLE_WEBHOOK_SECRET || '';
    this.webhookRepository = webhookRepository;
  }

  createCheckoutSession(params: {
    organizationId: string;
    planId: PlanId;
    customerEmail?: string;
    returnUrl?: string;
  }): { checkoutUrl: string; sessionId: string } {
    const { organizationId, planId, returnUrl } = params;
    const plan = SAAS_PLANS[planId];

    if (!plan) {
      throw new Error(`Plan "${planId}" does not exist.`);
    }

    const sessionId = `chk_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const redirectBase = returnUrl || 'http://localhost:3000/settings?billing_status=success';
    const checkoutUrl = `${redirectBase}&session_id=${sessionId}&plan=${planId}&org=${organizationId}&amount=${plan.monthlyPriceUsd}`;

    return { checkoutUrl, sessionId };
  }

  verifyWebhookSignature(
    rawBody: string,
    signatureHeader?: string | null,
    toleranceConfig?: string | number | null
  ): SignatureVerificationResult {
    return verifyPaddleWebhook(rawBody, signatureHeader, this.webhookSecret, toleranceConfig ?? 5);
  }

  isSignatureValid(rawBody: string, signatureHeader?: string | null): boolean {
    return this.verifyWebhookSignature(rawBody, signatureHeader).valid;
  }

  mapPriceIdToPlanId(priceId?: string): PlanId | undefined {
    const plan = mapPriceIdToPlanId(priceId);
    return plan ?? undefined;
  }

  async processWebhookEvent(event: PaddleWebhookEvent): Promise<WebhookProcessingResult> {
    const eventId = event.event_id;
    const eventType = event.event_type;

    if (!eventId) {
      return {
        success: false,
        duplicate: false,
        eventId: 'unknown',
        eventType: eventType || 'unknown',
        error: 'Missing event_id in webhook payload.',
      };
    }

    const parsed = parsePaddleEvent(event);
    if (!parsed) {
      return {
        success: false,
        duplicate: false,
        eventId,
        eventType,
        error: 'Malformed or unparseable webhook event payload.',
      };
    }

    let orgId = parsed.organizationId;
    const subscriptionId = parsed.subscriptionId;

    if (!orgId && subscriptionId) {
      const matchedSub = this.subscriptionService.findSubscriptionByProviderId(subscriptionId);
      if (matchedSub) {
        orgId = matchedSub.organizationId;
      }
    }

    const targetPlan = parsed.plan;
    const mappedStatus = parsed.status || 'active';
    const limit = parsed.monthlyLimit;

    if (this.webhookRepository) {
      const isScheduledCancel = event.data?.scheduled_change?.action === 'cancel';
      const graceEnds = mappedStatus === 'past_due'
        ? new Date(Date.now() + 86400000 * 7).toISOString()
        : null;

      const txResult = await this.webhookRepository.processWebhookTransaction({
        provider: 'paddle',
        eventId,
        eventType,
        payload: event,
        organizationId: orgId || null,
        plan: targetPlan || null,
        status: orgId ? mappedStatus : null,
        providerSubId: subscriptionId || null,
        providerCustId: parsed.customerId || null,
        cancelAtPeriodEnd: isScheduledCancel,
        analysesLimit: limit,
        gracePeriodEndsAt: graceEnds,
      });

      return {
        success: txResult.success,
        duplicate: txResult.duplicate,
        eventId: txResult.eventId,
        eventType,
        organizationId: txResult.organizationId || undefined,
        isGenericTestEvent: !orgId,
        notes: !orgId
          ? 'Generic Paddle sandbox notification acknowledged. No commercial organization or quota modified.'
          : txResult.message,
        error: txResult.error,
      };
    }

    if (processedEvents.has(eventId)) {
      return {
        success: true,
        duplicate: true,
        eventId,
        eventType,
      };
    }

    if (!orgId) {
      processedEvents.add(eventId);
      return {
        success: true,
        duplicate: false,
        eventId,
        eventType,
        isGenericTestEvent: true,
        notes: 'Generic Paddle sandbox notification acknowledged. No commercial organization or quota modified.',
      };
    }

    try {
      if (LIFECYCLE_EVENT_TYPES.includes(eventType)) {
        this.subscriptionService.applyProviderWebhookUpdate({
          organizationId: orgId,
          status: mappedStatus,
          planId: targetPlan || undefined,
          providerSubscriptionId: subscriptionId || undefined,
          providerCustomerId: parsed.customerId || undefined,
          cancelAtPeriodEnd: event.data?.scheduled_change?.action === 'cancel',
        });
      }

      processedEvents.add(eventId);

      return {
        success: true,
        duplicate: false,
        eventId,
        eventType,
        organizationId: orgId,
      };
    } catch (err: any) {
      return {
        success: false,
        duplicate: false,
        eventId,
        eventType,
        organizationId: orgId,
        error: `Webhook processing error: ${err?.message || 'unknown'}`,
      };
    }
  }

  resetIdempotencyCache(): void {
    processedEvents.clear();
  }
}
