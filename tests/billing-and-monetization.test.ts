import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SubscriptionService } from '../src/lib/billing/subscription-service';
import { PaddleBillingSandbox, PaddleWebhookEvent } from '../src/lib/billing/paddle-sandbox';
import { SAAS_PLANS, PlanId } from '../src/types/billing';

describe('Milestone 4 — Production Billing, Subscriptions & Monetization Suite', () => {
  let subscriptionService: SubscriptionService;
  let paddleSandbox: PaddleBillingSandbox;
  const testSecret = 'test_webhook_secret_key_12345';

  beforeEach(() => {
    subscriptionService = new SubscriptionService();
    paddleSandbox = new PaddleBillingSandbox(subscriptionService, testSecret);
  });

  describe('1. SaaS Tier & Plan Configurations', () => {
    it('defines valid tiers matching Master Instruction (Free, Starter, Pro, Business)', () => {
      expect(SAAS_PLANS.free).toBeDefined();
      expect(SAAS_PLANS.free.monthlyPriceUsd).toBe(0);
      expect(SAAS_PLANS.free.monthlyAnalysesLimit).toBe(2);

      expect(SAAS_PLANS.starter).toBeDefined();
      expect(SAAS_PLANS.starter.monthlyPriceUsd).toBe(29);
      expect(SAAS_PLANS.starter.monthlyAnalysesLimit).toBe(10);

      expect(SAAS_PLANS.pro).toBeDefined();
      expect(SAAS_PLANS.pro.monthlyPriceUsd).toBe(69);
      expect(SAAS_PLANS.pro.monthlyAnalysesLimit).toBe(40);

      expect(SAAS_PLANS.business).toBeDefined();
      expect(SAAS_PLANS.business.monthlyPriceUsd).toBe(149);
      expect(SAAS_PLANS.business.monthlyAnalysesLimit).toBe(120);
    });
  });

  describe('2. Quota Check & Server-Side Enforcement', () => {
    it('initializes new organizations with Free plan default (2 analyses limit)', () => {
      const orgId = `org-test-quota-${Date.now()}`;
      const sub = subscriptionService.getSubscription(orgId);

      expect(sub.organizationId).toBe(orgId);
      expect(sub.planId).toBe('free');
      expect(sub.monthlyAnalysesLimit).toBe(2);
      expect(sub.analysesUsedInPeriod).toBe(0);
      expect(sub.status).toBe('active');

      const quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(true);
      expect(quota.remaining).toBe(2);
    });

    it('blocks execution when analysis quota limit is reached', () => {
      const orgId = `org-capped-${Date.now()}`;
      const sub = subscriptionService.getSubscription(orgId);

      // Simulate consuming 2 analyses out of 2 allowed
      subscriptionService.recordAnalysisConsumption({
        organizationId: orgId,
        documentId: 'doc-1',
        success: true,
      });
      subscriptionService.recordAnalysisConsumption({
        organizationId: orgId,
        documentId: 'doc-2',
        success: true,
      });

      const updatedSub = subscriptionService.getSubscription(orgId);
      expect(updatedSub.analysesUsedInPeriod).toBe(2);

      const quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(false);
      expect(quota.remaining).toBe(0);
      expect(quota.rejectionReason).toContain('Monthly analysis quota reached');
    });

    it('CRITICAL: never decrements or charges quota on failed document parsing/analysis', () => {
      const orgId = `org-failsafe-${Date.now()}`;
      subscriptionService.getSubscription(orgId);

      // Record a failed analysis attempt (e.g., malformed PDF or AI API error)
      subscriptionService.recordAnalysisConsumption({
        organizationId: orgId,
        documentId: 'doc-corrupted',
        success: false,
        failureReason: 'Magic byte verification failed: Corrupted document body',
      });

      const sub = subscriptionService.getSubscription(orgId);
      expect(sub.analysesUsedInPeriod).toBe(0); // Quota remains completely untouched!

      const auditLogs = subscriptionService.getUsageAuditLogs(orgId);
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].analysesCounted).toBe(0);
      expect(auditLogs[0].successfulRun).toBe(false);
      expect(auditLogs[0].notes).toContain('quota not charged');
    });
  });

  describe('3. Plan Upgrades, Downgrades & Quota Expansion', () => {
    it('instantly elevates quota upon plan upgrade', () => {
      const orgId = `org-upgrade-${Date.now()}`;
      subscriptionService.getSubscription(orgId);

      // Upgrade to Starter
      const upgradedStarter = subscriptionService.changePlan(orgId, 'starter');
      expect(upgradedStarter.planId).toBe('starter');
      expect(upgradedStarter.monthlyAnalysesLimit).toBe(10);

      let quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.remaining).toBe(10);

      // Upgrade to Pro
      const upgradedPro = subscriptionService.changePlan(orgId, 'pro');
      expect(upgradedPro.planId).toBe('pro');
      expect(upgradedPro.monthlyAnalysesLimit).toBe(40);

      quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.remaining).toBe(40);
    });

    it('handles cancellation: allows usage until period end, then strictly blocks', () => {
      const orgId = `org-cancel-${Date.now()}`;
      const sub = subscriptionService.getSubscription(orgId);

      // Cancel at period end
      subscriptionService.cancelSubscription(orgId, true);
      const activeCancelled = subscriptionService.getSubscription(orgId);
      expect(activeCancelled.cancelAtPeriodEnd).toBe(true);

      // Still allowed because currentPeriodEnd is in the future
      let quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(true);

      // Now simulate period expiration after cancellation
      activeCancelled.status = 'canceled';
      activeCancelled.currentPeriodEnd = new Date(Date.now() - 1000).toISOString(); // expired yesterday

      quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(false);
      expect(quota.rejectionReason).toContain('canceled and the active billing period has expired');
    });
  });

  describe('4. Delinquency & Grace Period Handling', () => {
    it('allows document processing during active 7-day past_due grace period', () => {
      const orgId = `org-grace-${Date.now()}`;
      subscriptionService.getSubscription(orgId);

      // Set past_due with active 7-day grace period
      subscriptionService.applyProviderWebhookUpdate({
        organizationId: orgId,
        status: 'past_due',
        gracePeriodEndsAt: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days left
      });

      const quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(true);
      expect(quota.isInGracePeriod).toBe(true);
    });

    it('blocks processing once past_due grace period has expired', () => {
      const orgId = `org-grace-expired-${Date.now()}`;
      subscriptionService.getSubscription(orgId);

      // Set past_due with expired grace period
      subscriptionService.applyProviderWebhookUpdate({
        organizationId: orgId,
        status: 'past_due',
        gracePeriodEndsAt: new Date(Date.now() - 3600000).toISOString(), // expired 1 hour ago
      });

      const quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(false);
      expect(quota.isInGracePeriod).toBe(false);
      expect(quota.rejectionReason).toContain('Payment is past due and the 7-day grace period has expired');
    });
  });

  describe('5. Paddle Merchant of Record (MoR) Sandbox & Webhooks', () => {
    it('generates sandbox checkout sessions with proper metadata and redirect parameters', () => {
      const checkout = paddleSandbox.createCheckoutSession({
        organizationId: 'org-sample-123',
        planId: 'pro',
        customerEmail: 'finance@bidready-demo.com',
      });

      expect(checkout.sessionId).toBeDefined();
      expect(checkout.sessionId).toContain('chk_sandbox_');
      expect(checkout.checkoutUrl).toContain('plan=pro');
      expect(checkout.checkoutUrl).toContain('org=org-sample-123');
      expect(checkout.checkoutUrl).toContain('amount=69');
    });

    it('validates authentic Paddle HMAC-SHA256 signatures correctly', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_123' });

      // Generate valid signature using test secret
      const signedPayload = `${timestamp}:${payload}`;
      const h1 = crypto.createHmac('sha256', testSecret).update(signedPayload).digest('hex');
      const signatureHeader = `ts=${timestamp};h1=${h1}`;

      const result = paddleSandbox.verifyWebhookSignature(payload, signatureHeader);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('rejects tampered or forged webhook signatures', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_tampered' });
      const badHeader = `ts=${timestamp};h1=${'0'.repeat(64)}`;

      const result = paddleSandbox.verifyWebhookSignature(payload, badHeader);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_hash');
    });

    it('processes subscription.activated webhooks to upgrade tier', async () => {
      const orgId = `org-webhook-upgrade-${Date.now()}`;
      subscriptionService.getSubscription(orgId);

      const webhookEvent: PaddleWebhookEvent = {
        event_id: `evt_act_${Date.now()}`,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: 'sub_paddle_live_999',
          customer_id: 'ctm_paddle_001',
          status: 'active',
          custom_data: {
            organization_id: orgId,
            plan_id: 'business',
          },
        },
      };

      const result = await paddleSandbox.processWebhookEvent(webhookEvent);
      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);

      const sub = subscriptionService.getSubscription(orgId);
      expect(sub.planId).toBe('business');
      expect(sub.monthlyAnalysesLimit).toBe(120);
      expect(sub.providerSubscriptionId).toBe('sub_paddle_live_999');
    });

    it('enforces webhook idempotency: duplicate events are safely ignored without re-processing', async () => {
      const orgId = `org-idempotency-${Date.now()}`;
      subscriptionService.getSubscription(orgId);

      const eventId = `evt_idempotent_${Date.now()}`;
      const webhookEvent: PaddleWebhookEvent = {
        event_id: eventId,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: 'sub_paddle_idemp_1',
          customer_id: 'ctm_idemp_1',
          status: 'active',
          custom_data: {
            organization_id: orgId,
            plan_id: 'starter',
          },
        },
      };

      // First delivery: processes successfully
      const firstRun = await paddleSandbox.processWebhookEvent(webhookEvent);
      expect(firstRun.success).toBe(true);
      expect(firstRun.duplicate).toBe(false);

      // Second delivery with identical event_id (simulating network retry from Paddle)
      const secondRun = await paddleSandbox.processWebhookEvent(webhookEvent);
      expect(secondRun.success).toBe(true);
      expect(secondRun.duplicate).toBe(true);
    });
  });
});
