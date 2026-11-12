import { describe, it, expect, beforeEach } from 'vitest';
import { PaddleBillingSandbox, PaddleWebhookEvent } from '../src/lib/billing/paddle-sandbox';
import { SubscriptionService } from '../src/lib/billing/subscription-service';
import { SAAS_PLANS } from '../src/types/billing';

describe('Paddle Subscription Lifecycle & State Machine (M4.8)', () => {
  let subscriptionService: SubscriptionService;
  let sandbox: PaddleBillingSandbox;
  const testSecret = 'pdl_ntfset_test_secret_for_lifecycle_suite';

  beforeEach(() => {
    subscriptionService = new SubscriptionService();
    sandbox = new PaddleBillingSandbox(subscriptionService, testSecret);
  });

  describe('1. Subscription State Machine: Paused & Resumed Lifecycle', () => {
    it('processes subscription.paused and enforces access blocking', async () => {
      const orgId = `org-pause-${Date.now()}`;
      const subId = `sub_pause_${Date.now()}`;

      // 1. Activate initial subscription
      await sandbox.processWebhookEvent({
        event_id: `evt_act_${Date.now()}`,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          customer_id: 'ctm_pause_1',
          status: 'active',
          custom_data: {
            organization_id: orgId,
            plan_id: 'starter',
          },
        },
      });

      let sub = subscriptionService.getSubscription(orgId);
      expect(sub.status).toBe('active');
      expect(subscriptionService.checkAnalysisQuota(orgId).allowed).toBe(true);

      // 2. Pause subscription
      const pauseResult = await sandbox.processWebhookEvent({
        event_id: `evt_pause_${Date.now()}`,
        event_type: 'subscription.paused',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          status: 'paused',
          custom_data: { organization_id: orgId },
        },
      });

      expect(pauseResult.success).toBe(true);
      sub = subscriptionService.getSubscription(orgId);
      expect(sub.status).toBe('paused');

      // Check analysis quota strictly blocks while paused
      const quotaCheck = subscriptionService.checkAnalysisQuota(orgId);
      expect(quotaCheck.allowed).toBe(false);
      expect(quotaCheck.status).toBe('paused');
      expect(quotaCheck.rejectionReason).toContain('Subscription is currently paused');

      // 3. Resume subscription
      const resumeResult = await sandbox.processWebhookEvent({
        event_id: `evt_resume_${Date.now()}`,
        event_type: 'subscription.resumed',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          status: 'active',
          custom_data: { organization_id: orgId },
        },
      });

      expect(resumeResult.success).toBe(true);
      sub = subscriptionService.getSubscription(orgId);
      expect(sub.status).toBe('active');
      expect(subscriptionService.checkAnalysisQuota(orgId).allowed).toBe(true);
    });
  });

  describe('2. Reverse Lookup via providerSubscriptionId (Omitted custom_data)', () => {
    it('successfully locates organization and applies state update when custom_data is omitted in subsequent events', async () => {
      const orgId = `org-rev-lookup-${Date.now()}`;
      const subscriptionId = `sub_paddle_tracked_${Date.now()}`;

      // Initial activation associates organization with subscriptionId
      await sandbox.processWebhookEvent({
        event_id: `evt_init_${Date.now()}`,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: subscriptionId,
          customer_id: 'ctm_rev_1',
          status: 'active',
          custom_data: {
            organization_id: orgId,
            plan_id: 'pro',
          },
        },
      });

      // Subsequent event: payment failed / past_due WITHOUT custom_data
      const unpopulatedPastDueEvent: PaddleWebhookEvent = {
        event_id: `evt_subsequent_${Date.now()}`,
        event_type: 'subscription.past_due',
        occurred_at: new Date().toISOString(),
        data: {
          id: subscriptionId, // providerSubscriptionId matches!
          status: 'past_due',
          // custom_data is intentionally omitted!
        },
      };

      const result = await sandbox.processWebhookEvent(unpopulatedPastDueEvent);
      expect(result.success).toBe(true);
      expect(result.organizationId).toBe(orgId); // Located via reverse lookup!

      const updatedSub = subscriptionService.getSubscription(orgId);
      expect(updatedSub.status).toBe('past_due');
      expect(updatedSub.gracePeriodEndsAt).toBeDefined();
    });
  });

  describe('3. Price ID to Plan ID Mapping', () => {
    it('maps semantic and catalog price IDs to corresponding plan tiers and quotas', async () => {
      const orgId = `org-price-mapping-${Date.now()}`;
      const subId = `sub_price_${Date.now()}`;

      // 1. Map Starter price
      await sandbox.processWebhookEvent({
        event_id: `evt_starter_pri_${Date.now()}`,
        event_type: 'subscription.created',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          items: [{ price: { id: 'pri_starter_monthly_usd' } }],
          custom_data: { organization_id: orgId },
        },
      });

      let sub = subscriptionService.getSubscription(orgId);
      expect(sub.planId).toBe('starter');
      expect(sub.monthlyAnalysesLimit).toBe(10);

      // 2. Map Pro price upgrade
      await sandbox.processWebhookEvent({
        event_id: `evt_pro_pri_${Date.now()}`,
        event_type: 'subscription.updated',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          items: [{ price: { id: 'pri_pro_monthly_defense' } }],
          custom_data: { organization_id: orgId },
        },
      });

      sub = subscriptionService.getSubscription(orgId);
      expect(sub.planId).toBe('pro');
      expect(sub.monthlyAnalysesLimit).toBe(40);

      // 3. Map Business price upgrade
      await sandbox.processWebhookEvent({
        event_id: `evt_bus_pri_${Date.now()}`,
        event_type: 'subscription.updated',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          items: [{ price: { id: 'pri_business_global_usd' } }],
          custom_data: { organization_id: orgId },
        },
      });

      sub = subscriptionService.getSubscription(orgId);
      expect(sub.planId).toBe('business');
      expect(sub.monthlyAnalysesLimit).toBe(120);
    });
  });

  describe('4. Cancellation Lifecycle: Scheduled vs Effective', () => {
    it('preserves quota access for scheduled cancellation until period end', async () => {
      const orgId = `org-scheduled-cancel-${Date.now()}`;
      const subId = `sub_sched_cancel_${Date.now()}`;

      // Activate subscription
      await sandbox.processWebhookEvent({
        event_id: `evt_active_${Date.now()}`,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          custom_data: { organization_id: orgId, plan_id: 'pro' },
        },
      });

      // Scheduled cancellation webhook (Paddle sends subscription.updated with scheduled_change)
      await sandbox.processWebhookEvent({
        event_id: `evt_sched_change_${Date.now()}`,
        event_type: 'subscription.updated',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          status: 'active', // still active during the paid month
          scheduled_change: {
            action: 'cancel',
            effective_at: new Date(Date.now() + 86400000 * 20).toISOString(),
          },
          custom_data: { organization_id: orgId },
        },
      });

      const sub = subscriptionService.getSubscription(orgId);
      expect(sub.cancelAtPeriodEnd).toBe(true);

      // Access is still granted because the paid month has not expired
      const quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(true);
    });

    it('immediately denies access once effective cancellation occurs', async () => {
      const orgId = `org-effective-cancel-${Date.now()}`;
      const subId = `sub_eff_cancel_${Date.now()}`;

      // Send subscription.canceled
      await sandbox.processWebhookEvent({
        event_id: `evt_cancel_final_${Date.now()}`,
        event_type: 'subscription.canceled',
        occurred_at: new Date().toISOString(),
        data: {
          id: subId,
          status: 'canceled',
          custom_data: { organization_id: orgId, plan_id: 'starter' },
        },
      });

      const sub = subscriptionService.getSubscription(orgId);
      expect(sub.status).toBe('canceled');
      expect(sub.cancelAtPeriodEnd).toBe(false);

      // Quota is immediately rejected
      const quota = subscriptionService.checkAnalysisQuota(orgId);
      expect(quota.allowed).toBe(false);
      expect(quota.rejectionReason).toContain('canceled and the active billing period has expired');
    });
  });
});
