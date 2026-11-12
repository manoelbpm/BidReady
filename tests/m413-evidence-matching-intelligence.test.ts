import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { RequirementMatchingEngine } from '../src/lib/matching/engine';
import { EvidenceService } from '../src/lib/evidence/service';
import { OpportunityService } from '../src/lib/opportunities/service';
import { OpportunityRepository } from '../src/lib/supabase/repositories/opportunity-repository';
import { EvidenceRepository } from '../src/lib/supabase/repositories/evidence-repository';
import { Requirement, Evidence, RequirementEvidenceMatch } from '../src/types/models';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Ignore if not present
  }
}

describe('M4.13 — Evidence Matching & Supplier Readiness Intelligence Suite', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const org1Id = 'b22937b6-51e5-48a0-a75d-7b3405427298'; // Global Defense Systems Corp
  const org2Id = '7a9537da-ff33-4f55-a93a-f86813234f34'; // Competitor Tenant

  let clientOrg1: SupabaseClient;
  let clientOrg2: SupabaseClient;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    expect(supabaseUrl).toBeTruthy();
    expect(anonKey).toBeTruthy();

    clientOrg1 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth1 = await clientOrg1.auth.signInWithPassword({
      email: 'analyst@bidready.com',
      password: 'SuperSecret2026!',
    });
    expect(auth1.error).toBeNull();
    user1Id = auth1.data.user!.id;

    clientOrg2 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth2 = await clientOrg2.auth.signInWithPassword({
      email: 'competitor@bidready.com',
      password: 'SuperSecret2026!',
    });
    expect(auth2.error).toBeNull();
    user2Id = auth2.data.user!.id;
  });

  // =========================================================================
  // PART A: Matching Engine Domain Logic & Business Rules
  // =========================================================================
  describe('Part A: Deterministic Matching Rules & 5 Classification States', () => {
    const evidenceService = new EvidenceService();
    const matchingEngine = new RequirementMatchingEngine(evidenceService);
    const testOrgId = 'tenant-alpha-test';

    const verifiedFedRampEvidence: Evidence = {
      id: 'ev-alpha-fedramp',
      organization_id: testOrgId,
      title: 'FedRAMP High Authorization Package (ATO Letter)',
      category: 'Cybersecurity',
      description: 'Formal Agency Authority to Operate (ATO) certification for Federal Information Security.',
      issuing_organization: 'FedRAMP PMO',
      valid_until: '2028-12-31T00:00:00Z',
      verification_status: 'verified',
      tags: ['FedRAMP', 'ATO', 'NIST SP 800-53', 'Security'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const expiredInsuranceEvidence: Evidence = {
      id: 'ev-alpha-insurance-expired',
      organization_id: testOrgId,
      title: 'Commercial General Liability Policy ($5M Coverage)',
      category: 'Insurance',
      description: 'Commercial liability certificate naming municipal and federal entities as additional insured.',
      issuing_organization: 'Travelers Underwriters',
      valid_until: '2023-01-01T00:00:00Z', // Past date: Expired!
      verification_status: 'expired',
      tags: ['Insurance', 'Liability', 'Commercial'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const partialTelemetryEvidence: Evidence = {
      id: 'ev-alpha-partial-telemetry',
      organization_id: testOrgId,
      title: 'Legacy Signal Calibration Whitepaper',
      category: 'Research',
      description: 'Internal lab test measuring secondary surveillance radar frequency stability.',
      issuing_organization: 'Internal Radar Engineering Lab',
      valid_until: '2027-01-01T00:00:00Z',
      verification_status: 'verified',
      tags: ['Calibration', 'Telemetry'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const pendingQualityEvidence: Evidence = {
      id: 'ev-alpha-pending-qa',
      organization_id: testOrgId,
      title: 'Quality Assurance Manual ISO 9001 Draft',
      category: 'Quality',
      description: 'Corporate QA process manual awaiting management sign-off.',
      issuing_organization: 'QA Governance',
      valid_until: '2028-01-01T00:00:00Z',
      verification_status: 'pending_verification', // Not verified yet
      tags: ['Quality', 'ISO 9001', 'QA'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('1. Classifies as MATCHED when active, verified, unexpired evidence satisfies criteria', () => {
      const req: Requirement = {
        id: 'req-01-fedramp',
        organization_id: testOrgId,
        opportunity_id: 'opp-alpha-1',
        type: 'mandatory',
        category: 'Cybersecurity',
        title: 'FedRAMP High Authorization ATO',
        description: 'Vendor must hold valid FedRAMP High Authorization.',
        source_reference: {
          page_number: 14,
          section_title: 'Section C.4.1 - Cyber Thresholds',
          snippet: 'FedRAMP High ATO required.',
          raw_quote: 'Bidders must furnish proof of active FedRAMP High ATO.',
        },
        confidence_score: 0.98,
        manual_review_required: false,
        created_at: new Date().toISOString(),
      };

      const match = matchingEngine.matchRequirementWithEvidence(
        req,
        [verifiedFedRampEvidence],
        testOrgId
      );

      expect(match.match_outcome).toBe('MATCHED');
      expect(match.evidence_id).toBe('ev-alpha-fedramp');
      expect(match.confidence_score).toBeGreaterThanOrEqual(0.80);
      expect(match.match_explanation).toContain('Compliant evidence found');
      expect(match.human_review_required).toBe(false);
    });

    it('2. Strictly classifies as EXPIRED_EVIDENCE when document is expired, proving expired evidence is NEVER valid', () => {
      const req: Requirement = {
        id: 'req-02-insurance',
        organization_id: testOrgId,
        opportunity_id: 'opp-alpha-1',
        type: 'mandatory',
        category: 'Insurance',
        title: 'Commercial General Liability Policy ($5M Coverage)',
        description: 'Vendor must maintain commercial general liability policy of at least $5,000,000.',
        source_reference: {
          page_number: 22,
          section_title: 'Section H - Insurance Clauses',
          snippet: 'Commercial general liability minimum $5M.',
          raw_quote: 'Contractor shall maintain Commercial General Liability with policy limits not less than $5,000,000.',
        },
        confidence_score: 0.95,
        manual_review_required: false,
        created_at: new Date().toISOString(),
      };

      const match = matchingEngine.matchRequirementWithEvidence(
        req,
        [expiredInsuranceEvidence],
        testOrgId
      );

      expect(match.match_outcome).toBe('EXPIRED_EVIDENCE');
      expect(match.evidence_id).toBe('ev-alpha-insurance-expired');
      expect(match.match_explanation).toContain('Critical Compliance Alert');
      expect(match.match_explanation).toContain('expired on');
      expect(match.missing_information).toContain('Renewed or active certificate required');
      expect(match.human_review_required).toBe(true);
    });

    it('3. Classifies as PARTIALLY_MATCHED and records specific gaps for incomplete evidence', () => {
      const req: Requirement = {
        id: 'req-03-radar-feed',
        organization_id: testOrgId,
        opportunity_id: 'opp-alpha-1',
        type: 'mandatory',
        category: 'Technical',
        title: 'Primary and Secondary Air Surveillance Radar Real-time Data Feed',
        description: 'Vendor must demonstrate continuous telemetry ingestion across dual primary and secondary radar transponders.',
        source_reference: {
          page_number: 8,
          section_title: 'Section B.2 - Radar Telemetry',
          snippet: 'Dual transponder ingestion.',
          raw_quote: 'The telemetry engine must ingest dual feeds simultaneously without data degradation.',
        },
        confidence_score: 0.90,
        manual_review_required: false,
        created_at: new Date().toISOString(),
      };

      const match = matchingEngine.matchRequirementWithEvidence(
        req,
        [partialTelemetryEvidence],
        testOrgId
      );

      expect(match.match_outcome).toBe('PARTIALLY_MATCHED');
      expect(match.evidence_id).toBe('ev-alpha-partial-telemetry');
      expect(match.match_explanation).toContain('Partial coverage');
      expect(match.missing_information).toBeDefined();
      expect(match.human_review_required).toBe(true);
    });

    it('4. Classifies as MISSING_EVIDENCE and highlights mandatory requirement without evidence with maximum severity', () => {
      const req: Requirement = {
        id: 'req-04-nuclear-clearance',
        organization_id: testOrgId,
        opportunity_id: 'opp-alpha-1',
        type: 'mandatory',
        category: 'Personnel',
        title: 'DoE Nuclear Facility Security Clearance (Q Clearance)',
        description: 'All field engineers must possess active Department of Energy Q Clearance.',
        source_reference: {
          page_number: 30,
          section_title: 'Personnel Security',
          snippet: 'DoE Q Clearance required.',
          raw_quote: 'Personnel assigned to site must hold active Q Clearance credentials.',
        },
        confidence_score: 0.99,
        manual_review_required: false,
        created_at: new Date().toISOString(),
      };

      const match = matchingEngine.matchRequirementWithEvidence(
        req,
        [verifiedFedRampEvidence, expiredInsuranceEvidence], // none matches DoE Q Clearance
        testOrgId
      );

      expect(match.match_outcome).toBe('MISSING_EVIDENCE');
      expect(match.evidence_id).toBeNull();
      expect(match.match_explanation).toContain('No supporting documentation found');
      expect(match.missing_information).toContain('Missing required evidence');
      expect(match.human_review_required).toBe(true);
      expect(match.human_review_notes).toContain('Mandatory qualification gap');
    });

    it('5. Classifies as REQUIRES_REVIEW when evidence matches criteria but is pending human verification', () => {
      const req: Requirement = {
        id: 'req-05-iso9001',
        organization_id: testOrgId,
        opportunity_id: 'opp-alpha-1',
        type: 'desirable',
        category: 'Quality',
        title: 'Corporate Quality Assurance Manual ISO 9001',
        description: 'Bidder should present QA manual adhering to ISO 9001.',
        source_reference: {
          page_number: 18,
          section_title: 'Quality',
          snippet: 'ISO 9001 QA manual.',
          raw_quote: 'Suppliers with accredited QA manual will receive score preference.',
        },
        confidence_score: 0.88,
        manual_review_required: false,
        created_at: new Date().toISOString(),
      };

      const match = matchingEngine.matchRequirementWithEvidence(
        req,
        [pendingQualityEvidence],
        testOrgId
      );

      expect(match.match_outcome).toBe('REQUIRES_REVIEW');
      expect(match.evidence_id).toBe('ev-alpha-pending-qa');
      expect(match.human_review_required).toBe(true);
      expect(match.human_review_notes).toContain('awaiting initial human compliance verification');
    });

    it('6. Ensures bidirectional traceability: requirement citations & evidence metadata are preserved', () => {
      const req: Requirement = {
        id: 'req-06-traceability',
        organization_id: testOrgId,
        opportunity_id: 'opp-alpha-1',
        type: 'mandatory',
        category: 'Cybersecurity',
        title: 'FedRAMP High Authorization Package',
        description: 'Full traceability validation test.',
        source_reference: {
          page_number: 45,
          section_title: 'Appendix C - FedRAMP Verification',
          snippet: 'Formal ATO letter required.',
          raw_quote: 'Submit copy of ATO signed by designated authorizing official.',
        },
        confidence_score: 0.95,
        manual_review_required: false,
        created_at: new Date().toISOString(),
      };

      const match = matchingEngine.matchRequirementWithEvidence(
        req,
        [verifiedFedRampEvidence],
        testOrgId
      );

      // Requirement citation traceability
      expect(match.requirement?.source_reference?.page_number).toBe(45);
      expect(match.requirement?.source_reference?.section_title).toBe('Appendix C - FedRAMP Verification');
      expect(match.requirement?.source_reference?.raw_quote).toContain('Submit copy of ATO signed');

      // Evidence traceability
      expect(match.evidence?.id).toBe('ev-alpha-fedramp');
      expect(match.evidence?.issuing_organization).toBe('FedRAMP PMO');
      expect(match.evidence?.valid_until).toBe('2028-12-31T00:00:00Z');
    });

    it('7. Strictly blocks cross-tenant matching attempts in the domain engine', () => {
      const foreignReq: Requirement = {
        id: 'req-foreign',
        organization_id: 'tenant-competitor',
        opportunity_id: 'opp-competitor',
        type: 'mandatory',
        category: 'Security',
        title: 'Secret Clearance',
        description: 'Test',
        source_reference: { snippet: 'snippet', raw_quote: 'quote' },
        confidence_score: 1.0,
        manual_review_required: false,
        created_at: new Date().toISOString(),
      };

      expect(() => {
        matchingEngine.matchRequirementWithEvidence(foreignReq, [verifiedFedRampEvidence], testOrgId);
      }).toThrowError(/Cross-tenant violation/);
    });

    it('8. Transparently computes ReadinessOverview with mandatory coverage and disclaimers', () => {
      const oppService = new OpportunityService(matchingEngine);

      const requirements: Requirement[] = [
        {
          id: 'r1',
          organization_id: testOrgId,
          opportunity_id: 'opp-test-ro',
          type: 'mandatory',
          category: 'Cybersecurity',
          title: 'Req 1',
          description: 'Desc 1',
          source_reference: { snippet: 's', raw_quote: 'q' },
          confidence_score: 1.0,
          manual_review_required: false,
          created_at: new Date().toISOString(),
        },
        {
          id: 'r2',
          organization_id: testOrgId,
          opportunity_id: 'opp-test-ro',
          type: 'mandatory',
          category: 'Insurance',
          title: 'Req 2',
          description: 'Desc 2',
          source_reference: { snippet: 's', raw_quote: 'q' },
          confidence_score: 1.0,
          manual_review_required: false,
          created_at: new Date().toISOString(),
        },
      ];

      const matches: RequirementEvidenceMatch[] = [
        {
          id: 'm1',
          organization_id: testOrgId,
          opportunity_id: 'opp-test-ro',
          requirement_id: 'r1',
          match_outcome: 'MATCHED',
          confidence_score: 0.95,
          match_explanation: 'Matched',
          human_review_required: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          requirement: requirements[0],
        },
        {
          id: 'm2',
          organization_id: testOrgId,
          opportunity_id: 'opp-test-ro',
          requirement_id: 'r2',
          match_outcome: 'EXPIRED_EVIDENCE',
          confidence_score: 0.90,
          match_explanation: 'Expired',
          human_review_required: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          requirement: requirements[1],
        },
      ];

      const overview = oppService.calculateReadinessFromMatches('opp-test-ro', requirements, matches);

      expect(overview.total_requirements).toBe(2);
      expect(overview.mandatory_total).toBe(2);
      expect(overview.mandatory_matched).toBe(1);
      expect(overview.expired_evidence_count).toBe(1);
      expect(overview.readiness_stage).toBe('ACTION_REQUIRED');
      expect(overview.disclaimer).toContain('reflects internal documentation coverage only');
    });
  });

  // =========================================================================
  // PART B: Real Supabase PostgreSQL Persistence & Multi-Tenant Isolation
  // =========================================================================
  describe('Part B: Real Remote PostgreSQL Integration & RLS Enforcement', () => {
    let oppRepo1: OpportunityRepository;
    let evidenceRepo1: EvidenceRepository;
    let oppService1: OpportunityService;

    let testOpportunityId: string;
    let testReq1Id: string;
    let testReq2Id: string;
    let testReq3Id: string;
    let testEvFedRampId: string;
    let testEvExpiredInsuranceId: string;

    beforeAll(async () => {
      oppRepo1 = new OpportunityRepository(clientOrg1);
      evidenceRepo1 = new EvidenceRepository(clientOrg1);
      oppService1 = new OpportunityService(undefined, oppRepo1, evidenceRepo1);

      // 1. Create a dedicated test opportunity in real PostgreSQL
      const opp = await oppRepo1.createOpportunity({
        organization_id: org1Id,
        created_by_user_id: user1Id,
        title: `M4.13 FAA Radar Matching Acceptance ${Date.now()}`,
        reference_code: `RFP-M413-${Date.now().toString().slice(-4)}`,
        issuing_body: 'Federal Aviation Administration (FAA)',
        stage: 'intake',
        priority: 'high',
      });
      testOpportunityId = opp.id;
      expect(testOpportunityId).toBeDefined();

      // 2. Create requirements with citations in real PostgreSQL
      const req1 = await oppRepo1.createRequirement({
        organization_id: org1Id,
        opportunity_id: testOpportunityId,
        type: 'mandatory',
        category: 'Cybersecurity',
        title: 'Active FedRAMP High Authorization Proof',
        description: 'Vendor must furnish official ATO proving active FedRAMP High certification.',
        source_reference: {
          page_number: 12,
          section_title: 'Section C.4 - Cybersecurity',
          snippet: 'Active FedRAMP High Authorization is required.',
          raw_quote: 'Offerors must furnish active proof of FedRAMP High Authorization.',
        },
        confidence_score: 0.98,
        manual_review_required: false,
      });
      testReq1Id = req1.id;

      const req2 = await oppRepo1.createRequirement({
        organization_id: org1Id,
        opportunity_id: testOpportunityId,
        type: 'mandatory',
        category: 'Insurance',
        title: 'Commercial General Liability Policy ($5M Coverage)',
        description: 'Vendor must hold valid $5M commercial general liability insurance policy.',
        source_reference: {
          page_number: 28,
          section_title: 'Section H - Insurance',
          snippet: 'Commercial general liability minimum $5,000,000 required.',
          raw_quote: 'Offerors shall maintain commercial general liability with limits not less than $5M.',
        },
        confidence_score: 0.95,
        manual_review_required: false,
      });
      testReq2Id = req2.id;

      const req3 = await oppRepo1.createRequirement({
        organization_id: org1Id,
        opportunity_id: testOpportunityId,
        type: 'mandatory',
        category: 'Maritime Operations',
        title: 'Deepwater ROV Submersible Pilot License',
        description: 'Contractor operators must furnish deepwater submersible credentials.',
        source_reference: {
          page_number: 35,
          section_title: 'Section K - Submersible Systems',
          snippet: 'ROV Pilot license required.',
          raw_quote: 'ROV operators must hold active commercial submarine deep-dive licenses.',
        },
        confidence_score: 0.92,
        manual_review_required: false,
      });
      testReq3Id = req3.id;

      // 3. Create corporate evidence items in real PostgreSQL
      const ev1 = await evidenceRepo1.createEvidence({
        organization_id: org1Id,
        title: 'FedRAMP High Authorization Package (ATO Letter)',
        category: 'Cybersecurity',
        description: 'Formal Agency Authority to Operate (ATO) certification for Federal Information Security.',
        issuing_organization: 'Federal Risk and Authorization Management Program (FedRAMP)',
        valid_until: '2028-12-31T00:00:00Z',
        verification_status: 'verified',
        tags: ['FedRAMP', 'ATO', 'NIST SP 800-53', 'Security'],
      });
      testEvFedRampId = ev1.id;

      const ev2 = await evidenceRepo1.createEvidence({
        organization_id: org1Id,
        title: 'Commercial General Liability Policy ($5M Coverage)',
        category: 'Insurance',
        description: 'Commercial liability certificate naming municipal and federal entities as additional insured.',
        issuing_organization: 'Hartford Commercial Underwriters',
        valid_until: '2023-01-01T00:00:00Z', // Past date: Expired!
        verification_status: 'expired',
        tags: ['Insurance', 'Liability', 'Commercial'],
      });
      testEvExpiredInsuranceId = ev2.id;
    });

    it('9. Executes runMatchingAsync against remote PostgreSQL and persists results into requirement_evidence_matches', async () => {
      const { matches, readiness } = await oppService1.runMatchingAsync(testOpportunityId, org1Id);

      expect(matches).toBeDefined();
      expect(matches.length).toBe(3);

      // Verify outcomes in persisted results
      const fedRampMatch = matches.find((m) => m.requirement_id === testReq1Id);
      expect(fedRampMatch).toBeDefined();
      expect(fedRampMatch?.match_outcome).toBe('MATCHED');
      expect(fedRampMatch?.evidence_id).toBe(testEvFedRampId);

      const insuranceMatch = matches.find((m) => m.requirement_id === testReq2Id);
      expect(insuranceMatch).toBeDefined();
      expect(insuranceMatch?.match_outcome).toBe('EXPIRED_EVIDENCE');
      expect(insuranceMatch?.evidence_id).toBe(testEvExpiredInsuranceId);

      const missingMatch = matches.find((m) => m.requirement_id === testReq3Id);
      expect(missingMatch).toBeDefined();
      expect(missingMatch?.match_outcome).toBe('MISSING_EVIDENCE');
      expect(missingMatch?.evidence_id).toBeNull();

      // Verify readiness overview calculation
      expect(readiness.total_requirements).toBe(3);
      expect(readiness.matched_count).toBe(1);
      expect(readiness.expired_evidence_count).toBe(1);
      expect(readiness.missing_evidence_count).toBe(1);
      expect(readiness.readiness_stage).toBe('ACTION_REQUIRED');
    });

    it('10. Proves cold-start persistence: a completely fresh SupabaseClient fetches the exact matches and hydrated links', async () => {
      const freshClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await freshClient.auth.signInWithPassword({
        email: 'analyst@bidready.com',
        password: 'SuperSecret2026!',
      });

      const freshOppRepo = new OpportunityRepository(freshClient);
      const savedMatches = await freshOppRepo.listMatchesWithDetails(testOpportunityId);

      expect(savedMatches.length).toBe(3);

      const fedRampMatch = savedMatches.find((m) => m.requirement_id === testReq1Id);
      expect(fedRampMatch?.match_outcome).toBe('MATCHED');
      expect(fedRampMatch?.requirement?.title).toContain('FedRAMP High');
      expect(fedRampMatch?.evidence?.title).toContain('FedRAMP High Authorization Package');

      const expiredMatch = savedMatches.find((m) => m.requirement_id === testReq2Id);
      expect(expiredMatch?.match_outcome).toBe('EXPIRED_EVIDENCE');
      expect(expiredMatch?.evidence?.verification_status).toBe('expired');
    });

    it('11. Allows human verification override and records verified_by_user_id and verified_at in PostgreSQL', async () => {
      const savedMatches = await oppRepo1.listMatches(testOpportunityId);
      const targetMatch = savedMatches.find((m) => m.requirement_id === testReq1Id)!;

      const updated = await oppService1.updateMatchVerificationAsync(
        targetMatch.id,
        org1Id,
        user1Id,
        {
          verified: true,
          matchOutcome: 'MATCHED',
          notes: 'Analyst manual audit confirmed compliance against official ATO letter.',
        }
      );

      expect(updated.human_review_required).toBe(false);
      expect(updated.verified_by_user_id).toBe(user1Id);
      expect(updated.verified_at).toBeDefined();
      expect(updated.human_review_notes).toContain('Analyst manual audit confirmed compliance');

      // Check direct PostgreSQL record
      const refreshed = await oppRepo1.listMatches(testOpportunityId);
      const refMatch = refreshed.find((m) => m.id === targetMatch.id);
      expect(refMatch?.verified_by_user_id).toBe(user1Id);
      expect(refMatch?.human_review_notes).toContain('Analyst manual audit confirmed compliance');
    });

    it('12. Strictly enforces multi-tenant RLS: Competitor (Org 2) is blocked from reading Org 1 requirement matches', async () => {
      const oppRepo2 = new OpportunityRepository(clientOrg2);

      // Org 2 attempts to query Org 1's opportunity matches
      const foreignMatches = await oppRepo2.listMatches(testOpportunityId);
      expect(foreignMatches.length).toBe(0);

      // Direct PostgreSQL query from Org 2 client
      const { data, error } = await clientOrg2
        .from('requirement_evidence_matches')
        .select('*')
        .eq('opportunity_id', testOpportunityId);

      expect(error).toBeNull();
      expect(data).toEqual([]); // Completely hidden by RLS!
    });
  });
});
