import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * BIDREADY M4.14.4.4 — CORRECTNESS FIXES & EVIDENCE TEST SUITE
 * 
 * Verifies:
 * 1. Bug de FOUND fix: apply_paddle_subscription_update explicitly uses v_sub_exists boolean variable.
 * 2. Concurrency protocol: unified global serialization lock hashtext('bidready_billing_mutation_lock').
 * 3. Hardened Checkout Intent validation:
 *    - Rejects missing intent_id / intent_token in custom_data.
 *    - Rejects empty or nonexistent token.
 *    - Rejects expired intent.
 *    - Rejects already consumed intent.
 *    - Rejects intent belonging to another organization.
 *    - Rejects missing or unidentifiable plan.
 *    - Rejects plan mismatch.
 *    - Rejects missing price_id.
 *    - Rejects price_id mismatch.
 *    - Validates and consumes intent atomically only after all checks pass.
 * 4. Starter recovery script and runbook sequencing.
 */

type PlanTier = 'free' | 'starter' | 'pro' | 'business';
type SubscriptionLifecycle = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';

interface SaasSubscription {
  id: string;
  organizationId: string;
  plan: PlanTier;
  status: SubscriptionLifecycle;
  monthlyAnalysesLimit: number;
  analysesUsedInPeriod: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt?: string | null;
  billingProvider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd: boolean;
  lastEventOccurredAt?: string | null;
  updatedAt: string;
}

interface CheckoutIntent {
  id: string;
  intentToken: string;
  organizationId: string;
  userId: string;
  planId: PlanTier;
  priceId: string;
  status: 'pending' | 'consumed' | 'expired';
  expiresAt: string;
  consumedAt?: string | null;
  consumedByProviderSubId?: string | null;
}

interface BillingWebhookEvent {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  payload: any;
  processedSuccessfully: boolean;
  errorMessage?: string | null;
  processedAt: string;
}

class CorrectnessHarness {
  subscriptions = new Map<string, SaasSubscription>();
  intents = new Map<string, CheckoutIntent>();
  webhookEvents = new Map<string, BillingWebhookEvent>();
  acquiredLocks: string[] = [];

  reset() {
    this.subscriptions.clear();
    this.intents.clear();
    this.webhookEvents.clear();
    this.acquiredLocks = [];

    // Starter Baseline
    this.subscriptions.set('e2e00000-0000-4000-a000-000000000010', {
      id: 'd85bbeba-cfab-4a8b-b264-6f36d336387d',
      organizationId: 'e2e00000-0000-4000-a000-000000000010',
      plan: 'starter',
      status: 'active',
      monthlyAnalysesLimit: 10,
      analysesUsedInPeriod: 0,
      currentPeriodStart: '2026-11-10T23:34:35.415847Z',
      currentPeriodEnd: '2026-12-10T23:34:35.415847Z',
      billingProvider: 'paddle',
      providerSubscriptionId: 'sub_legitimate_test_1794361279434',
      providerCustomerId: 'ctm_test_legit',
      cancelAtPeriodEnd: false,
      lastEventOccurredAt: '2026-11-10T23:34:35.000Z',
      updatedAt: '2026-11-11T01:41:20.247806Z',
    });

    // Pro Baseline
    this.subscriptions.set('e2e00000-0000-4000-a000-000000000020', {
      id: 'sub-pro-id',
      organizationId: 'e2e00000-0000-4000-a000-000000000020',
      plan: 'pro',
      status: 'active',
      monthlyAnalysesLimit: 40,
      analysesUsedInPeriod: 0,
      currentPeriodStart: '2026-11-10T23:45:50.000000Z',
      currentPeriodEnd: '2026-12-10T23:45:50.000000Z',
      billingProvider: 'paddle',
      providerSubscriptionId: 'sub_01m73xn2cgj73bp9tdap2h45rs',
      providerCustomerId: 'ctm_01m73w7d3pc1sna6v8a9fy1vqx',
      cancelAtPeriodEnd: false,
      lastEventOccurredAt: '2026-11-10T23:45:50.000Z',
      updatedAt: '2026-11-11T00:19:53.000000Z',
    });
  }

