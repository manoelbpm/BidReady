import {
  Opportunity,
  OpportunityStage,
  OpportunityPriority,
  Requirement,
  ReadinessOverview,
  ReadinessStage,
  OpportunityActivity,
  RequirementEvidenceMatch,
  MatchOutcome,
  Evidence,
} from '@/types/models';
import { RequirementMatchingEngine } from '@/lib/matching/engine';
import { OpportunityRepository } from '@/lib/supabase/repositories/opportunity-repository';
import { EvidenceRepository } from '@/lib/supabase/repositories/evidence-repository';

export interface CreateOpportunityParams {
  organizationId: string;
  userId: string;
  title: string;
  description?: string;
  referenceCode?: string;
  issuingBody?: string;
  contactEmail?: string;
  estimatedValue?: number;
  currency?: string;
  submissionDeadline?: string;
  clarificationDeadline?: string;
  priority?: OpportunityPriority;
  assignedTeamMember?: string;
  internalNotes?: string;
}

export interface UpdateOpportunityParams {
  title?: string;
  description?: string;
  referenceCode?: string;
  issuingBody?: string;
  contactEmail?: string;
  estimatedValue?: number;
  currency?: string;
  submissionDeadline?: string;
  clarificationDeadline?: string;
  stage?: OpportunityStage;
  priority?: OpportunityPriority;
  assignedTeamMember?: string;
  internalNotes?: string;
}

// In-memory tenant-isolated stores
const opportunityStore = new Map<string, Opportunity>();
const activityStore = new Map<string, OpportunityActivity[]>();
const requirementStore = new Map<string, Requirement[]>();
const matchStore = new Map<string, RequirementEvidenceMatch[]>();

