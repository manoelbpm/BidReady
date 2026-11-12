-- BIDREADY - EVIDENCE INTELLIGENCE & OPPORTUNITY MANAGEMENT SCHEMA
-- Migration: 20261110000003_evidence_and_matching.sql

-- 1. Extend evidences table
DO $$ BEGIN
    CREATE TYPE evidence_verification_status AS ENUM (
        'verified',
        'pending_verification',
        'expired',
        'rejected',
        'requires_human_review'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.evidences
    ADD COLUMN IF NOT EXISTS issuing_organization TEXT,
    ADD COLUMN IF NOT EXISTS issue_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_status evidence_verification_status NOT NULL DEFAULT 'pending_verification',
    ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS file_name TEXT;

-- 2. Extend opportunities table
ALTER TABLE public.opportunities
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS assigned_team_member TEXT,
    ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 3. Requirement-to-Evidence Matches Table
DO $$ BEGIN
    CREATE TYPE match_outcome AS ENUM (
        'MATCHED',
        'PARTIALLY_MATCHED',
        'MISSING_EVIDENCE',
        'EXPIRED_EVIDENCE',
        'REQUIRES_REVIEW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.requirement_evidence_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES public.evidences(id) ON DELETE SET NULL,
    match_outcome match_outcome NOT NULL DEFAULT 'REQUIRES_REVIEW',
    confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    match_explanation TEXT NOT NULL,
    missing_information TEXT,
    human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
    human_review_notes TEXT,
    verified_by_user_id UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Opportunity Activity History Table
CREATE TABLE IF NOT EXISTS public.opportunity_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Internal Notifications Table
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'DEADLINE_APPROACHING',
        'EVIDENCE_EXPIRING',
        'MISSING_MANDATORY_EVIDENCE',
        'REVIEW_PENDING',
        'TASK_ASSIGNED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.internal_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL DEFAULT 'info',
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_matches_org ON public.requirement_evidence_matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_matches_opp ON public.requirement_evidence_matches(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_matches_req ON public.requirement_evidence_matches(requirement_id);
CREATE INDEX IF NOT EXISTS idx_activities_opp ON public.opportunity_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_activities_org ON public.opportunity_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.internal_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.internal_notifications(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.requirement_evidence_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies
CREATE POLICY "Members can view requirement matches of their organization"
    ON public.requirement_evidence_matches FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can manage requirement matches of their organization"
    ON public.requirement_evidence_matches FOR ALL
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can view activities of their organization"
    ON public.opportunity_activities FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert activities in their organization"
    ON public.opportunity_activities FOR INSERT
    WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can view internal notifications of their organization"
    ON public.internal_notifications FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can update internal notifications of their organization"
    ON public.internal_notifications FOR UPDATE
    USING (public.is_org_member(organization_id));