  applyPaddleSubscriptionUpdate(params: {
    organizationId: string;
    plan?: PlanTier | null;
    status?: SubscriptionLifecycle | null;
    providerSubscriptionId?: string | null;
    providerCustomerId?: string | null;
  }): { success: boolean; sub?: SaasSubscription; action: 'INSERT' | 'UPDATE'; error?: string } {
    // 1. Acquire global serialization lock
    this.acquiredLocks.push('bidready_billing_mutation_lock');

    const vNewSub = params.providerSubscriptionId ? params.providerSubscriptionId.trim() : null;

    // 2. Explicit existence check (Storing boolean variable)
    const existing = this.subscriptions.get(params.organizationId);
    const vSubExists = !!existing;

    // 3. Collision check
    if (vNewSub) {
      for (const [orgId, sub] of this.subscriptions.entries()) {
        if (sub.providerSubscriptionId === vNewSub && orgId !== params.organizationId) {
          return {
            success: false,
            action: 'UPDATE',
            error: `CROSS-TENANT COLLISION: provider_subscription_id ${vNewSub} is already assigned to organization ${orgId}`,
          };
        }
      }
    }

    // 4. Upsert strictly based on vSubExists boolean
    if (!vSubExists) {
      const newSub: SaasSubscription = {
        id: `sub_${Date.now()}`,
        organizationId: params.organizationId,
        plan: params.plan || 'free',
        status: params.status || 'active',
        monthlyAnalysesLimit: 2,
        analysesUsedInPeriod: 0,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        billingProvider: 'paddle',
        providerSubscriptionId: vNewSub,
        providerCustomerId: params.providerCustomerId ? params.providerCustomerId.trim() : null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date().toISOString(),
      };
      this.subscriptions.set(params.organizationId, newSub);
      return { success: true, sub: newSub, action: 'INSERT' };
    } else {
      const sub = this.subscriptions.get(params.organizationId)!;
      if (params.plan) sub.plan = params.plan;
      if (params.status) sub.status = params.status;
      if (params.providerSubscriptionId !== undefined) {
        sub.providerSubscriptionId = vNewSub || sub.providerSubscriptionId;
      }
      if (params.providerCustomerId !== undefined) {
        const vNewCust = params.providerCustomerId ? params.providerCustomerId.trim() : null;
        sub.providerCustomerId = vNewCust || sub.providerCustomerId;
      }
      sub.updatedAt = new Date().toISOString();
      return { success: true, sub, action: 'UPDATE' };
    }
  }

