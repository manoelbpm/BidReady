import {
  Requirement,
  Evidence,
  RequirementEvidenceMatch,
  MatchOutcome,
} from '@/types/models';
import { EvidenceService } from '@/lib/evidence/service';

export interface MatchingOptions {
  confidenceThreshold?: number; // Default 0.80
  strictDateEnforcement?: boolean; // Default true
}

export class RequirementMatchingEngine {
  private evidenceService: EvidenceService;

  constructor(evidenceService?: EvidenceService) {
    this.evidenceService = evidenceService || new EvidenceService();
  }

  /**
   * Matches a single extracted requirement against an organization's verified evidence library.
   */
  matchRequirement(
    requirement: Requirement,
    organizationId: string,
    options?: MatchingOptions
  ): RequirementEvidenceMatch {
    const availableEvidence = this.evidenceService.listEvidence(organizationId);
    return this.matchRequirementWithEvidence(requirement, availableEvidence, organizationId, options);
  }

  /**
   * Matches a single extracted requirement against a provided list of evidence items.
   * Strictly enforces:
   * - Tenant isolation (throws on cross-tenant evidence)
   * - Expired evidence is NEVER valid (EXPIRED_EVIDENCE status)
   * - Semantic similarity alone does not guarantee compliance
   * - Mandatory requirements without evidence are highlighted with high severity
   */
  matchRequirementWithEvidence(
    requirement: Requirement,
    availableEvidence: Evidence[],
    organizationId: string,
    options?: MatchingOptions
  ): RequirementEvidenceMatch {
    if (requirement.organization_id !== organizationId) {
      throw new Error(
        `Cross-tenant violation: Requirement organization "${requirement.organization_id}" does not match requested tenant "${organizationId}".`
      );
    }

    const threshold = options?.confidenceThreshold || 0.80;
    let bestCandidate: Evidence | null = null;
    let highestScore = 0;
    let partialCandidate: Evidence | null = null;
    let partialScore = 0;
    let expiredCandidate: Evidence | null = null;
    let expiredScore = 0;

    for (const ev of availableEvidence) {
      // Security Check: Verify organization isolation
      if (ev.organization_id !== organizationId) {
        throw new Error('Tenant Boundary Breach: Foreign organization evidence detected.');
      }

      // Calculate rule-based criteria overlap
      const score = this.calculateEvidenceScore(requirement, ev);

      // Check if candidate matches topic
      if (score >= 0.40) {
        // Rule: Expired document cannot be accepted as valid evidence
        const isExpired = ev.verification_status === 'expired' || EvidenceService.isExpired(ev.valid_until);

        if (isExpired) {
          if (!expiredCandidate || score > expiredScore) {
            expiredCandidate = ev;
            expiredScore = score;
          }
          continue;
        }

        if (score >= threshold) {
          if (score > highestScore) {
            highestScore = score;
            bestCandidate = ev;
          }
        } else if (score >= 0.40) {
          if (!partialCandidate || score > partialScore) {
            partialCandidate = ev;
            partialScore = score;
          }
        }
      }
    }

    const id = `match-${requirement.id}-${Date.now()}`;

    // 1. SCENARIO: Valid, Active Best Candidate MATCHED
    if (bestCandidate && highestScore >= threshold) {
      const isPendingHuman = bestCandidate.verification_status !== 'verified';

      return {
        id,
        organization_id: organizationId,
        opportunity_id: requirement.opportunity_id,
        requirement_id: requirement.id,
        evidence_id: bestCandidate.id,
        match_outcome: isPendingHuman ? 'REQUIRES_REVIEW' : 'MATCHED',
        confidence_score: Number(highestScore.toFixed(2)),
        match_explanation: `Compliant evidence found: "${bestCandidate.title}" issued by ${bestCandidate.issuing_organization || 'Authorized Body'}. Valid through ${bestCandidate.valid_until || 'indefinite'}. Covers the required ${requirement.category} specifications.`,
        missing_information: null,
        human_review_required: isPendingHuman,
        human_review_notes: isPendingHuman
          ? 'Evidence document is awaiting initial human compliance verification.'
          : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        requirement,
        evidence: bestCandidate,
      };
    }

    // 2. SCENARIO: Expired Evidence Found
    if (expiredCandidate && expiredScore >= 0.40) {
      return {
        id,
        organization_id: organizationId,
        opportunity_id: requirement.opportunity_id,
        requirement_id: requirement.id,
        evidence_id: expiredCandidate.id,
        match_outcome: 'EXPIRED_EVIDENCE',
        confidence_score: Number(Math.max(0.85, expiredScore).toFixed(2)),
        match_explanation: `Critical Compliance Alert: Document "${expiredCandidate.title}" matches the criteria for "${requirement.title}", but expired on ${expiredCandidate.valid_until}. An expired document cannot be submitted as valid proof.`,
        missing_information: `Renewed or active certificate required replacing expired ${expiredCandidate.title} (expired ${expiredCandidate.valid_until}).`,
        human_review_required: true,
        human_review_notes: 'Urgent renewal required before tender submission deadline.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        requirement,
        evidence: expiredCandidate,
      };
    }

    // 3. SCENARIO: Partial Match Found
    if (partialCandidate) {
      return {
        id,
        organization_id: organizationId,
        opportunity_id: requirement.opportunity_id,
        requirement_id: requirement.id,
        evidence_id: partialCandidate.id,
        match_outcome: 'PARTIALLY_MATCHED',
        confidence_score: Number(partialScore.toFixed(2)),
        match_explanation: `Partial coverage: "${partialCandidate.title}" addresses related domain aspects of "${requirement.title}", but additional evidence or technical narratives are required to prove complete compliance.`,
        missing_information: `Supplemental qualification artifact required to substantiate specific clause: "${requirement.description.substring(0, 100)}..."`,
        human_review_required: true,
        human_review_notes: 'Human review required to verify whether existing past performance narrative fully satisfies the buyer specification.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        requirement,
        evidence: partialCandidate,
      };
    }

    // 4. SCENARIO: Completely Missing Evidence
    return {
      id,
      organization_id: organizationId,
      opportunity_id: requirement.opportunity_id,
      requirement_id: requirement.id,
      evidence_id: null,
      match_outcome: 'MISSING_EVIDENCE',
      confidence_score: 1.0, // High confidence that evidence is completely missing
      match_explanation: `No supporting documentation found in organization library for requirement "${requirement.title}" (${requirement.category}).`,
      missing_information: `Missing required evidence for ${requirement.category}: ${requirement.title}. Action required to acquire, draft, or partner for this capability.`,
      human_review_required: requirement.type === 'mandatory',
      human_review_notes: requirement.type === 'mandatory'
        ? 'Mandatory qualification gap: tender cannot be responsibly submitted without obtaining this evidence.'
        : 'Desirable qualification gap: proposal will lose trade-off scoring points if evidence is not provided.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requirement,
    };
  }

