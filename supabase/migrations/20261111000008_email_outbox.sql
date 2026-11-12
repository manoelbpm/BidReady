-- ==============================================================================
-- Migration: 20261111000008_email_outbox.sql
-- Description: Transactional Email Outbox & Persistent Idempotency Audit Log
-- Scope: LOCAL SPECIFICATION ONLY (Do NOT execute on remote database without authorization)
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE email_delivery_status AS ENUM (
        'pending',
        'sent',
        'failed',
        'mocked',
        'skipped_duplicate'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.email_outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'resend',
    provider_message_id TEXT,
    delivery_status email_delivery_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & multi-tenant index
CREATE INDEX IF NOT EXISTS idx_email_outbox_org ON public.email_outbox_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_key ON public.email_outbox_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_email_outbox_type ON public.email_outbox_events(event_type);

-- RLS Enforcement
ALTER TABLE public.email_outbox_events ENABLE ROW LEVEL SECURITY;

-- Only members can view their organization's email log
CREATE POLICY "Members can view email outbox logs of their organization"
    ON public.email_outbox_events FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- System service role and postgres have administrative access
GRANT SELECT, INSERT, UPDATE ON public.email_outbox_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_outbox_events TO postgres;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.email_outbox_events FROM authenticated;
REVOKE ALL ON public.email_outbox_events FROM anon;
REVOKE ALL ON public.email_outbox_events FROM PUBLIC;

-- ==============================================================================
-- Function: claim_email_outbox_slot
-- Purpose: Atomically claims a delivery slot or detects duplicate/sent events.
-- Supports multi-instance concurrency, server restarts, and safe failure recovery.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_email_outbox_slot(
    p_idempotency_key VARCHAR(255),
    p_event_type VARCHAR(64),
    p_recipient_email TEXT,
    p_subject TEXT,
    p_organization_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing RECORD;
    v_new_id UUID;
BEGIN
    -- 1. Check existing record
    SELECT id, delivery_status, retry_count, provider_message_id
    INTO v_existing
    FROM public.email_outbox_events
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        -- If already sent or mocked successfully, reject re-delivery (idempotent no-op)
        IF v_existing.delivery_status IN ('sent', 'mocked') THEN
            RETURN jsonb_build_object(
                'claimed', false,
                'already_sent', true,
                'status', v_existing.delivery_status,
                'message_id', v_existing.provider_message_id,
                'retry_count', v_existing.retry_count
            );
        END IF;

        -- If previously failed, allow retry by updating status to 'pending' and incrementing count
        IF v_existing.delivery_status = 'failed' THEN
            UPDATE public.email_outbox_events
            SET delivery_status = 'pending',
                retry_count = retry_count + 1,
                updated_at = NOW()
            WHERE id = v_existing.id;

            RETURN jsonb_build_object(
                'claimed', true,
                'already_sent', false,
                'status', 'pending',
                'is_retry', true,
                'retry_count', v_existing.retry_count + 1,
                'id', v_existing.id
            );
        END IF;

        -- If already pending, concurrent instance is processing it
        RETURN jsonb_build_object(
            'claimed', false,
            'already_sent', false,
            'status', v_existing.delivery_status,
            'in_progress', true,
            'retry_count', v_existing.retry_count
        );
    END IF;

    -- 2. First-time insertion
    INSERT INTO public.email_outbox_events (
        organization_id,
        user_id,
        idempotency_key,
        event_type,
        recipient_email,
        subject,
        delivery_status,
        retry_count,
        metadata
    ) VALUES (
        p_organization_id,
        p_user_id,
        p_idempotency_key,
        p_event_type,
        p_recipient_email,
        p_subject,
        'pending',
        0,
        p_metadata
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'claimed', true,
        'already_sent', false,
        'status', 'pending',
        'is_retry', false,
        'retry_count', 0,
        'id', v_new_id
    );
EXCEPTION
    WHEN unique_violation THEN
        -- Handled gracefully in concurrent race condition
        RETURN jsonb_build_object(
            'claimed', false,
            'already_sent', false,
            'status', 'pending',
            'in_progress', true
        );
END;
$$;

-- ==============================================================================
-- Function: complete_email_outbox_slot
-- Purpose: Records final outcome (sent, mocked, failed) of email delivery.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.complete_email_outbox_slot(
    p_idempotency_key VARCHAR(255),
    p_status public.email_delivery_status,
    p_provider_message_id TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.email_outbox_events
    SET delivery_status = p_status,
        provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
        error_message = p_error_message,
        updated_at = NOW()
    WHERE idempotency_key = p_idempotency_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_email_outbox_slot TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.complete_email_outbox_slot TO service_role, postgres;
REVOKE ALL ON FUNCTION public.claim_email_outbox_slot FROM authenticated, anon, PUBLIC;
REVOKE ALL ON FUNCTION public.complete_email_outbox_slot FROM authenticated, anon, PUBLIC;