// Seed default initial opportunities for demonstration
function seedInitialOpportunities() {
  if (opportunityStore.size > 0) return;

  const defaultOpp: Opportunity = {
    id: 'opp-faa-radar-098',
    organization_id: 'org-1',
    created_by_user_id: 'user-1',
    title: 'FAA Radar Modernization — Demo',
    description: '[DEMO SYNTHETIC SOLICITATION] Autonomous ingestion and real-time correlation of radar telemetry data for civil aviation airspace management.',
    reference_code: 'RFP-2026-FAA-DEMO',
    issuing_body: 'Federal Aviation Administration (FAA)',
    contact_email: 'contracting.officer@faa.gov',
    estimated_value: 6400000,
    currency: 'USD',
    submission_deadline: '2026-12-15T17:00:00Z',
    clarification_deadline: '2026-11-25T17:00:00Z',
    stage: 'IN_PREPARATION',
    priority: 'high',
    assigned_team_member: 'Sarah Jenkins (Lead Bid Manager)',
    internal_notes: 'Priority defense contractor demonstration. FedRAMP High and telemetry throughput benchmarks are go/no-go gates.',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-05T14:30:00Z',
  };

  const defaultOpp2: Opportunity = {
    id: 'opp-dod-logistics',
    organization_id: 'org-1',
    created_by_user_id: 'user-1',
    title: 'DOD Advanced Logistics & Automated Warehousing RFP',
    description: 'Multi-node warehouse robotics automation and supply chain resilience framework.',
    reference_code: 'RFP-2026-LOG-0042',
    issuing_body: 'US Department of Defense',
    contact_email: 'procurement@defense.gov',
    estimated_value: 14200000,
    currency: 'USD',
    submission_deadline: '2026-11-28T17:00:00Z',
    clarification_deadline: '2026-11-18T17:00:00Z',
    stage: 'UNDER_REVIEW',
    priority: 'urgent',
    assigned_team_member: 'Marcus Sterling',
    internal_notes: 'Requires coordination with teaming partners on physical logistics hardware.',
    created_at: '2026-11-02T09:00:00Z',
    updated_at: '2026-11-04T11:00:00Z',
  };

  opportunityStore.set(defaultOpp.id, defaultOpp);
  opportunityStore.set(defaultOpp2.id, defaultOpp2);

  // Seed realistic extracted requirements for opp-faa-radar-098
  const reqs: Requirement[] = [
    {
      id: 'req-faa-01',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      type: 'mandatory',
      category: 'Cybersecurity',
      title: 'Active FedRAMP High or DoD IL5 Authorization',
      description: 'The offeror must demonstrate an existing FedRAMP High Authority to Operate (ATO) or DoD Impact Level 5 (IL5) provisional authorization at proposal submission.',
      source_reference: {
        page_number: 14,
        section_title: 'Section C.4.1 - Security Controls',
        snippet: 'Active FedRAMP High Authorization is required at proposal submission.',
        raw_quote: 'Offerors shall furnish evidence of active FedRAMP High Authorization or active DoD IL5 Provisional Authorization issued by DISA.',
      },
      confidence_score: 0.99,
      manual_review_required: false,
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'req-faa-02',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      type: 'mandatory',
      category: 'Certification',
      title: 'ISO 27001 Information Security Management Certificate',
      description: 'Offerors shall provide proof of current ISO/IEC 27001 accreditation covering cloud operations.',
      source_reference: {
        page_number: 16,
        section_title: 'Section C.4.3 - Accredited Standards',
        snippet: 'Certified ISO 27001 compliance is an evaluation prerequisite.',
        raw_quote: 'Bidders must include current ISO 27001 certificate verified by accredited audit registrar.',
      },
      confidence_score: 0.98,
      manual_review_required: false,
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'req-faa-03',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      type: 'mandatory',
      category: 'Insurance',
      title: 'Commercial General Liability Policy ($5M)',
      description: 'Contractor must submit certificate of insurance with minimum $5,000,000 general liability coverage.',
      source_reference: {
        page_number: 30,
        section_title: 'Clause G.2 - Insurance Prerequisite',
        snippet: '$5,000,000 commercial general liability insurance required.',
        raw_quote: 'Contractor must submit certificate of insurance with minimum $5,000,000 general liability coverage.',
      },
      confidence_score: 0.95,
      manual_review_required: false,
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'req-faa-04',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      type: 'desirable',
      category: 'Past Performance',
      title: 'Prior Civil Aviation Radar Automation Experience',
      description: 'Offerors demonstrating past performance in joint civil-military airspace automation receive trade-off advantage.',
      source_reference: {
        page_number: 45,
        section_title: 'Section M.2 - Evaluation Factors',
        snippet: 'Bonus evaluation scoring for civil aviation radar track record.',
        raw_quote: 'Offerors demonstrating relevant past performance in joint civil-military airspace projects will receive evaluated trade-off advantage.',
      },
      confidence_score: 0.88,
      manual_review_required: false,
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'req-faa-05',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      type: 'mandatory',
      category: 'Maritime Operations',
      title: 'Commercial Deepwater Submersible Pilot License',
      description: 'Key recovery crew must present active deepwater commercial submersible pilot credentials.',
      source_reference: {
        page_number: 52,
        section_title: 'Section H.9 - Specialized Maritime Recovery',
        snippet: 'Deepwater pilot credentials mandatory for oceanic recovery nodes.',
        raw_quote: 'Operating engineers for oceanic telemetry buoys must hold commercial deepwater submersible pilot licenses.',
      },
      confidence_score: 0.96,
      manual_review_required: false,
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'req-faa-06',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      type: 'mandatory',
      category: 'Compliance',
      title: 'Subcontractor Quality Assurance Manual Approval',
      description: 'Vendor must furnish corporate quality governance manual conforming to IEEE/ISO telemetry standards.',
      source_reference: {
        page_number: 22,
        section_title: 'Section C.8 - Quality Governance',
        snippet: 'Subcontractor quality assurance manual required.',
        raw_quote: 'Bidders must furnish approved quality assurance manual detailing software telemetry review procedures.',
      },
      confidence_score: 0.90,
      manual_review_required: true,
      created_at: '2026-11-01T10:00:00Z',
    },
  ];

  requirementStore.set(defaultOpp.id, reqs);

  // Seed initial activities
  activityStore.set(defaultOpp.id, [
    {
      id: 'act-1',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      user_id: 'user-1',
      user_name: 'Sarah Jenkins',
      action: 'STATUS_CHANGE',
      description: 'Opportunity created from tender document upload and moved to IN_PREPARATION.',
      created_at: '2026-11-01T10:05:00Z',
    },
    {
      id: 'act-2',
      organization_id: 'org-1',
      opportunity_id: defaultOpp.id,
      user_id: 'user-1',
      user_name: 'Sarah Jenkins',
      action: 'EVIDENCE_LINKED',
      description: 'Evidence Matching Engine executed: 2 requirements matched with verified corporate credentials.',
      created_at: '2026-11-01T10:15:00Z',
    },
  ]);
}

