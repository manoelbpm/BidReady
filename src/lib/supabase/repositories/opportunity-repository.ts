import { SupabaseClient } from '@supabase/supabase-js';
import {
  Opportunity,
  OpportunityActivity,
  Requirement,
  RequirementEvidenceMatch,
} from '@/types/models';

export class OpportunityRepository {
  constructor(private client: SupabaseClient) {}

  async listOpportunities(organizationId: string): Promise<Opportunity[]> {
    const { data, error } = await this.client
      .from('opportunities')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database Error [listOpportunities]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as Opportunity[];
  }

  async getOpportunity(id: string): Promise<Opportunity | null> {
    const { data, error } = await this.client
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database Error [getOpportunity]: ${error.message} (code ${error.code})`);
    }

    return data as Opportunity | null;
  }

  async createOpportunity(opp: {
    id?: string;
    organization_id: string;
    created_by_user_id: string;
    title: string;
    description?: string | null;
    reference_code?: string | null;
    issuing_body?: string | null;
    contact_email?: string | null;
    estimated_value?: number | null;
    currency?: string;
    submission_deadline?: string | null;
    clarification_deadline?: string | null;
    stage?: string;
    priority?: string;
    assigned_team_member?: string | null;
    internal_notes?: string | null;
  }): Promise<Opportunity> {
    const normalizedStage = (opp.stage || 'intake').toLowerCase();
    const { data, error } = await this.client
      .from('opportunities')
      .insert({
        ...opp,
        currency: opp.currency || 'USD',
        stage: normalizedStage,
        priority: opp.priority || 'medium',
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createOpportunity]: ${error.message} (code ${error.code})`);
    }

    return data as Opportunity;
  }

  async updateOpportunity(
    id: string,
    updates: Partial<Opportunity>
  ): Promise<Opportunity> {
    const payload = { ...updates };
    if (payload.stage) {
      payload.stage = (payload.stage as string).toLowerCase() as any;
    }
    const { data, error } = await this.client
      .from('opportunities')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [updateOpportunity]: ${error.message} (code ${error.code})`);
    }

    return data as Opportunity;
  }

  async deleteOpportunity(id: string): Promise<void> {
    const { error } = await this.client
      .from('opportunities')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database Error [deleteOpportunity]: ${error.message} (code ${error.code})`);
    }
  }

  async listRequirements(opportunityId: string): Promise<Requirement[]> {
    const { data, error } = await this.client
      .from('requirements')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database Error [listRequirements]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as Requirement[];
  }

  async createRequirement(req: {
    id?: string;
    organization_id: string;
    opportunity_id: string;
    analysis_run_id?: string | null;
    type: string;
    category: string;
    title: string;
    description: string;
    source_reference: any;
    confidence_score?: number;
    manual_review_required?: boolean;
    verified_by_user_id?: string | null;
    verified_at?: string | null;
  }): Promise<Requirement> {
    const normalizedType = (req.type || 'mandatory').toLowerCase();
    const { data, error } = await this.client
      .from('requirements')
      .insert({
        ...req,
        type: normalizedType,
        confidence_score: req.confidence_score ?? 1.0,
        manual_review_required: req.manual_review_required ?? false,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createRequirement]: ${error.message} (code ${error.code})`);
    }

    return data as Requirement;
  }

  async listMatches(opportunityId: string): Promise<RequirementEvidenceMatch[]> {
    const { data, error } = await this.client
      .from('requirement_evidence_matches')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database Error [listMatches]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as RequirementEvidenceMatch[];
  }

  async listMatchesWithDetails(opportunityId: string): Promise<RequirementEvidenceMatch[]> {
    const { data, error } = await this.client
      .from('requirement_evidence_matches')
      .select('*, requirement:requirements(*), evidence:evidences(*)')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database Error [listMatchesWithDetails]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as RequirementEvidenceMatch[];
  }

  async createMatch(match: {
    id?: string;
    organization_id: string;
    opportunity_id: string;
    requirement_id: string;
    evidence_id?: string | null;
    match_outcome: string;
    confidence_score: number;
    match_explanation: string;
    missing_information?: string | null;
    human_review_required?: boolean;
    human_review_notes?: string | null;
    verified_by_user_id?: string | null;
    verified_at?: string | null;
  }): Promise<RequirementEvidenceMatch> {
    const { data, error } = await this.client
      .from('requirement_evidence_matches')
      .insert({
        ...match,
        human_review_required: match.human_review_required ?? false,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createMatch]: ${error.message} (code ${error.code})`);
    }

    return data as RequirementEvidenceMatch;
  }

  async updateMatch(
    matchId: string,
    updates: Partial<RequirementEvidenceMatch>
  ): Promise<RequirementEvidenceMatch> {
    const { data, error } = await this.client
      .from('requirement_evidence_matches')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select('*, requirement:requirements(*), evidence:evidences(*)')
      .single();

    if (error) {
      throw new Error(`Database Error [updateMatch]: ${error.message} (code ${error.code})`);
    }

    return data as RequirementEvidenceMatch;
  }

  async deleteMatches(opportunityId: string): Promise<void> {
    const { error } = await this.client
      .from('requirement_evidence_matches')
      .delete()
      .eq('opportunity_id', opportunityId);

    if (error) {
      throw new Error(`Database Error [deleteMatches]: ${error.message} (code ${error.code})`);
    }
  }

  async listActivities(opportunityId: string): Promise<OpportunityActivity[]> {
    const { data, error } = await this.client
      .from('opportunity_activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database Error [listActivities]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as OpportunityActivity[];
  }

  async createActivity(activity: {
    id?: string;
    organization_id: string;
    opportunity_id: string;
    user_id: string;
    action: string;
    description: string;
  }): Promise<OpportunityActivity> {
    const { data, error } = await this.client
      .from('opportunity_activities')
      .insert(activity)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createActivity]: ${error.message} (code ${error.code})`);
    }

    return data as OpportunityActivity;
  }
}
