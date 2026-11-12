-- BIDREADY - CORE DATABASE SCHEMA
-- Migration: 20261110000001_core_schema.sql
-- Description: Core tables, constraints, foreign keys and indexes for multi-tenant SaaS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    billing_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Organization Memberships (RBAC & Multi-tenant linking)
CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

-- 4. Opportunities (Tenders, RFPs, RFQs)
CREATE TYPE opportunity_stage AS ENUM (
    'intake',
    'analyzing',
    'review',
    'bid_decision',
    'drafting',
    'submitted',
    'awarded',
    'lost'
);

CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    reference_code TEXT,
    issuing_body TEXT,
    estimated_value NUMERIC(15, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    submission_deadline TIMESTAMPTZ,
    clarification_deadline TIMESTAMPTZ,
    stage opportunity_stage NOT NULL DEFAULT 'intake',
    source_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Documents (Uploaded tender files: PDF, DOCX, XLSX)
CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'ready', 'failed');

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    checksum_sha256 TEXT,
    status document_status NOT NULL DEFAULT 'uploaded',
    uploaded_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Analysis Runs (Provider-independent AI extraction runs)
CREATE TYPE analysis_status AS ENUM ('pending', 'extracting', 'analyzing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    status analysis_status NOT NULL DEFAULT 'pending',
    model_provider TEXT NOT NULL,
    model_version TEXT NOT NULL,
    confidence_score NUMERIC(3, 2), -- 0.00 to 1.00
    executive_summary TEXT,
    human_review_notes TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 7. Requirements (Traceable mandatory & desirable criteria)
CREATE TYPE requirement_type AS ENUM ('mandatory', 'desirable');

CREATE TABLE IF NOT EXISTS public.requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE SET NULL,
    type requirement_type NOT NULL DEFAULT 'mandatory',
    category TEXT NOT NULL DEFAULT 'General',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_reference JSONB NOT NULL DEFAULT '{}'::jsonb, -- {page_number, section_title, snippet, raw_quote}
    confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    manual_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by_user_id UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Deadlines (Traceable schedule dates)
CREATE TYPE deadline_type AS ENUM (
    'submission',
    'questions_clarifications',
    'site_visit',
    'presentation',
    'award_notice',
    'other'
);

CREATE TABLE IF NOT EXISTS public.deadlines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    deadline_type deadline_type NOT NULL DEFAULT 'submission',
    due_date TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    source_reference JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Evidence Library (Company certifications, past performance, policies)
CREATE TABLE IF NOT EXISTS public.evidences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    file_storage_path TEXT,
    valid_until TIMESTAMPTZ,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Checklist Items (Actionable compliance checklist)
CREATE TYPE checklist_status AS ENUM ('pending', 'in_progress', 'completed', 'flagged');

CREATE TABLE IF NOT EXISTS public.checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES public.requirements(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    status checklist_status NOT NULL DEFAULT 'pending',
    assigned_to_user_id UUID REFERENCES public.profiles(id),
    source_reference JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Subscriptions & Billing
CREATE TYPE subscription_plan AS ENUM ('starter', 'growth', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan subscription_plan NOT NULL DEFAULT 'starter',
    status subscription_status NOT NULL DEFAULT 'trialing',
    monthly_doc_limit INT NOT NULL DEFAULT 5,
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Usage Records
CREATE TYPE usage_metric AS ENUM ('documents_processed', 'pages_analyzed', 'ai_tokens_consumed');

CREATE TABLE IF NOT EXISTS public.usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric usage_metric NOT NULL,
    quantity INT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes on organization_id & foreign keys
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON public.opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_opp ON public.documents(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_opp ON public.analysis_runs(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_requirements_opp ON public.requirements(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_requirements_org ON public.requirements(organization_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_opp ON public.deadlines(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_checklist_opp ON public.checklist_items(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_evidences_org ON public.evidences(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_org ON public.usage_records(organization_id);
