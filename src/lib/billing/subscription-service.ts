import {
  PlanId,
  SubscriptionRecord,
  QuotaCheckResult,
  SAAS_PLANS,
  SubscriptionStatus,
} from '@/types/billing';
import { SubscriptionRepository } from '@/lib/supabase/repositories/subscription-repository';

export interface UsageAuditEntry {
  id: string;
  organizationId: string;
  documentId?: string;
  userId?: string;
  analysesCounted: number;
  successfulRun: boolean;
  notes?: string;
  recordedAt: string;
}

// In-memory tenant-isolated subscription store with automatic period roll-over
const subscriptionRegistry = new Map<string, SubscriptionRecord>();
const usageAuditRegistry = new Map<string, UsageAuditEntry[]>();

// Seed default initial subscription for org-1
function seedInitialSubscription() {
  if (subscriptionRegistry.size > 0) return;

  const defaultSub: SubscriptionRecord = {
    id: 'sub-org-1-initial',
    organizationId: 'org-1',
    planId: 'pro', // Seeded with Pro (40 analyses limit) for initial demo workspace
    status: 'active',
    monthlyAnalysesLimit: SAAS_PLANS.pro.monthlyAnalysesLimit,
    analysesUsedInPeriod: 12, // 12 used out of 40
    currentPeriodStart: new Date(Date.now() - 86400000 * 15).toISOString(),
    currentPeriodEnd: new Date(Date.now() + 86400000 * 15).toISOString(),
    gracePeriodEndsAt: null,
    billingProvider: 'paddle',
    providerCustomerId: 'ctm_demo_org1',
    providerSubscriptionId: 'sub_demo_paddle_001',
    cancelAtPeriodEnd: false,
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  subscriptionRegistry.set('org-1', defaultSub);
}

seedInitialSubscription();

export class SubscriptionService {
  private repository?: SubscriptionRepository;

  constructor(repository?: SubscriptionRepository) {
    this.repository = repository;
  }

  /**
   * Retrieves or initializes the organization subscription record,
   * automatically rolling over billing cycle quotas if the current period has elapsed.
   */
  getSubscription(organizationId: string): SubscriptionRecord {
    seedInitialSubscription();
    let sub = subscriptionRegistry.get(organizationId);

    if (!sub) {
      // Default to Free plan for newly created organizations
      sub = {
        id: `sub-${organizationId}-${Date.now()}`,
        organizationId,
        planId: 'free',
        status: 'active',
        monthlyAnalysesLimit: SAAS_PLANS.free.monthlyAnalysesLimit,
        analysesUsedInPeriod: 0,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
        gracePeriodEndsAt: null,
        billingProvider: 'manual',
        providerCustomerId: null,
        providerSubscriptionId: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      subscriptionRegistry.set(organizationId, sub);
    }

    // Server-side automatic monthly cycle renewal check
    const now = Date.now();
    const periodEnd = new Date(sub.currentPeriodEnd).getTime();

    if (now > periodEnd) {
      if (sub.cancelAtPeriodEnd) {
        // Billing period has expired for a canceled subscription
        sub.status = 'canceled';
        sub.updatedAt = new Date().toISOString();
        subscriptionRegistry.set(organizationId, sub);
      } else if (sub.status === 'active') {
        // Roll over to next monthly billing cycle
        sub.currentPeriodStart = new Date(periodEnd).toISOString();
        sub.currentPeriodEnd = new Date(periodEnd + 86400000 * 30).toISOString();
        sub.analysesUsedInPeriod = 0;
        sub.updatedAt = new Date().toISOString();
        subscriptionRegistry.set(organizationId, sub);
      }
    }

    return sub;
  }

  /**
   * Finds an organization's subscription by its Paddle providerSubscriptionId.
   * Enables reverse-lookup when subsequent webhooks omit custom_data.
   */
  findSubscriptionByProviderId(providerSubscriptionId: string): SubscriptionRecord | null {
    if (!providerSubscriptionId) return null;
    for (const sub of subscriptionRegistry.values()) {
      if (sub.providerSubscriptionId === providerSubscriptionId) {
        return sub;
      }
    }
    return null;
  }

  /**
   * Alias for checkAnalysisQuota returning common quota metrics.
   */
  checkQuota(organizationId: string) {
    const res = this.checkAnalysisQuota(organizationId);
    return {
      allowed: res.allowed,
      limit: res.analysesLimit,
      used: res.analysesUsed,
      remaining: res.remaining,
      plan: res.planId,
      currentCycleStart: '',
      rejectionReason: res.rejectionReason,
    };
  }

  /**
   * Checks whether the organization is authorized to execute an AI document analysis.
   * Verifies plan status, quota limits, active grace periods, and scheduled cancellations.
   */
  checkAnalysisQuota(organizationId: string): QuotaCheckResult {
    const sub = this.getSubscription(organizationId);
    const plan = SAAS_PLANS[sub.planId] || SAAS_PLANS.free;
    const now = Date.now();
    const periodEnd = new Date(sub.currentPeriodEnd).getTime();

    // 1. Check if subscription is paused
    if (sub.status === 'paused') {
      return {
        allowed: false,
        analysesUsed: sub.analysesUsedInPeriod,
        analysesLimit: sub.monthlyAnalysesLimit,
        remaining: 0,
        planId: sub.planId,
        status: sub.status,
        rejectionReason: 'Subscription is currently paused. Please resume your subscription to continue analyzing documents.',
      };
    }

    // 2. Check scheduled vs effective cancellation
    if (sub.status === 'canceled') {
      // If cancellation was immediate or if billing period has elapsed, strictly deny access
      if (!sub.cancelAtPeriodEnd || now >= periodEnd) {
        return {
          allowed: false,
          analysesUsed: sub.analysesUsedInPeriod,
          analysesLimit: sub.monthlyAnalysesLimit,
          remaining: 0,
          planId: sub.planId,
          status: sub.status,
          rejectionReason: 'Subscription has been canceled and the active billing period has expired. Please upgrade or renew your plan.',
        };
      }
    }

    // 3. Check past_due with grace period
    if (sub.status === 'past_due') {
      const graceEnd = sub.gracePeriodEndsAt ? new Date(sub.gracePeriodEndsAt).getTime() : 0;
      const isWithinGrace = now < graceEnd;

      if (!isWithinGrace) {
        return {
          allowed: false,
          analysesUsed: sub.analysesUsedInPeriod,
          analysesLimit: sub.monthlyAnalysesLimit,
          remaining: 0,
          planId: sub.planId,
          status: sub.status,
          isInGracePeriod: false,
          rejectionReason: 'Payment is past due and the 7-day grace period has expired. Please update your billing method to resume document processing.',
        };
      }
    }

    // 3. Strict Quota Limit Verification
    const remaining = Math.max(0, sub.monthlyAnalysesLimit - sub.analysesUsedInPeriod);
    const allowed = remaining > 0;

    return {
      allowed,
      analysesUsed: sub.analysesUsedInPeriod,
      analysesLimit: sub.monthlyAnalysesLimit,
      remaining,
      planId: sub.planId,
      status: sub.status,
      isInGracePeriod: sub.status === 'past_due',
      rejectionReason: allowed
        ? undefined
        : `Monthly analysis quota reached (${sub.analysesUsedInPeriod}/${sub.monthlyAnalysesLimit} analyses used for ${plan.name} tier). Upgrade your plan to analyze additional documents.`,
    };
  }

  /**
   * Records completed analysis consumption.
   * CRITICAL RULE: Failed processing attempts must NEVER be counted against customer quotas!
   */
  recordAnalysisConsumption(params: {
    organizationId: string;
    documentId?: string;
    userId?: string;
    success: boolean;
    failureReason?: string;
  }): void {
    const { organizationId, documentId, userId, success, failureReason } = params;

    const sub = this.getSubscription(organizationId);

    // Only increment quota counter if processing was successful
    if (success) {
      sub.analysesUsedInPeriod += 1;
      sub.updatedAt = new Date().toISOString();
      subscriptionRegistry.set(organizationId, sub);
    }

    // Always log audit trail
    const auditEntry: UsageAuditEntry = {
      id: `usage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organizationId,
      documentId,
      userId,
      analysesCounted: success ? 1 : 0,
      successfulRun: success,
      notes: success ? 'Document analysis completed successfully.' : `Processing failed: ${failureReason || 'unknown'} (quota not charged)`,
      recordedAt: new Date().toISOString(),
    };

    const logs = usageAuditRegistry.get(organizationId) || [];
    logs.unshift(auditEntry);
    usageAuditRegistry.set(organizationId, logs);
  }

  /**
   * Retrieves usage audit logs for an organization.
   */
  getUsageAuditLogs(organizationId: string): UsageAuditEntry[] {
    return usageAuditRegistry.get(organizationId) || [];
  }

  /**
   * Executes an upgrade or downgrade to a target plan tier.
   */
  changePlan(
    organizationId: string,
    targetPlanId: PlanId,
    providerDetails?: {
      provider: 'paddle' | 'stripe';
      subscriptionId?: string;
      customerId?: string;
    }
  ): SubscriptionRecord {
    const sub = this.getSubscription(organizationId);
    const targetPlan = SAAS_PLANS[targetPlanId];

    if (!targetPlan) {
      throw new Error(`Invalid plan id: "${targetPlanId}".`);
    }

    sub.planId = targetPlanId;
    sub.monthlyAnalysesLimit = targetPlan.monthlyAnalysesLimit;
    sub.status = 'active';
    sub.cancelAtPeriodEnd = false;
    sub.gracePeriodEndsAt = null;

    if (providerDetails) {
      sub.billingProvider = providerDetails.provider;
      if (providerDetails.subscriptionId) sub.providerSubscriptionId = providerDetails.subscriptionId;
      if (providerDetails.customerId) sub.providerCustomerId = providerDetails.customerId;
    }

    sub.updatedAt = new Date().toISOString();
    subscriptionRegistry.set(organizationId, sub);

    return sub;
  }

  /**
   * Schedules plan cancellation at the end of the current billing period, or cancels immediately.
   */
  cancelSubscription(organizationId: string, cancelAtPeriodEnd: boolean = true): SubscriptionRecord {
    const sub = this.getSubscription(organizationId);
    sub.cancelAtPeriodEnd = cancelAtPeriodEnd;
    if (!cancelAtPeriodEnd) {
      sub.status = 'canceled';
    }
    sub.updatedAt = new Date().toISOString();
    subscriptionRegistry.set(organizationId, sub);
    return sub;
  }

  /**
   * Reactivates a canceled subscription that has not yet completed its period.
   */
  reactivateSubscription(organizationId: string): SubscriptionRecord {
    const sub = this.getSubscription(organizationId);
    sub.cancelAtPeriodEnd = false;
    sub.status = 'active';
    sub.updatedAt = new Date().toISOString();
    subscriptionRegistry.set(organizationId, sub);
    return sub;
  }

  /**
   * Applies webhook status update (e.g. from Paddle/Stripe sandbox).
   */
  applyProviderWebhookUpdate(params: {
    organizationId: string;
    status: SubscriptionStatus;
    planId?: PlanId;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    gracePeriodDays?: number;
    gracePeriodEndsAt?: string;
    cancelAtPeriodEnd?: boolean;
  }): SubscriptionRecord {
    const {
      organizationId,
      status,
      planId,
      providerSubscriptionId,
      providerCustomerId,
      gracePeriodDays = 7,
      gracePeriodEndsAt,
      cancelAtPeriodEnd,
    } = params;

    const sub = this.getSubscription(organizationId);
    sub.status = status;

    if (cancelAtPeriodEnd !== undefined) {
      sub.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }

    if (planId && SAAS_PLANS[planId]) {
      sub.planId = planId;
      sub.monthlyAnalysesLimit = SAAS_PLANS[planId].monthlyAnalysesLimit;
    }

    if (providerSubscriptionId) sub.providerSubscriptionId = providerSubscriptionId;
    if (providerCustomerId) sub.providerCustomerId = providerCustomerId;

    if (status === 'past_due') {
      sub.gracePeriodEndsAt =
        gracePeriodEndsAt || new Date(Date.now() + 86400000 * gracePeriodDays).toISOString();
    } else if (status === 'active') {
      sub.gracePeriodEndsAt = null;
    }

    sub.updatedAt = new Date().toISOString();
    subscriptionRegistry.set(organizationId, sub);
    return sub;
  }

  // --- Real Supabase PostgreSQL Async Methods ---

  async getSubscriptionAsync(organizationId: string): Promise<SubscriptionRecord> {
    if (this.repository) {
      const sub = await this.repository.getSubscription(organizationId);
      if (sub) return sub;
    }
    return this.getSubscription(organizationId);
  }

  async applyProviderWebhookUpdateAsync(params: {
    organizationId: string;
    status: SubscriptionStatus;
    planId?: PlanId;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    gracePeriodDays?: number;
    gracePeriodEndsAt?: string;
    cancelAtPeriodEnd?: boolean;
  }): Promise<SubscriptionRecord> {
    if (this.repository) {
      const limit = params.planId && SAAS_PLANS[params.planId]
        ? SAAS_PLANS[params.planId].monthlyAnalysesLimit
        : undefined;

      const graceEnds = params.status === 'past_due'
        ? (params.gracePeriodEndsAt || new Date(Date.now() + 86400000 * (params.gracePeriodDays || 7)).toISOString())
        : null;

      return this.repository.applySubscriptionUpdate({
        organizationId: params.organizationId,
        planId: params.planId,
        status: params.status,
        providerSubscriptionId: params.providerSubscriptionId,
        providerCustomerId: params.providerCustomerId,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        monthlyAnalysesLimit: limit,
        gracePeriodEndsAt: graceEnds,
      });
    }
    return this.applyProviderWebhookUpdate(params);
  }

  async recordUsageAuditAsync(entry: {
    organizationId: string;
    documentId?: string;
    userId?: string;
    analysesCounted: number;
    successfulRun: boolean;
    notes?: string;
  }): Promise<void> {
    if (this.repository) {
      await this.repository.recordUsageAudit(entry);
      return;
    }
    const auditEntry: UsageAuditEntry = {
      id: `usage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organizationId: entry.organizationId,
      documentId: entry.documentId,
      userId: entry.userId,
      analysesCounted: entry.analysesCounted,
      successfulRun: entry.successfulRun,
      notes: entry.notes,
      recordedAt: new Date().toISOString(),
    };
    const logs = usageAuditRegistry.get(entry.organizationId) || [];
    logs.unshift(auditEntry);
    usageAuditRegistry.set(entry.organizationId, logs);
  }
}
