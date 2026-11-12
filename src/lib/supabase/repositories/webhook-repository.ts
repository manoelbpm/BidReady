import { SupabaseClient } from '@supabase/supabase-js';

export interface WebhookEventRecord {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: any;
  processed_successfully: boolean;
  error_message?: string | null;
  processed_at: string;
}

export class WebhookRepository {
  constructor(private client: SupabaseClient) {}

  /**
   * Persists an incoming webhook event transactionally.
   * Leverages PostgreSQL unique constraint on `event_id` to enforce strict idempotency across server instances.
   */
  async recordWebhookEvent(params: {
    provider: string;
    eventId: string;
    eventType: string;
    payload: any;
  }): Promise<{ duplicate: boolean; id?: string; message?: string }> {
    const { provider, eventId, eventType, payload } = params;

    const { data, error } = await this.client.rpc('record_paddle_webhook_event', {
      p_provider: provider,
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload,
    });

    if (error) {
      throw new Error(`Database Error [recordWebhookEvent]: ${error.message} (code ${error.code})`);
    }

    return data as { duplicate: boolean; id?: string; message?: string };
  }

  /**
   * Updates the processing status and error log of the recorded webhook.
   */
  async markWebhookProcessed(params: {
    eventId: string;
    success: boolean;
    errorMessage?: string | null;
  }): Promise<void> {
    const { eventId, success, errorMessage } = params;

    const { error } = await this.client.rpc('mark_paddle_webhook_processed', {
      p_event_id: eventId,
      p_success: success,
      p_error_message: errorMessage || null,
    });

    if (error) {
      throw new Error(`Database Error [markWebhookProcessed]: ${error.message} (code ${error.code})`);
    }
  }

  /**
   * Checks whether an event was already persisted in PostgreSQL.
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('check_webhook_event_processed', {
      p_event_id: eventId,
    });

    if (error) {
      throw new Error(`Database Error [isEventProcessed]: ${error.message} (code ${error.code})`);
    }

    return !!data;
  }

  /**
   * Single-operation transactional webhook processing in PostgreSQL:
   * 1. Checks event_id idempotency.
   * 2. Inserts billing_webhook_event.
   * 3. Updates saas_subscriptions atomically (if commercial event).
   * 4. Marks event as processed.
   * Atomic rollback if any failure occurs.
   */
  async processWebhookTransaction(params: {
    provider: string;
    eventId: string;
    eventType: string;
    payload: any;
    organizationId?: string | null;
    plan?: string | null;
    status?: string | null;
    providerSubId?: string | null;
    providerCustId?: string | null;
    cancelAtPeriodEnd?: boolean | null;
    analysesLimit?: number | null;
    gracePeriodEndsAt?: string | null;
  }): Promise<{
    success: boolean;
    duplicate: boolean;
    eventId: string;
    organizationId?: string | null;
    error?: string;
    message?: string;
  }> {
    const { data, error } = await this.client.rpc('process_paddle_webhook_transaction', {
      p_provider: params.provider,
      p_event_id: params.eventId,
      p_event_type: params.eventType,
      p_payload: params.payload,
      p_organization_id: params.organizationId || null,
      p_plan: params.plan || null,
      p_status: params.status || null,
      p_provider_sub_id: params.providerSubId || null,
      p_provider_cust_id: params.providerCustId || null,
      p_cancel_at_period_end: params.cancelAtPeriodEnd ?? null,
      p_analyses_limit: params.analysesLimit || null,
      p_grace_period_ends_at: params.gracePeriodEndsAt || null,
    });

    if (error) {
      throw new Error(`Database Error [processWebhookTransaction]: ${error.message} (code ${error.code})`);
    }

    return {
      success: data.success,
      duplicate: data.duplicate,
      eventId: data.event_id || params.eventId,
      organizationId: data.organization_id || params.organizationId,
      error: data.error,
      message: data.message,
    };
  }
}
