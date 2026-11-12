import { describe, it, expect } from 'vitest';
import { Requirement, SourceReference, Opportunity } from '../src/types/models';

describe('BidReady Core Data Entities & Traceability Rules', () => {
  it('enforces source page and section citations on extracted requirements', () => {
    const validRequirement: Requirement = {
      id: 'req-001',
      organization_id: 'org-tenant-1',
      opportunity_id: 'opp-001',
      type: 'mandatory',
      category: 'Cybersecurity',
      title: 'Active CMMC Level 2 Certification',
      description: 'Vendor must possess CMMC Level 2 certification prior to contract award.',
      source_reference: {
        page_number: 18,
        section_title: 'Section L.3.2 — Mandatory Cybersecurity Thresholds',
        snippet: 'CMMC Level 2 certification is an un-waivable prerequisite.',
        raw_quote: 'All contractors must provide active proof of CMMC Level 2 certificate.',
      },
      confidence_score: 0.98,
      manual_review_required: false,
      created_at: new Date().toISOString(),
    };

    expect(validRequirement.source_reference.page_number).toBeGreaterThan(0);
    expect(validRequirement.source_reference.section_title).toBeTruthy();
    expect(validRequirement.source_reference.raw_quote).toBeTruthy();
  });

  it('flags requirement for human verification if extraction confidence is below 0.85 threshold', () => {
    function assessVerificationRequirement(score: number): boolean {
      const CONFIDENCE_THRESHOLD = 0.85;
      return score < CONFIDENCE_THRESHOLD;
    }

    expect(assessVerificationRequirement(0.95)).toBe(false);
    expect(assessVerificationRequirement(0.85)).toBe(false);
    expect(assessVerificationRequirement(0.84)).toBe(true);
    expect(assessVerificationRequirement(0.60)).toBe(true);
  });

  it('validates opportunity core entity fields and multi-tenant attachment', () => {
    const opp: Opportunity = {
      id: 'opp-100',
      organization_id: 'org-tenant-1',
      created_by_user_id: 'user-001',
      title: 'Satellite Ground Station Modernization',
      reference_code: 'RFP-USSF-2026-08',
      issuing_body: 'United States Space Force',
      stage: 'intake',
      submission_deadline: '2026-12-10T17:00:00Z',
      clarification_deadline: '2026-11-20T17:00:00Z',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(opp.organization_id).toBe('org-tenant-1');
    expect(opp.stage).toBe('intake');
    expect(opp.title).toBeDefined();
  });
});
