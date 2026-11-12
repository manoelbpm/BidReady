-- BIDREADY - ROW LEVEL SECURITY (RLS) & MULTI-TENANT ISOLATION POLICIES
-- Migration: 20261110000002_rls_policies.sql

-- Enable RLS across all application tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- Helper security functions (SECURITY DEFINER to avoid recursive policy checks)
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_org_role(target_org_id UUID)
RETURNS membership_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = target_org_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

-- 1. Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- 2. Organizations Policies
CREATE POLICY "Members can view their organizations"
    ON public.organizations FOR SELECT
    USING (public.is_org_member(id));

CREATE POLICY "Owners and Admins can update organization details"
    ON public.organizations FOR UPDATE
    USING (public.get_org_role(id) IN ('owner', 'admin'));

-- 3. Organization Members Policies
CREATE POLICY "Members can view other members of their organization"
    ON public.organization_members FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Owners and Admins can manage organization members"
    ON public.organization_members FOR ALL
    USING (public.get_org_role(organization_id) IN ('owner', 'admin'));

-- 4. Opportunities Policies
CREATE POLICY "Members can view opportunities of their organization"
    ON public.opportunities FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert opportunities in their organization"
    ON public.opportunities FOR INSERT
    WITH CHECK (public.is_org_member(organization_id) AND auth.uid() = created_by_user_id);

CREATE POLICY "Members can update opportunities in their organization"
    ON public.opportunities FOR UPDATE
    USING (public.is_org_member(organization_id));

CREATE POLICY "Owners and Admins can delete opportunities"
    ON public.opportunities FOR DELETE
    USING (public.get_org_role(organization_id) IN ('owner', 'admin'));

-- 5. Documents Policies
CREATE POLICY "Members can view documents of their organization"
    ON public.documents FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can upload documents for their organization"
    ON public.documents FOR INSERT
    WITH CHECK (public.is_org_member(organization_id) AND auth.uid() = uploaded_by_user_id);

CREATE POLICY "Members can update documents of their organization"
    ON public.documents FOR UPDATE
    USING (public.is_org_member(organization_id));

CREATE POLICY "Owners and Admins can delete documents"
    ON public.documents FOR DELETE
    USING (public.get_org_role(organization_id) IN ('owner', 'admin'));

-- 6. Analysis Runs Policies
CREATE POLICY "Members can view analysis runs of their organization"
    ON public.analysis_runs FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create analysis runs for their organization"
    ON public.analysis_runs FOR INSERT
    WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update analysis runs for their organization"
    ON public.analysis_runs FOR UPDATE
    USING (public.is_org_member(organization_id));

-- 7. Requirements Policies
CREATE POLICY "Members can view requirements of their organization"
    ON public.requirements FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert requirements into their organization"
    ON public.requirements FOR INSERT
    WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update requirements of their organization"
    ON public.requirements FOR UPDATE
    USING (public.is_org_member(organization_id));

-- 8. Deadlines Policies
CREATE POLICY "Members can view deadlines of their organization"
    ON public.deadlines FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can manage deadlines of their organization"
    ON public.deadlines FOR ALL
    USING (public.is_org_member(organization_id));

-- 9. Evidence Library Policies
CREATE POLICY "Members can view evidence of their organization"
    ON public.evidences FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can manage evidence of their organization"
    ON public.evidences FOR ALL
    USING (public.is_org_member(organization_id));

-- 10. Checklist Items Policies
CREATE POLICY "Members can view checklist items of their organization"
    ON public.checklist_items FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Members can update and manage checklist items"
    ON public.checklist_items FOR ALL
    USING (public.is_org_member(organization_id));

-- 11. Subscriptions Policies
CREATE POLICY "Members can view subscription of their organization"
    ON public.subscriptions FOR SELECT
    USING (public.is_org_member(organization_id));

-- 12. Usage Records Policies
CREATE POLICY "Members can view usage records of their organization"
    ON public.usage_records FOR SELECT
    USING (public.is_org_member(organization_id));

-- Auth User Creation Trigger: automatically create a profile and default organization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id UUID;
    org_name TEXT;
    base_slug TEXT;
BEGIN
    -- 1. Insert Profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url'
    );

    -- 2. Create Default Personal Workspace / Organization
    org_name := COALESCE(new.raw_user_meta_data->>'company_name', split_part(new.email, '@', 1) || ' Workspace');
    base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(new.id::text, 1, 8);

    INSERT INTO public.organizations (name, slug, billing_email)
    VALUES (org_name, base_slug, new.email)
    RETURNING id INTO new_org_id;

    -- 3. Add User as Owner
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, new.id, 'owner');

    -- 4. Initialize Trial Subscription
    INSERT INTO public.subscriptions (organization_id, plan, status, monthly_doc_limit)
    VALUES (new_org_id, 'starter', 'trialing', 5);

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
