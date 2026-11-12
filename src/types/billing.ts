export type PlanId = 'free' | 'starter' | 'pro' | 'business';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  monthlyPriceUsd: number;
  monthlyAnalysesLimit: number;
  features: string[];
  paddlePriceId?: string;
  stripePriceId?: string;
  recommended?: boolean;
}

export const SAAS_PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free Trial',
    description: 'For exploratory evaluation of tender document parsing and traceable extraction.',
    monthlyPriceUsd: 0,
    monthlyAnalysesLimit: 2,
    features: [
      '2 tender document analyses per month',
      'PDF, DOCX, XLSX ingestion',
      'Mandatory & desirable requirements breakdown',
      'Exact page and paragraph citations',
      'Evidence library (up to 5 artifacts)',
      'Community & documentation support',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Designed for boutique contractors actively monitoring and bidding on 2-3 tenders a month.',
    monthlyPriceUsd: 29,
    monthlyAnalysesLimit: 10,
    features: [
      '10 tender document analyses per month',
      'Automated requirement-to-evidence matching',
      'Expired document warning alerts',
      'Interactive compliance checklist',
      'Unlimited company evidence artifacts',
      'Audit log and activity history',
      'Standard email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro Enterprise',
    description: 'For growing defense and commercial contractors with multi-member bid proposal teams.',
    monthlyPriceUsd: 69,
    monthlyAnalysesLimit: 40,
    recommended: true,
    features: [
      '40 tender document analyses per month',
      'Advanced multi-tier matching engine',
      'Full readiness audit overview',
      'Team task assignment & verification workflow',
      'Internal notification center',
      'Priority email support',
    ],
  },
  business: {
    id: 'business',
    name: 'Business Global',
    description: 'High-volume international tender intelligence for prime contractors and consortia.',
    monthlyPriceUsd: 149,
    monthlyAnalysesLimit: 120,
    features: [
      '120 tender document analyses per month',
      'Multi-seat organization access',
      'High-throughput parallel document extraction',
      'Shared organizational evidence bank',
      'Exportable CSV compliance matrices',
      'Standard onboarding support',
    ],
  },
};

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  monthlyAnalysesLimit: number;
  analysesUsedInPeriod: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt?: string | null;
  billingProvider: 'paddle' | 'stripe' | 'manual';
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  analysesUsed: number;
  analysesLimit: number;
  remaining: number;
  planId: PlanId;
  status: SubscriptionStatus;
  isInGracePeriod?: boolean;
  rejectionReason?: string;
}