seedInitialOpportunities();

export class OpportunityService {
  private matchingEngine: RequirementMatchingEngine;
  private repository?: OpportunityRepository;
  private evidenceRepository?: EvidenceRepository;

  constructor(
    matchingEngine?: RequirementMatchingEngine,
    repository?: OpportunityRepository,
    evidenceRepository?: EvidenceRepository
  ) {
    this.matchingEngine = matchingEngine || new RequirementMatchingEngine();
    this.repository = repository;
    this.evidenceRepository = evidenceRepository;
  }

  /**
   * Creates a new Opportunity record.
   */
  createOpportunity(params: CreateOpportunityParams): Opportunity {
    const {
      organizationId,
      userId,
      title,
      description,
      referenceCode,
      issuingBody,
      contactEmail,
      estimatedValue,
      currency = 'USD',
      submissionDeadline,
      clarificationDeadline,
      priority = 'medium',
      assignedTeamMember,
      internalNotes,
    } = params;

    if (!organizationId || !title) {
      throw new Error('Validation Error: organizationId and title are required.');
    }

    const id = `opp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const opportunity: Opportunity = {
      id,
      organization_id: organizationId,
      created_by_user_id: userId,
      title,
      description: description || null,
      reference_code: referenceCode || null,
      issuing_body: issuingBody || null,
      contact_email: contactEmail || null,
      estimated_value: estimatedValue || null,
      currency,
      submission_deadline: submissionDeadline || null,
      clarification_deadline: clarificationDeadline || null,
      stage: 'DISCOVERED',
      priority,
      assigned_team_member: assignedTeamMember || null,
      internal_notes: internalNotes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    opportunityStore.set(id, opportunity);
    this.recordActivity(id, organizationId, userId, 'STATUS_CHANGE', `Opportunity initialized in stage DISCOVERED.`);

    return opportunity;
  }

  /**
   * Retrieves an Opportunity verifying organization boundary.
   */
  getOpportunity(opportunityId: string, organizationId: string): Opportunity | null {
    const opp = opportunityStore.get(opportunityId);
    if (!opp) return null;

    if (opp.organization_id !== organizationId) {
      throw new Error(
        `Security Violation: Cross-tenant access denied. Opportunity "${opportunityId}" does not belong to organization "${organizationId}".`
      );
    }

    return opp;
  }

  /**
   * Lists opportunities with search, filter, and sorting.
   */
  listOpportunities(
    organizationId: string,
    filters?: {
      stage?: OpportunityStage;
      priority?: OpportunityPriority;
      search?: string;
      sortBy?: 'submission_deadline' | 'created_at' | 'estimated_value';
      sortOrder?: 'asc' | 'desc';
    }
  ): Opportunity[] {
    seedInitialOpportunities();
    const results: Opportunity[] = [];

    for (const opp of opportunityStore.values()) {
      if (opp.organization_id === organizationId) {
        if (filters?.stage && opp.stage !== filters.stage) continue;
        if (filters?.priority && opp.priority !== filters.priority) continue;

        if (filters?.search) {
          const q = filters.search.toLowerCase();
          const match =
            opp.title.toLowerCase().includes(q) ||
            opp.reference_code?.toLowerCase().includes(q) ||
            opp.issuing_body?.toLowerCase().includes(q) ||
            opp.description?.toLowerCase().includes(q);
          if (!match) continue;
        }

        results.push(opp);
      }
    }

    const sortBy = filters?.sortBy || 'created_at';
    const sortOrder = filters?.sortOrder || 'desc';

    return results.sort((a, b) => {
      const valA = a[sortBy] ?? '';
      const valB = b[sortBy] ?? '';
      if (valA === valB) return 0;
      const comp = valA > valB ? 1 : -1;
      return sortOrder === 'asc' ? comp : -comp;
    });
  }

  /**
   * Updates an Opportunity, validating tenant isolation and logging changes.
   */
  updateOpportunity(
    opportunityId: string,
    organizationId: string,
    userId: string,
    params: UpdateOpportunityParams
  ): Opportunity {
    const opp = this.getOpportunity(opportunityId, organizationId);
    if (!opp) {
      throw new Error(`Opportunity "${opportunityId}" not found.`);
    }

    const previousStage = opp.stage;
    const previousPriority = opp.priority;

    if (params.title !== undefined) opp.title = params.title;
    if (params.description !== undefined) opp.description = params.description;
    if (params.referenceCode !== undefined) opp.reference_code = params.referenceCode;
    if (params.issuingBody !== undefined) opp.issuing_body = params.issuingBody;
    if (params.contactEmail !== undefined) opp.contact_email = params.contactEmail;
    if (params.estimatedValue !== undefined) opp.estimated_value = params.estimatedValue;
    if (params.currency !== undefined) opp.currency = params.currency;
    if (params.submissionDeadline !== undefined) opp.submission_deadline = params.submissionDeadline;
    if (params.clarificationDeadline !== undefined) opp.clarification_deadline = params.clarificationDeadline;
    if (params.assignedTeamMember !== undefined) opp.assigned_team_member = params.assignedTeamMember;
    if (params.internalNotes !== undefined) opp.internal_notes = params.internalNotes;

    if (params.stage !== undefined && params.stage !== previousStage) {
      opp.stage = params.stage;
      this.recordActivity(
        opportunityId,
        organizationId,
        userId,
        'STATUS_CHANGE',
        `Opportunity workflow status transitioned from ${previousStage} to ${params.stage}.`
      );
    }

    if (params.priority !== undefined && params.priority !== previousPriority) {
      opp.priority = params.priority;
      this.recordActivity(
        opportunityId,
        organizationId,
        userId,
        'PRIORITY_UPDATED',
        `Opportunity priority changed from ${previousPriority} to ${params.priority}.`
      );
    }

    opp.updated_at = new Date().toISOString();
    opportunityStore.set(opportunityId, opp);
    return opp;
  }

  /**
   * Attaches extracted requirements to an opportunity.
   */
  setOpportunityRequirements(
    opportunityId: string,
    organizationId: string,
    requirements: Requirement[]
  ): void {
    const opp = this.getOpportunity(opportunityId, organizationId);
    if (!opp) throw new Error('Opportunity not found.');

    requirementStore.set(opportunityId, requirements);

    // Automatically trigger evidence matching
    const matches = this.matchingEngine.matchAllOpportunityRequirements(requirements, organizationId);
    matchStore.set(opportunityId, matches);
  }

  /**
   * Retrieves requirements and matches for an opportunity.
   */
  getOpportunityRequirements(opportunityId: string, organizationId: string): Requirement[] {
    this.getOpportunity(opportunityId, organizationId);
    return requirementStore.get(opportunityId) || [];
  }

  /**
   * Retrieves matches for an opportunity.
   */
  getOpportunityMatches(opportunityId: string, organizationId: string): RequirementEvidenceMatch[] {
    this.getOpportunity(opportunityId, organizationId);
    let matches = matchStore.get(opportunityId);

    if (!matches) {
      const reqs = this.getOpportunityRequirements(opportunityId, organizationId);
      matches = this.matchingEngine.matchAllOpportunityRequirements(reqs, organizationId);
      matchStore.set(opportunityId, matches);
    }

    return matches;
  }

  /**
   * Transparently calculates the readiness overview for an opportunity.
   * Explains exactly how numbers and readiness stages were determined without deceptive compliance claims.
   */
  getReadinessOverview(opportunityId: string, organizationId: string): ReadinessOverview {
    const opp = this.getOpportunity(opportunityId, organizationId);
    if (!opp) throw new Error('Opportunity not found.');

    const requirements = this.getOpportunityRequirements(opportunityId, organizationId);
    const matches = this.getOpportunityMatches(opportunityId, organizationId);

    return this.calculateReadinessFromMatches(opportunityId, requirements, matches);
  }

  /**
   * Shared transparent readiness calculation formula.
   */
  calculateReadinessFromMatches(
    opportunityId: string,
    requirements: Requirement[],
    matches: RequirementEvidenceMatch[]
  ): ReadinessOverview {
    let matchedCount = 0;
    let partiallyMatchedCount = 0;
    let missingEvidenceCount = 0;
    let expiredEvidenceCount = 0;
    let requiresReviewCount = 0;

    let mandatoryTotal = 0;
    let mandatoryMatched = 0;

    for (const m of matches) {
      const isMandatory = m.requirement?.type === 'mandatory';
      if (isMandatory) mandatoryTotal++;

      switch (m.match_outcome) {
        case 'MATCHED':
          matchedCount++;
          if (isMandatory) mandatoryMatched++;
          break;
        case 'PARTIALLY_MATCHED':
          partiallyMatchedCount++;
          break;
        case 'MISSING_EVIDENCE':
          missingEvidenceCount++;
          break;
        case 'EXPIRED_EVIDENCE':
          expiredEvidenceCount++;
          break;
        case 'REQUIRES_REVIEW':
          requiresReviewCount++;
          break;
      }
    }

    let readinessStage: ReadinessStage = 'NOT_READY';
    let calculationExplanation = '';

    if (mandatoryTotal > 0 && mandatoryMatched === mandatoryTotal && expiredEvidenceCount === 0 && missingEvidenceCount === 0) {
      readinessStage = 'SUBMISSION_READY';
      calculationExplanation = `All ${mandatoryTotal} mandatory requirements have verified, unexpired supporting documentation. Proposal is substantively complete and ready for executive review.`;
    } else if (expiredEvidenceCount > 0 || missingEvidenceCount > 0) {
      readinessStage = 'ACTION_REQUIRED';
      calculationExplanation = `Identified ${expiredEvidenceCount} expired evidence artifact(s) and ${missingEvidenceCount} missing requirement(s). Mandatory documentation gaps must be rectified prior to proposal submission.`;
    } else if (requiresReviewCount > 0 || partiallyMatchedCount > 0) {
      readinessStage = 'NEEDS_VERIFICATION';
      calculationExplanation = `${requiresReviewCount} item(s) require human compliance verification and ${partiallyMatchedCount} partial match(es) require supplemental narratives.`;
    } else {
      readinessStage = 'NOT_READY';
      calculationExplanation = 'Initial qualification intake. Additional documentation required.';
    }

    return {
      opportunity_id: opportunityId,
      total_requirements: requirements.length,
      matched_count: matchedCount,
      partially_matched_count: partiallyMatchedCount,
      missing_evidence_count: missingEvidenceCount,
      expired_evidence_count: expiredEvidenceCount,
      requires_review_count: requiresReviewCount,
      mandatory_total: mandatoryTotal,
      mandatory_matched: mandatoryMatched,
      readiness_stage: readinessStage,
      calculation_explanation: calculationExplanation,
      disclaimer: 'This readiness assessment reflects internal documentation coverage only. It does not provide legal advice or guarantee tender eligibility or award.',
    };
  }

  /**
   * Logs an activity in the opportunity audit trail.
   */
  recordActivity(
    opportunityId: string,
    organizationId: string,
    userId: string,
    action: OpportunityActivity['action'],
    description: string,
    userName: string = 'Authorized Team Member'
  ): OpportunityActivity {
    const activity: OpportunityActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organization_id: organizationId,
      opportunity_id: opportunityId,
      user_id: userId,
      user_name: userName,
      action,
      description,
      created_at: new Date().toISOString(),
    };

    const existing = activityStore.get(opportunityId) || [];
    existing.unshift(activity);
    activityStore.set(opportunityId, existing);

    return activity;
  }

  /**
   * Retrieves activity trail for an opportunity.
   */
  getActivities(opportunityId: string, organizationId: string): OpportunityActivity[] {
    this.getOpportunity(opportunityId, organizationId);
    return activityStore.get(opportunityId) || [];
  }

  // --- Real Supabase PostgreSQL Async Methods ---

  async listOpportunitiesAsync(organizationId: string): Promise<Opportunity[]> {
    if (this.repository) {
      return this.repository.listOpportunities(organizationId);
    }
    return this.listOpportunities(organizationId);
  }

  async getOpportunityAsync(opportunityId: string, organizationId: string): Promise<Opportunity | null> {
    if (this.repository) {
      const opp = await this.repository.getOpportunity(opportunityId);
      if (opp && opp.organization_id !== organizationId) {
        throw new Error(
          `Security Violation: Cross-tenant access denied. Opportunity "${opportunityId}" does not belong to organization "${organizationId}".`
        );
      }
      return opp;
    }
    return this.getOpportunity(opportunityId, organizationId);
  }

  async createOpportunityAsync(params: CreateOpportunityParams): Promise<Opportunity> {
    if (this.repository) {
      return this.repository.createOpportunity({
        organization_id: params.organizationId,
        created_by_user_id: params.userId,
        title: params.title,
        description: params.description || null,
        reference_code: params.referenceCode || null,
        issuing_body: params.issuingBody || null,
        contact_email: params.contactEmail || null,
        estimated_value: params.estimatedValue || null,
        currency: params.currency || 'USD',
        submission_deadline: params.submissionDeadline || null,
        clarification_deadline: params.clarificationDeadline || null,
        priority: params.priority || 'medium',
        assigned_team_member: params.assignedTeamMember || null,
        internal_notes: params.internalNotes || null,
      });
    }
    return this.createOpportunity(params);
  }

  async updateOpportunityAsync(
    opportunityId: string,
    organizationId: string,
    userId: string,
    params: UpdateOpportunityParams
  ): Promise<Opportunity> {
    if (this.repository) {
      const existing = await this.getOpportunityAsync(opportunityId, organizationId);
      if (!existing) {
        throw new Error(`Opportunity "${opportunityId}" not found.`);
      }
      return this.repository.updateOpportunity(opportunityId, {
        title: params.title,
        description: params.description,
        reference_code: params.referenceCode,
        issuing_body: params.issuingBody,
        contact_email: params.contactEmail,
        estimated_value: params.estimatedValue,
        currency: params.currency,
        submission_deadline: params.submissionDeadline,
        clarification_deadline: params.clarificationDeadline,
        stage: params.stage,
        priority: params.priority,
        assigned_team_member: params.assignedTeamMember,
        internal_notes: params.internalNotes,
      });
    }
    return this.updateOpportunity(opportunityId, organizationId, userId, params);
  }

  async deleteOpportunityAsync(opportunityId: string, organizationId: string): Promise<boolean> {
    if (this.repository) {
      const existing = await this.getOpportunityAsync(opportunityId, organizationId);
      if (!existing) return false;
      await this.repository.deleteOpportunity(opportunityId);
      return true;
    }
    opportunityStore.delete(opportunityId);
    requirementStore.delete(opportunityId);
    matchStore.delete(opportunityId);
    activityStore.delete(opportunityId);
    return true;
  }

  async listRequirementsAsync(opportunityId: string, organizationId: string = 'org-1'): Promise<Requirement[]> {
    if (this.repository) {
      return this.repository.listRequirements(opportunityId);
    }
    return this.getOpportunityRequirements(opportunityId, organizationId);
  }

  async listMatchesAsync(opportunityId: string, organizationId: string = 'org-1'): Promise<RequirementEvidenceMatch[]> {
    if (this.repository) {
      return this.repository.listMatchesWithDetails(opportunityId);
    }
    return this.getOpportunityMatches(opportunityId, organizationId);
  }

  async runMatchingAsync(
    opportunityId: string,
    organizationId: string
  ): Promise<{ matches: RequirementEvidenceMatch[]; readiness: ReadinessOverview }> {
    if (this.repository) {
      const opp = await this.getOpportunityAsync(opportunityId, organizationId);
      if (!opp) throw new Error('Opportunity not found.');

      const requirements = await this.repository.listRequirements(opportunityId);
      let evidences: Evidence[] = [];
      if (this.evidenceRepository) {
        evidences = await this.evidenceRepository.listEvidence(organizationId);
      }

      // Execute matching engine strictly
      const rawMatches = this.matchingEngine.matchAllOpportunityRequirementsWithEvidence(
        requirements,
        evidences,
        organizationId
      );

      // Clean existing matches to avoid duplicates
      await this.repository.deleteMatches(opportunityId);

      // Persist newly matched requirements to PostgreSQL
      for (const m of rawMatches) {
        await this.repository.createMatch({
          organization_id: organizationId,
          opportunity_id: opportunityId,
          requirement_id: m.requirement_id,
          evidence_id: m.evidence_id || null,
          match_outcome: m.match_outcome,
          confidence_score: m.confidence_score,
          match_explanation: m.match_explanation,
          missing_information: m.missing_information || null,
          human_review_required: m.human_review_required,
          human_review_notes: m.human_review_notes || null,
          verified_by_user_id: m.verified_by_user_id || null,
          verified_at: m.verified_at || null,
        });
      }

      const matches = await this.repository.listMatchesWithDetails(opportunityId);
      const readiness = this.calculateReadinessFromMatches(opportunityId, requirements, matches);

      return { matches, readiness };
    }

    // In-memory fallback
    const reqs = this.getOpportunityRequirements(opportunityId, organizationId);
    const matches = this.matchingEngine.matchAllOpportunityRequirements(reqs, organizationId);
    matchStore.set(opportunityId, matches);
    const readiness = this.getReadinessOverview(opportunityId, organizationId);

    return { matches, readiness };
  }

  async getReadinessOverviewAsync(
    opportunityId: string,
    organizationId: string
  ): Promise<ReadinessOverview> {
    if (this.repository) {
      const requirements = await this.repository.listRequirements(opportunityId);
      const matches = await this.repository.listMatchesWithDetails(opportunityId);
      return this.calculateReadinessFromMatches(opportunityId, requirements, matches);
    }
    return this.getReadinessOverview(opportunityId, organizationId);
  }

  async updateMatchVerificationAsync(
    matchId: string,
    organizationId: string,
    userId: string,
    params: {
      verified: boolean;
      matchOutcome?: MatchOutcome;
      notes?: string;
    }
  ): Promise<RequirementEvidenceMatch> {
    if (this.repository) {
      const updated = await this.repository.updateMatch(matchId, {
        human_review_required: !params.verified,
        verified_by_user_id: params.verified ? userId : null,
        verified_at: params.verified ? new Date().toISOString() : null,
        ...(params.matchOutcome ? { match_outcome: params.matchOutcome } : {}),
        ...(params.notes !== undefined ? { human_review_notes: params.notes } : {}),
      });

      return updated;
    }

    // In-memory fallback
    for (const [oppId, matches] of matchStore.entries()) {
      const idx = matches.findIndex((m) => m.id === matchId);
      if (idx !== -1) {
        const item = matches[idx];
        const updated: RequirementEvidenceMatch = {
          ...item,
          human_review_required: !params.verified,
          verified_by_user_id: params.verified ? userId : null,
          verified_at: params.verified ? new Date().toISOString() : null,
          match_outcome: params.matchOutcome || item.match_outcome,
          human_review_notes: params.notes !== undefined ? params.notes : item.human_review_notes,
          updated_at: new Date().toISOString(),
        };
        matches[idx] = updated;
        matchStore.set(oppId, matches);
        return updated;
      }
    }
    throw new Error(`Match "${matchId}" not found.`);
  }

  async listActivitiesAsync(opportunityId: string): Promise<OpportunityActivity[]> {
    if (this.repository) {
      return this.repository.listActivities(opportunityId);
    }
    return activityStore.get(opportunityId) || [];
  }
}
