-- BIDREADY - BILLING, SUBSCRIPTIONS & MONETIZATION SCHEMA
-- Migration: 20261110000004_billing_and_subscriptions.sql

-- 1. Extend plan type to support Free, Starter, Pro, Business
DO $$ BEGIN
    CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'pro', 'business');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_lifecycle AS ENUM (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Alter or re-create subscriptions table for production billing
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan plan_tier NOT NULL DEFAULT 'free',
    status subscription_lifecycle NOT NULL DEFAULT 'active',
    monthly_analyses_limit INT NOT NULL DEFAULT 2, -- Free default: 2 analyses
    analyses_used_in_period INT NOT NULL DEFAULT 0,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    grace_period_ends_at TIMESTAMPTZ, -- Configurable grace period on payment failure (e.g. +7 days)
    billing_provider TEXT DEFAULT 'paddle', -- e.g. 'paddle' or 'stripe'
    provider_customer_id TEXT,
    provider_subscription_id TEXT,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Webhook idempotency and audit logs
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE, -- Idempotency key: prevents duplicate processing
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_successfully BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Granular Usage Records
CREATE TABLE IF NOT EXISTS public.usage_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    document_id UUID,
    user_id UUID REFERENCES public.profiles(id),
    analyses_counted INT NOT NULL DEFAULT 1,
    successful_run BOOLEAN NOT NULL DEFAULT TRUE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & isolation
CREATE INDEX IF NOT EXISTS idx_saas_sub_org ON public.saas_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_saas_sub_provider_id ON public.saas_subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_id ON public.billing_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_usage_audit_org ON public.usage_audit_logs(organization_id);

-- Enable RLS
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_audit_logs ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies
CREATE POLICY "Members can view their organization subscription"
    ON public.saas_subscriptions FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Owners and Admins can update subscription"
    ON public.saas_subscriptions FOR UPDATE
    USING (public.get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Members can view usage audit logs of their organization"
    ON public.usage_audit_logs FOR SELECT
    USING (public.is_org_member(organization_id));

-- Webhooks are strictly server-side / service-role only; no direct public user access
