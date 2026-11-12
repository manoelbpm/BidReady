import { SupabaseClient } from '@supabase/supabase-js';
import { PlanId, SubscriptionRecord, SubscriptionStatus } from '@/types/billing';

export interface UsageAuditDbEntry {
  id: string;
  organization_id: string;
  document_id?: string | null;
  user_id?: string | null;
  analyses_counted: number;
  successful_run: boolean;
  notes?: string | null;
  recorded_at: string;
}

export class SubscriptionRepository {
  constructor(private client: SupabaseClient) {}

  async getSubscription(organizationId: string): Promise<SubscriptionRecord | null> {
    // Try via SECURITY DEFINER RPC first to bypass RLS in backend context
    const { data: rpcData, error: rpcError } = await this.client.rpc('get_organization_subscription', {
      p_organization_id: organizationId,
    });

    if (!rpcError && rpcData) {
      const data = rpcData;
      return {
        id: data.id,
        organizationId: data.organization_id,
        planId: data.plan as PlanId,
        status: data.status as SubscriptionStatus,
        monthlyAnalysesLimit: data.monthly_analyses_limit,
        analysesUsedInPeriod: data.analyses_used_in_period,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        gracePeriodEndsAt: data.grace_period_ends_at,
        billingProvider: (data.billing_provider || 'paddle') as 'paddle' | 'manual',
        providerCustomerId: data.provider_customer_id,
        providerSubscriptionId: data.provider_subscription_id,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }

    const { data, error } = await this.client
      .from('saas_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database Error [getSubscription]: ${error.message} (code ${error.code})`);
    }

    if (!data) return null;

    return {
      id: data.id,
      organizationId: data.organization_id,
      planId: data.plan as PlanId,
      status: data.status as SubscriptionStatus,
      monthlyAnalysesLimit: data.monthly_analyses_limit,
      analysesUsedInPeriod: data.analyses_used_in_period,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      gracePeriodEndsAt: data.grace_period_ends_at,
      billingProvider: (data.billing_provider || 'paddle') as 'paddle' | 'manual',
      providerCustomerId: data.provider_customer_id,
      providerSubscriptionId: data.provider_subscription_id,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async applySubscriptionUpdate(params: {
    organizationId: string;
    planId?: PlanId;
    status?: SubscriptionStatus;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    cancelAtPeriodEnd?: boolean;
    monthlyAnalysesLimit?: number;
    gracePeriodEndsAt?: string | null;
  }): Promise<SubscriptionRecord> {
    const { data, error } = await this.client.rpc('apply_paddle_subscription_update', {
      p_organization_id: params.organizationId,
      p_plan: params.planId || null,
      p_status: params.status || null,
      p_provider_subscription_id: params.providerSubscriptionId || null,
      p_provider_customer_id: params.providerCustomerId || null,
      p_cancel_at_period_end: params.cancelAtPeriodEnd ?? null,
      p_monthly_analyses_limit: params.monthlyAnalysesLimit || null,
      p_grace_period_ends_at: params.gracePeriodEndsAt || null,
    });

    if (error) {
      throw new Error(`Database Error [applySubscriptionUpdate]: ${error.message} (code ${error.code})`);
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      planId: data.plan as PlanId,
      status: data.status as SubscriptionStatus,
      monthlyAnalysesLimit: data.monthly_analyses_limit,
      analysesUsedInPeriod: data.analyses_used_in_period,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      gracePeriodEndsAt: data.grace_period_ends_at,
      billingProvider: (data.billing_provider || 'paddle') as 'paddle' | 'manual',
      providerCustomerId: data.provider_customer_id,
      providerSubscriptionId: data.provider_subscription_id,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async recordUsageAudit(entry: {
    organizationId: string;
    documentId?: string | null;
    userId?: string | null;
    analysesCounted: number;
    successfulRun: boolean;
    notes?: string | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('usage_audit_logs')
      .insert({
        organization_id: entry.organizationId,
        document_id: entry.documentId || null,
        user_id: entry.userId || null,
        analyses_counted: entry.analysesCounted,
        successful_run: entry.successfulRun,
        notes: entry.notes || null,
      });

    if (error) {
      throw new Error(`Database Error [recordUsageAudit]: ${error.message} (code ${error.code})`);
    }
  }

  async listUsageAudit(organizationId: string): Promise<UsageAuditDbEntry[]> {
    const { data, error } = await this.client
      .from('usage_audit_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('recorded_at', { ascending: false });

    if (error) {
      throw new Error(`Database Error [listUsageAudit]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as UsageAuditDbEntry[];
  }

  /**
   * Concurrency-safe atomic quota reservation with PostgreSQL row-level locks (FOR UPDATE).
   * Enforces that only one concurrent request can consume the last available quota.
   */
  async reserveAnalysisQuota(organizationId: string): Promise<{
    allowed: boolean;
    limit?: number;
    used?: number;
    remaining?: number;
    reason?: string;
  }> {
    const { data, error } = await this.client.rpc('reserve_analysis_quota', {
      p_organization_id: organizationId,
    });

    if (error) {
      throw new Error(`Database Error [reserveAnalysisQuota]: ${error.message} (code ${error.code})`);
    }

    return data as {
      allowed: boolean;
      limit?: number;
      used?: number;
      remaining?: number;
      reason?: string;
    };
  }

  /**
   * Releases reserved quota when document processing fails.
   * Guarantees that failed attempts are NEVER charged against customer quotas.
   */
  async releaseAnalysisQuota(organizationId: string): Promise<void> {
    const { error } = await this.client.rpc('release_analysis_quota', {
      p_organization_id: organizationId,
    });

    if (error) {
      throw new Error(`Database Error [releaseAnalysisQuota]: ${error.message} (code ${error.code})`);
    }
  }
}