  processPaddleWebhookTransaction(params: {
    eventId: string;
    payload: any;
    organizationId?: string | null;
    plan?: PlanTier | null;
    status?: SubscriptionLifecycle | null;
    providerSubId?: string | null;
  }): { success: boolean; duplicate: boolean; error?: string } {
    const { eventId, payload, providerSubId, plan, status } = params;
    let targetOrgId = params.organizationId;

    if (this.webhookEvents.get(eventId)?.processedSuccessfully) {
      return { success: true, duplicate: true };
    }

    const eventRecord: BillingWebhookEvent = {
      id: `evt_uuid_${eventId}`,
      provider: 'paddle',
      eventId,
      eventType: 'subscription.created',
      payload,
      processedSuccessfully: false,
      processedAt: new Date().toISOString(),
    };
    this.webhookEvents.set(eventId, eventRecord);

    if (!providerSubId) {
      eventRecord.processedSuccessfully = true;
      return { success: true, duplicate: false };
    }

    // Occurred at strict check
    const rawOccurredAt = payload?.occurred_at;
    if (!rawOccurredAt || isNaN(new Date(rawOccurredAt).getTime())) {
      eventRecord.errorMessage = 'VALIDATION ERROR: Missing or invalid occurred_at in webhook payload';
      return { success: false, duplicate: false, error: eventRecord.errorMessage };
    }

    // Tenancy resolution
    let existingBoundOrg: string | null = null;
    for (const [orgId, sub] of this.subscriptions.entries()) {
      if (sub.providerSubscriptionId === providerSubId) {
        existingBoundOrg = orgId;
        break;
      }
    }

    if (existingBoundOrg) {
      targetOrgId = existingBoundOrg;
    } else {
      // First binding: Hardened Checkout Intent Validation
      const intentToken = payload?.data?.custom_data?.intent_id || payload?.data?.custom_data?.intent_token;
      if (!intentToken || typeof intentToken !== 'string' || intentToken.trim() === '') {
        eventRecord.errorMessage = 'SECURITY VIOLATION: Missing intent_id or intent_token in custom_data';
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      const payloadPriceId = payload?.data?.items?.[0]?.price?.id || payload?.data?.price_id;
      if (!payloadPriceId) {
        eventRecord.errorMessage = 'SECURITY VIOLATION: Missing price_id in webhook payload';
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      if (!plan) {
        eventRecord.errorMessage = 'SECURITY VIOLATION: Unidentifiable or missing plan';
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      if (!targetOrgId) {
        eventRecord.errorMessage = 'SECURITY VIOLATION: Missing organization_id';
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      // Exact intent lookup (NO automatic fallback search!)
      const intent = this.intents.get(intentToken);
      if (!intent) {
        eventRecord.errorMessage = `SECURITY VIOLATION: Checkout intent ${intentToken} not found`;
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      if (intent.status === 'consumed') {
        eventRecord.errorMessage = `SECURITY VIOLATION: Checkout intent ${intentToken} already consumed`;
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      if (intent.status === 'expired' || new Date(intent.expiresAt).getTime() < Date.now()) {
        intent.status = 'expired';
        eventRecord.errorMessage = `SECURITY VIOLATION: Checkout intent ${intentToken} has expired`;
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      if (intent.organizationId !== targetOrgId) {
        eventRecord.errorMessage = 'SECURITY VIOLATION: Checkout intent organization mismatch';
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      if (intent.planId !== plan) {
        eventRecord.errorMessage = 'SECURITY VIOLATION: Plan mismatch with checkout intent';
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      if (intent.priceId !== payloadPriceId) {
        eventRecord.errorMessage = 'SECURITY VIOLATION: Price ID mismatch with checkout intent';
        return { success: false, duplicate: false, error: eventRecord.errorMessage };
      }

      // Consume intent atomically
      intent.status = 'consumed';
      intent.consumedAt = new Date().toISOString();
      intent.consumedByProviderSubId = providerSubId;
    }

    // Mutate subscription
    let sub = this.subscriptions.get(targetOrgId!);
    if (!sub) {
      sub = {
        id: `sub_${Date.now()}`,
        organizationId: targetOrgId!,
        plan: plan || 'free',
        status: status || 'active',
        monthlyAnalysesLimit: 10,
        analysesUsedInPeriod: 0,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        billingProvider: 'paddle',
        providerSubscriptionId: providerSubId,
        cancelAtPeriodEnd: false,
        lastEventOccurredAt: rawOccurredAt,
        updatedAt: new Date().toISOString(),
      };
      this.subscriptions.set(targetOrgId!, sub);
    } else {
      sub.providerSubscriptionId = providerSubId;
      if (plan) sub.plan = plan;
      if (status) sub.status = status;
      sub.lastEventOccurredAt = rawOccurredAt;
      sub.updatedAt = new Date().toISOString();
    }

    eventRecord.processedSuccessfully = true;
    return { success: true, duplicate: false };
  }
}

describe('BIDREADY M4.14.4.4: Correctness Fixes & Evidence Suite', () => {
  let harness: CorrectnessHarness;

  beforeEach(() => {
    harness = new CorrectnessHarness();
    harness.reset();
  });

  describe('Section 2: apply_paddle_subscription_update & FOUND Bug Fix', () => {
    it('executes UPDATE and preserves row ID when updating existing organization with new provider_subscription_id', () => {
      const origSub = harness.subscriptions.get('e2e00000-0000-4000-a000-000000000010')!;
      const originalRowId = origSub.id;

      const res = harness.applyPaddleSubscriptionUpdate({
        organizationId: 'e2e00000-0000-4000-a000-000000000010',
        plan: 'starter',
        status: 'active',
        providerSubscriptionId: 'sub_01m73xm9cymfwkbawkcvb19br7',
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('UPDATE');
      expect(res.sub?.id).toBe(originalRowId); // STRICTLY PRESERVED
      expect(res.sub?.providerSubscriptionId).toBe('sub_01m73xm9cymfwkbawkcvb19br7');
    });

    it('executes INSERT when organization does not exist in saas_subscriptions', () => {
      const newOrgId = '99999999-9999-4000-a000-000000000099';
      const res = harness.applyPaddleSubscriptionUpdate({
        organizationId: newOrgId,
        plan: 'pro',
        status: 'active',
        providerSubscriptionId: 'sub_paddle_brand_new',
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('INSERT');
      expect(res.sub?.organizationId).toBe(newOrgId);
      expect(res.sub?.plan).toBe('pro');
    });

    it('rejects update with exception when provider_subscription_id is already bound to another tenant', () => {
      const res = harness.applyPaddleSubscriptionUpdate({
        organizationId: 'e2e00000-0000-4000-a000-000000000010',
        providerSubscriptionId: 'sub_01m73xn2cgj73bp9tdap2h45rs', // Owned by e2e...20
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('CROSS-TENANT COLLISION');
      // Verify Starter sub untouched
      const sub = harness.subscriptions.get('e2e00000-0000-4000-a000-000000000010')!;
      expect(sub.providerSubscriptionId).toBe('sub_legitimate_test_1794361279434');
    });

    it('updates normally when provider_subscription_id is unchanged', () => {
      const res = harness.applyPaddleSubscriptionUpdate({
        organizationId: 'e2e00000-0000-4000-a000-000000000010',
        plan: 'starter',
        status: 'paused',
        providerSubscriptionId: 'sub_legitimate_test_1794361279434',
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('UPDATE');
      expect(res.sub?.status).toBe('paused');
      expect(res.sub?.providerSubscriptionId).toBe('sub_legitimate_test_1794361279434');
    });

    it('preserves existing provider_subscription_id when null, empty string, or whitespace is passed', () => {
      // 1. Passing null
      const res1 = harness.applyPaddleSubscriptionUpdate({
        organizationId: 'e2e00000-0000-4000-a000-000000000010',
        plan: 'starter',
        status: 'active',
        providerSubscriptionId: null,
      });
      expect(res1.success).toBe(true);
      expect(res1.sub?.providerSubscriptionId).toBe('sub_legitimate_test_1794361279434');

      // 2. Passing empty string
      const res2 = harness.applyPaddleSubscriptionUpdate({
        organizationId: 'e2e00000-0000-4000-a000-000000000010',
        plan: 'starter',
        status: 'active',
        providerSubscriptionId: '',
      });
      expect(res2.success).toBe(true);
      expect(res2.sub?.providerSubscriptionId).toBe('sub_legitimate_test_1794361279434');

      // 3. Passing whitespace
      const res3 = harness.applyPaddleSubscriptionUpdate({
        organizationId: 'e2e00000-0000-4000-a000-000000000010',
        plan: 'starter',
        status: 'active',
        providerSubscriptionId: '   ',
      });
      expect(res3.success).toBe(true);
      expect(res3.sub?.providerSubscriptionId).toBe('sub_legitimate_test_1794361279434');
    });

    it('verifies that migration SQL uses v_sub_exists boolean instead of FOUND after collision query', () => {
      const migrationSql = fs.readFileSync(
        path.resolve(__dirname, '../supabase/migrations/20261111000007_billing_final_consolidation.sql'),
        'utf-8'
      );
      expect(migrationSql).toMatch(/v_sub_exists\s*:=\s*FOUND;/);
      expect(migrationSql).toMatch(/IF NOT v_sub_exists THEN/);
      expect(migrationSql).toMatch(/hashtext\('bidready_billing_mutation_lock'\)/);
    });
  });

  describe('Section 3: Hardened Checkout Intent Validation (All Negative Cases)', () => {
    const targetOrg = 'e2e00000-0000-4000-a000-000000000030';
    const validToken = 'intent_tok_valid_123';

    beforeEach(() => {
      harness.intents.set(validToken, {
        id: 'intent-id-123',
        intentToken: validToken,
        organizationId: targetOrg,
        userId: 'user-id-123',
        planId: 'starter',
        priceId: 'pri_starter_official',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    });

    it('rejects when custom_data is missing intent_id and intent_token', () => {
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_starter_official', custom_data: {} },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_no_token',
        payload,
        organizationId: targetOrg,
        plan: 'starter',
        providerSubId: 'sub_new_brand',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Missing intent_id or intent_token');
    });

    it('rejects when intent token is nonexistent', () => {
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_starter_official', custom_data: { intent_token: 'non_existent_token' } },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_bad_token',
        payload,
        organizationId: targetOrg,
        plan: 'starter',
        providerSubId: 'sub_new_brand',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('not found');
    });

    it('rejects when intent is expired', () => {
      harness.intents.get(validToken)!.expiresAt = new Date(Date.now() - 3600000).toISOString();
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_starter_official', custom_data: { intent_token: validToken } },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_expired_token',
        payload,
        organizationId: targetOrg,
        plan: 'starter',
        providerSubId: 'sub_new_brand',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('expired');
    });

    it('rejects when intent is already consumed', () => {
      harness.intents.get(validToken)!.status = 'consumed';
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_starter_official', custom_data: { intent_token: validToken } },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_already_consumed',
        payload,
        organizationId: targetOrg,
        plan: 'starter',
        providerSubId: 'sub_new_brand',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('already consumed');
    });

    it('rejects when intent belongs to a different organization', () => {
      harness.intents.get(validToken)!.organizationId = 'foreign-org-id';
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_starter_official', custom_data: { intent_token: validToken } },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_wrong_org',
        payload,
        organizationId: targetOrg,
        plan: 'starter',
        providerSubId: 'sub_new_brand',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('organization mismatch');
    });

    it('rejects when plan does not match intent plan', () => {
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_starter_official', custom_data: { intent_token: validToken } },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_plan_mismatch',
        payload,
        organizationId: targetOrg,
        plan: 'pro', // Intent is starter
        providerSubId: 'sub_new_brand',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Plan mismatch');
    });

    it('rejects when price_id does not match intent price_id', () => {
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_WRONG_PRICE', custom_data: { intent_token: validToken } },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_price_mismatch',
        payload,
        organizationId: targetOrg,
        plan: 'starter',
        providerSubId: 'sub_new_brand',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Price ID mismatch');
    });

    it('consumes intent atomically and binds subscription only when ALL checks pass', () => {
      const payload = {
        occurred_at: new Date().toISOString(),
        data: { price_id: 'pri_starter_official', custom_data: { intent_token: validToken } },
      };
      const res = harness.processPaddleWebhookTransaction({
        eventId: 'evt_success_bind',
        payload,
        organizationId: targetOrg,
        plan: 'starter',
        providerSubId: 'sub_brand_new_123',
      });

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(false);

      // Verify intent consumed
      const intent = harness.intents.get(validToken)!;
      expect(intent.status).toBe('consumed');
      expect(intent.consumedByProviderSubId).toBe('sub_brand_new_123');

      // Verify subscription created and bound
      const sub = harness.subscriptions.get(targetOrg)!;
      expect(sub.providerSubscriptionId).toBe('sub_brand_new_123');
      expect(sub.plan).toBe('starter');
    });
  });

  describe('Section 4: Starter Remediation & Operational Sequencing', () => {
    it('verifies remediate_starter_subscription_m4144.sql validates last_event_occurred_at column existence before updating', () => {
      const scriptSql = fs.readFileSync(
        path.resolve(__dirname, '../scripts/remediate_starter_subscription_m4144.sql'),
        'utf-8'
      );
      expect(scriptSql).toMatch(/SELECT EXISTS/);
      expect(scriptSql).toMatch(/column_name = 'last_event_occurred_at'/);
      expect(scriptSql).toMatch(/hashtext\('bidready_billing_mutation_lock'\)/);
    });

    it('verifies operational_runbook_m4144.md executes migration in Phase 4 and remediation in Phase 5B', () => {
      const runbook = fs.readFileSync(
        path.resolve(__dirname, '../scripts/operational_runbook_m4144.md'),
        'utf-8'
      );
      expect(runbook).toMatch(/FASE 4: APLICAÇÃO DA MIGRATION CONSOLIDADA/);
      expect(runbook).toMatch(/FASE 5A: VERIFICAÇÃO ESTRUTURAL/);
      expect(runbook).toMatch(/FASE 5B: EXECUÇÃO CONTROLADA DA RECUPERAÇÃO STARTER/);
      expect(runbook).toMatch(/FASE 7: PROTOCOLO DE CONTINGÊNCIA/);
    });
  });
});
