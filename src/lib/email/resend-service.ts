import { Resend } from 'resend';
import {
  EmailEventType,
  SendEmailOptions,
  EmailDeliveryResult,
} from './types';
import { renderEmail } from './templates';
import { supabaseAdmin, isServiceRoleConfigured } from '@/lib/supabase/admin';

export interface OutboxRecord {
  id: string;
  idempotencyKey: string;
  eventType: EmailEventType;
  to: string;
  maskedTo: string;
  subject: string;
  organizationId?: string;
  userId?: string;
  status: 'pending' | 'sent' | 'mocked' | 'failed' | 'skipped_duplicate';
  messageId?: string;
  errorMessage?: string;
  isMock: boolean;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

// In-memory tenant-isolated outbox registry for deterministic idempotency & testing
const inMemoryOutbox = new Map<string, OutboxRecord>();

/**
 * Masks an email address to protect PII in operational logs.
 * Example: 'sarah.jenkins@defense-systems.com' -> 's***s@defense-systems.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export class TransactionalEmailService {
  private resendClient: Resend | null = null;
  private defaultFrom: string;
  private isMockMode: boolean = false;
  private productionConfigError: string | null = null;

  constructor(options?: {
    apiKey?: string;
    from?: string;
    forceMock?: boolean;
  }) {
    const apiKey = options?.apiKey ?? process.env.RESEND_API_KEY ?? '';
    this.defaultFrom =
      options?.from ||
      process.env.EMAIL_FROM ||
      'BidReady <notifications@bidready.com>';

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.APP_ENV === 'production';

    if (isProduction) {
      // 1. RESEND_MOCK_MODE=true is strictly forbidden in production
      if (process.env.RESEND_MOCK_MODE === 'true' || options?.forceMock === true) {
        throw new Error(
          'Operational Security Violation: RESEND_MOCK_MODE is strictly forbidden in production environment.'
        );
      }

      // 2. Chaves com prefixos mock_ ou test_ não podem provocar simulação silenciosa em produção
      if (
        !apiKey ||
        apiKey.startsWith('mock_') ||
        apiKey.startsWith('test_') ||
        apiKey.startsWith('re_test_') ||
        apiKey === 'placeholder'
      ) {
        this.isMockMode = false;
        this.productionConfigError =
          'Operational Configuration Error: Valid production RESEND_API_KEY is required in production environment. Mock keys are strictly forbidden in production.';
      } else {
        this.isMockMode = false;
        try {
          this.resendClient = new Resend(apiKey);
        } catch (err) {
          this.productionConfigError = `Failed to initialize Resend client: ${err instanceof Error ? err.message : 'Unknown'}`;
        }
      }
    } else {
      // Development and Testing mode
      this.isMockMode =
        options?.forceMock ??
        (process.env.NODE_ENV === 'test' ||
          process.env.RESEND_MOCK_MODE === 'true' ||
          !apiKey ||
          apiKey.startsWith('mock_') ||
          apiKey.startsWith('test_') ||
          apiKey.startsWith('re_test_') ||
          apiKey === 'placeholder');

      if (!this.isMockMode && apiKey) {
        try {
          this.resendClient = new Resend(apiKey);
        } catch {
          this.isMockMode = true;
        }
      }
    }
  }

  /**
   * Sends a transactional email safely with persistent idempotency.
   * Supports multi-instance concurrency, server restart recovery, and safe failure retry.
   * NEVER throws an uncaught error: non-blocking to prevent payment/analysis pipeline halts.
   */
  async sendTransactionalEmail(
    options: SendEmailOptions
  ): Promise<EmailDeliveryResult> {
    const { to, eventType, idempotencyKey, data, organizationId, userId } = options;
    const masked = maskEmail(to);

    // 1. Production Misconfiguration Guard (Prevents false mock success in production)
    if (this.productionConfigError) {
      console.error(`[EmailService] Production Email Error: ${this.productionConfigError}`);
      const errRecordId = `outbox_err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      inMemoryOutbox.set(idempotencyKey, {
        id: errRecordId,
        idempotencyKey,
        eventType,
        to,
        maskedTo: masked,
        subject: '',
        organizationId,
        userId,
        status: 'failed',
        errorMessage: this.productionConfigError,
        isMock: false,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        success: false,
        status: 'failed',
        idempotencyKey,
        isMock: false,
        duplicate: false,
        error: this.productionConfigError,
      };
    }

    // 2. Render Template
    let rendered;
    try {
      rendered = renderEmail(eventType, data);
    } catch (renderErr) {
      const errorMsg = renderErr instanceof Error ? renderErr.message : 'Template render failed';
      console.error(`[EmailService] Render error for event "${eventType}":`, errorMsg);

      inMemoryOutbox.set(idempotencyKey, {
        id: `outbox_err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        idempotencyKey,
        eventType,
        to,
        maskedTo: masked,
        subject: '',
        organizationId,
        userId,
        status: 'failed',
        errorMessage: errorMsg,
        isMock: this.isMockMode,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        success: false,
        status: 'failed',
        idempotencyKey,
        isMock: this.isMockMode,
        duplicate: false,
        error: errorMsg,
      };
    }

