import { describe, it, expect } from 'vitest';
import { EvidenceService } from '../src/lib/evidence/service';
import { RequirementMatchingEngine } from '../src/lib/matching/engine';
import { Requirement } from '../src/types/models';

describe('Company Evidence Library & Lifecycle Tests', () => {
  const service = new EvidenceService();

  it('creates, lists and retrieves evidence within organization boundary', () => {
    const ev = service.createEvidence({
      organizationId: 'tenant-omega',
      userId: 'user-omega-1',
      title: 'CMMC Level 2 Audit Certification',
      category: 'Cybersecurity',
      issuingOrganization: 'Cyber AB C3PAO',
      validUntil: '2028-06-30T00:00:00Z',
      fileName: 'CMMC_Audit_2025.pdf',
      tags: ['CMMC', 'Cyber', 'NIST-800-171'],
    });

    expect(ev.id).toBeDefined();
    expect(ev.organization_id).toBe('tenant-omega');
    expect(ev.verification_status).toBe('pending_verification');

    const fetched = service.getEvidence(ev.id, 'tenant-omega');
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('CMMC Level 2 Audit Certification');
  });

  it('prevents cross-tenant access to another organization evidence', () => {
    const ev = service.createEvidence({
      organizationId: 'tenant-secret-corp',
      userId: 'user-secret',
      title: 'Top Secret Facility Security Clearance (FCL)',
      category: 'Security',
      validUntil: '2029-01-01T00:00:00Z',
    });

    // Attempt retrieval by competitor tenant
    expect(() => {
      service.getEvidence(ev.id, 'tenant-competitor-corp');
    }).toThrowError(/Cross-tenant access denied/);
  });

  it('detects expired documents and strictly prevents marking expired documents as verified', () => {
    const expiredEv = service.createEvidence({
      organizationId: 'tenant-omega',
      userId: 'user-omega-1',
      title: 'Expired ISO 9001 Certificate',
      category: 'Certification',
      validUntil: '2023-01-01T00:00:00Z', // In the past
    });

    expect(expiredEv.verification_status).toBe('expired');

    // Attempting to verify an expired document must throw compliance error
    expect(() => {
      service.verifyEvidence(expiredEv.id, 'tenant-omega', 'user-omega-1', true);
    }).toThrowError(/Cannot verify an expired evidence document/);

    expect(() => {
      service.updateEvidence(expiredEv.id, 'tenant-omega', { verificationStatus: 'verified' });
    }).toThrowError(/An expired certificate or evidence document cannot be marked as verified/);
  });

  it('records human verification and rejection with reason', () => {
    const ev = service.createEvidence({
      organizationId: 'tenant-omega',
      userId: 'user-omega-1',
      title: 'Subcontractor Quality Manual',
      category: 'Quality',
      validUntil: '2027-01-01T00:00:00Z',
    });

    const rejected = service.verifyEvidence(
      ev.id,
      'tenant-omega',
      'auditor-1',
      false,
      'Document missing ISO section 8 operational controls.'
    );

    expect(rejected.verification_status).toBe('rejected');
    expect(rejected.rejection_reason).toContain('Document missing ISO section 8');
    expect(rejected.verified_by_user_id).toBe('auditor-1');
  });
});

describe('Requirement-to-Evidence Matching Engine Tests', () => {
  const evidenceService = new EvidenceService();
  const matchingEngine = new RequirementMatchingEngine(evidenceService);

  const orgId = 'org-1';

  it('matches requirement when active verified evidence exists with high confidence', () => {
    const req: Requirement = {
      id: 'req-test-fedramp',
      organization_id: orgId,
      opportunity_id: 'opp-1',
      type: 'mandatory',
      category: 'Cybersecurity',
      title: 'Demonstrated FedRAMP High Authorization',
      description: 'Offerors shall provide proof of active FedRAMP High ATO issued by agency sponsor.',
      source_reference: {
        page_number: 12,
        section_title: 'Section C.4 - Cloud Security Thresholds',
        snippet: 'Active FedRAMP High Authorization is required.',
        raw_quote: 'Offerors must furnish active proof of FedRAMP High Authorization.',
      },
      confidence_score: 0.99,
      manual_review_required: false,
      created_at: new Date().toISOString(),
    };

    const match = matchingEngine.matchRequirement(req, orgId);

    expect(match.match_outcome).toBe('MATCHED');
    expect(match.evidence_id).toBe('ev-fedramp-high');
    expect(match.match_explanation).toContain('Compliant evidence found');
    expect(match.confidence_score).toBeGreaterThanOrEqual(0.85);
    expect(match.human_review_required).toBe(false);
  });

  it('flags EXPIRED_EVIDENCE when matching document is found but past its validity date', () => {
    const req: Requirement = {
      id: 'req-test-insurance',
      organization_id: orgId,
      opportunity_id: 'opp-1',
      type: 'mandatory',
      category: 'Insurance',
      title: 'Commercial General Liability Policy ($5M Coverage)',
      description: 'Vendor must hold valid $5M commercial liability policy.',
      source_reference: {
        page_number: 25,
        section_title: 'Section G - Insurance',
        snippet: '$5M policy required.',
        raw_quote: 'Commercial general liability minimum $5,000,000 required.',
      },
      confidence_score: 0.95,
      manual_review_required: false,
      created_at: new Date().toISOString(),
    };

    const match = matchingEngine.matchRequirement(req, orgId);

    expect(match.match_outcome).toBe('EXPIRED_EVIDENCE');
    expect(match.evidence_id).toBe('ev-insurance-expired');
    expect(match.match_explanation).toContain('Critical Compliance Alert');
    expect(match.missing_information).toContain('Renewed or active certificate required');
    expect(match.human_review_required).toBe(true);
  });

  it('flags MISSING_EVIDENCE when no documentation exists in the organization library', () => {
    const req: Requirement = {
      id: 'req-test-missing-maritime',
      organization_id: orgId,
      opportunity_id: 'opp-1',
      type: 'mandatory',
      category: 'Maritime Operations',
      title: 'Deepwater ROV Submersible Pilot License',
      description: 'Key crew must hold active commercial submarine deep-dive certifications.',
      source_reference: {
        page_number: 40,
        section_title: 'Personnel',
        snippet: 'Submersible pilot license required.',
        raw_quote: 'ROV operators must present deepwater pilot credentials.',
      },
      confidence_score: 0.98,
      manual_review_required: false,
      created_at: new Date().toISOString(),
    };

    const match = matchingEngine.matchRequirement(req, orgId);

    expect(match.match_outcome).toBe('MISSING_EVIDENCE');
    expect(match.evidence_id).toBeNull();
    expect(match.match_explanation).toContain('No supporting documentation found in organization library');
    expect(match.missing_information).toContain('Missing required evidence');
  });

  it('strictly blocks cross-tenant matching attempts', () => {
    const foreignReq: Requirement = {
      id: 'req-foreign',
      organization_id: 'tenant-foreign-hacker',
      opportunity_id: 'opp-foreign',
      type: 'mandatory',
      category: 'Cyber',
      title: 'Secret DoD Clearance',
      description: 'Test',
      source_reference: { snippet: 'test', raw_quote: 'test' },
      confidence_score: 1.0,
      manual_review_required: false,
      created_at: new Date().toISOString(),
    };

    expect(() => {
      matchingEngine.matchRequirement(foreignReq, 'org-1');
    }).toThrowError(/Cross-tenant violation/);
  });
});