  /**
   * Matches all requirements of an opportunity against the organization's library.
   */
  matchAllOpportunityRequirements(
    requirements: Requirement[],
    organizationId: string
  ): RequirementEvidenceMatch[] {
    return requirements.map((req) => this.matchRequirement(req, organizationId));
  }

  /**
   * Matches all requirements of an opportunity against a provided list of evidence items.
   */
  matchAllOpportunityRequirementsWithEvidence(
    requirements: Requirement[],
    availableEvidence: Evidence[],
    organizationId: string,
    options?: MatchingOptions
  ): RequirementEvidenceMatch[] {
    return requirements.map((req) =>
      this.matchRequirementWithEvidence(req, availableEvidence, organizationId, options)
    );
  }

  /**
   * Deterministic matching heuristic based on keyword, category, tag overlap and semantic boundaries.
   * Ensures similarity alone never guarantees compliance without category and keyword alignment.
   */
  private calculateEvidenceScore(requirement: Requirement, evidence: Evidence): number {
    let score = 0;

    const reqTitle = requirement.title.toLowerCase();
    const reqDesc = requirement.description.toLowerCase();
    const reqCat = requirement.category.toLowerCase().trim();

    const evTitle = evidence.title.toLowerCase();
    const evDesc = (evidence.description || '').toLowerCase();
    const evCat = evidence.category.toLowerCase().trim();
    const evTags = (evidence.tags || []).map((t) => t.toLowerCase().trim());

    // Exact Category Match
    if (reqCat && evCat && reqCat === evCat) {
      score += 0.25;
    }

    // Tag matches against requirement title & description
    let tagMatches = 0;
    for (const tag of evTags) {
      if (tag.length > 2 && (reqTitle.includes(tag) || reqDesc.includes(tag))) {
        tagMatches++;
      }
    }
    if (tagMatches > 0) {
      score += Math.min(0.40, tagMatches * 0.15);
    }

    // Direct domain-specific keyword phrases
    const keyTerms = [
      'fedramp',
      'iso 27001',
      'soc 2',
      'cpars',
      'insurance',
      'radar',
      'telemetry',
      'cmmc',
      'liability',
      'iso 9001',
      'avionics',
    ];
    for (const term of keyTerms) {
      if ((reqTitle.includes(term) || reqDesc.includes(term)) && (evTitle.includes(term) || evDesc.includes(term))) {
        score += 0.35;
      }
    }

    // Stopwords filter for general title word correlation (domain-generic nouns omitted)
    const stopWords = new Set([
      'shall', 'offerors', 'provide', 'active', 'proof', 'vendor', 'with', 'must', 'from',
      'that', 'this', 'security', 'system', 'general', 'standard', 'report', 'document',
      'clause', 'level', 'manual', 'proposals', 'bidders', 'requirements', 'contractor',
    ]);
    const titleWords = reqTitle
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    let wordMatches = 0;
    for (const w of titleWords) {
      if (evTitle.includes(w) || evDesc.includes(w) || evTags.some((t) => t.includes(w))) {
        wordMatches++;
      }
    }
    if (wordMatches > 0) {
      score += Math.min(0.20, wordMatches * 0.08);
    }

    return Math.min(1.0, score);
  }
}