    // 3. Persistent Database Idempotency Check & Atomic Slot Claim (if Supabase RPC available)
    if (isServiceRoleConfigured()) {
      try {
        const { data: slot, error: slotErr } = await supabaseAdmin.rpc('claim_email_outbox_slot', {
          p_idempotency_key: idempotencyKey,
          p_event_type: eventType,
          p_recipient_email: to,
          p_subject: rendered.subject,
          p_organization_id: organizationId || null,
          p_user_id: userId || null,
          p_metadata: data || {},
        });

        if (!slotErr && slot) {
          if (slot.already_sent) {
            return {
              success: true,
              status: 'skipped_duplicate',
              idempotencyKey,
              messageId: slot.message_id,
              isMock: slot.status === 'mocked',
              duplicate: true,
            };
          }
          if (!slot.claimed && slot.in_progress) {
            // Concurrent instance is processing right now
            return {
              success: true,
              status: 'skipped_duplicate',
              idempotencyKey,
              isMock: false,
              duplicate: true,
            };
          }
        }
      } catch {
        // Fallback gracefully to in-memory idempotency if DB RPC is not deployed
      }
    }

    // 4. In-Memory Idempotency & In-Flight Concurrency Guard
    const existing = inMemoryOutbox.get(idempotencyKey);
    if (existing && (existing.status === 'sent' || existing.status === 'mocked')) {
      return {
        success: true,
        status: 'skipped_duplicate',
        idempotencyKey,
        messageId: existing.messageId,
        isMock: existing.isMock,
        duplicate: true,
      };
    }
    if (existing && existing.status === 'pending') {
      // In-flight concurrent execution lock
      return {
        success: true,
        status: 'skipped_duplicate',
        idempotencyKey,
        isMock: existing.isMock,
        duplicate: true,
      };
    }

    const recordId = existing?.id || `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const currentRetryCount = existing ? existing.retryCount + 1 : 0;

    // Set status to pending while dispatching
    inMemoryOutbox.set(idempotencyKey, {
      id: recordId,
      idempotencyKey,
      eventType,
      to,
      maskedTo: masked,
      subject: rendered.subject,
      organizationId,
      userId,
      status: 'pending',
      retryCount: currentRetryCount,
      isMock: this.isMockMode,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 5. Mock Execution (Local Dev, CI & Vitest)
    if (this.isMockMode || !this.resendClient) {
      const mockMessageId = `resend_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const outboxEntry: OutboxRecord = {
        id: recordId,
        idempotencyKey,
        eventType,
        to,
        maskedTo: masked,
        subject: rendered.subject,
        organizationId,
        userId,
        status: 'mocked',
        messageId: mockMessageId,
        isMock: true,
        retryCount: currentRetryCount,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      inMemoryOutbox.set(idempotencyKey, outboxEntry);

      // Complete in DB if available
      if (isServiceRoleConfigured()) {
        try {
          supabaseAdmin.rpc('complete_email_outbox_slot', {
            p_idempotency_key: idempotencyKey,
            p_status: 'mocked',
            p_provider_message_id: mockMessageId,
          }).then(() => {}, () => {});
        } catch {}
      }

      return {
        success: true,
        status: 'mocked',
        idempotencyKey,
        messageId: mockMessageId,
        isMock: true,
        duplicate: false,
      };
    }

    // 6. Live Resend Execution with safe transient retry
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data: resData, error: resError } = await this.resendClient.emails.send({
          from: this.defaultFrom,
          to,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          headers: {
            'X-Entity-Ref-ID': idempotencyKey,
          },
        });

        if (resError) {
          lastError = resError.message;
          console.warn(`[EmailService] Resend attempt ${attempt} failed for ${masked}:`, resError.message);
          if (attempt < 2) await new Promise((r) => setTimeout(r, 200 * attempt));
          continue;
        }

        const messageId = resData?.id || `resend_${Date.now()}`;
        const outboxEntry: OutboxRecord = {
          id: recordId,
          idempotencyKey,
          eventType,
          to,
          maskedTo: masked,
          subject: rendered.subject,
          organizationId,
          userId,
          status: 'sent',
          messageId,
          isMock: false,
          retryCount: currentRetryCount,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        inMemoryOutbox.set(idempotencyKey, outboxEntry);

        if (isServiceRoleConfigured()) {
          try {
            supabaseAdmin.rpc('complete_email_outbox_slot', {
              p_idempotency_key: idempotencyKey,
              p_status: 'sent',
              p_provider_message_id: messageId,
            }).then(() => {}, () => {});
          } catch {}
        }

        return {
          success: true,
          status: 'sent',
          idempotencyKey,
          messageId,
          isMock: false,
          duplicate: false,
        };
      } catch (networkErr: unknown) {
        lastError = networkErr instanceof Error ? networkErr.message : 'Unknown network error';
        console.warn(`[EmailService] Resend network error attempt ${attempt} for ${masked}:`, lastError);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }

    // Record failure in outbox (safe non-blocking return, allowing future recovery retry)
    inMemoryOutbox.set(idempotencyKey, {
      id: recordId,
      idempotencyKey,
      eventType,
      to,
      maskedTo: masked,
      subject: rendered.subject,
      organizationId,
      userId,
      status: 'failed',
      errorMessage: lastError,
      isMock: false,
      retryCount: currentRetryCount,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (isServiceRoleConfigured()) {
      try {
        supabaseAdmin.rpc('complete_email_outbox_slot', {
          p_idempotency_key: idempotencyKey,
          p_status: 'failed',
          p_error_message: lastError,
        }).then(() => {}, () => {});
      } catch {}
    }

    return {
      success: false,
      status: 'failed',
      idempotencyKey,
      isMock: false,
      duplicate: false,
      error: lastError || 'Delivery failed after retries',
    };
  }

  /**
   * Returns copy of all recorded outbox events (for tests and administrative inspection).
   */
  getOutboxEvents(): OutboxRecord[] {
    return Array.from(inMemoryOutbox.values());
  }

  /**
   * Resets the in-memory outbox registry (primarily for test isolation).
   */
  clearOutboxRegistry(): void {
    inMemoryOutbox.clear();
  }
}

// Global singleton instance for application use
export const emailService = new TransactionalEmailService();
