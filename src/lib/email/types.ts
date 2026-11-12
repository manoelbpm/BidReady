export type EmailEventType =
  | 'welcome'
  | 'analysis_completed'
  | 'quota_alert'
  | 'payment_receipt';

export type EmailDeliveryStatus =
  | 'sent'
  | 'mocked'
  | 'failed'
  | 'skipped_duplicate';

export interface BaseEmailData {
  organizationId?: string;
  userId?: string;
}

export interface WelcomeEmailData extends BaseEmailData {
  fullName: string;
  organizationName: string;
  appUrl?: string;
}

export interface AnalysisCompletedEmailData extends BaseEmailData {
  fullName?: string;
  opportunityId: string;
  opportunityTitle: string;
  totalRequirements: number;
  matchedRequirements: number;
  gapCount: number;
  appUrl?: string;
}

export interface QuotaAlertEmailData extends BaseEmailData {
  fullName?: string;
  organizationName: string;
  planName: string;
  analysesLimit: number;
  analysesUsed: number;
  remainingAnalyses: number;
  appUrl?: string;
}

export interface PaymentReceiptEmailData extends BaseEmailData {
  fullName?: string;
  organizationName: string;
  planName: string;
  amountUsd?: number;
  interval?: string;
  providerSubscriptionId?: string;
  paddleTransactionId?: string;
  appUrl?: string;
}

export type EmailEventPayload =
  | { eventType: 'welcome'; data: WelcomeEmailData }
  | { eventType: 'analysis_completed'; data: AnalysisCompletedEmailData }
  | { eventType: 'quota_alert'; data: QuotaAlertEmailData }
  | { eventType: 'payment_receipt'; data: PaymentReceiptEmailData };

export interface SendEmailOptions {
  to: string;
  eventType: EmailEventType;
  idempotencyKey: string;
  data: Record<string, any>;
  organizationId?: string;
  userId?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  status: EmailDeliveryStatus;
  idempotencyKey: string;
  messageId?: string;
  isMock: boolean;
  duplicate: boolean;
  error?: string;
}
