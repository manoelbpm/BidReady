import { Evidence, EvidenceVerificationStatus } from '@/types/models';
import { generateTenantStoragePath } from '@/lib/documents/validation';
import { EvidenceRepository } from '@/lib/supabase/repositories/evidence-repository';

export interface CreateEvidenceParams {
  organizationId: string;
  title: string;
  category: string;
  description?: string;
  issuingOrganization?: string;
  issueDate?: string;
  validUntil?: string;
  fileName?: string;
  fileBuffer?: Buffer;
  tags?: string[];
  userId: string;
}

export interface UpdateEvidenceParams {
  title?: string;
  category?: string;
  description?: string;
  issuingOrganization?: string;
  issueDate?: string;
  validUntil?: string;
  tags?: string[];
  verificationStatus?: EvidenceVerificationStatus;
  rejectionReason?: string;
}

// In-memory tenant-isolated evidence repository with seeded realistic enterprise artifacts
const evidenceStore = new Map<string, Evidence>();

// Seed default initial verified enterprise artifacts for tenant "org-1"
function seedInitialEvidence() {
  if (evidenceStore.size > 0) return;

  const defaultEvidences: Evidence[] = [
    {
      id: 'ev-fedramp-high',
      organization_id: 'org-1',
      title: 'FedRAMP High Authorization Package (ATO Letter)',
      category: 'Cybersecurity',
      description: 'Formal Agency Authority to Operate (ATO) certification for Federal Information Security.',
      issuing_organization: 'Federal Risk and Authorization Management Program (FedRAMP)',
      issue_date: '2024-08-15T00:00:00Z',
      valid_until: '2027-08-15T00:00:00Z',
      file_name: 'FedRAMP_High_ATO_Letter_2025.pdf',
      file_storage_path: 'org-1/user-1/ev-fedramp-high/FedRAMP_High_ATO_Letter_2025.pdf',
      verification_status: 'verified',
      verified_by_user_id: 'user-1',
      verified_at: '2025-01-10T10:00:00Z',
      tags: ['FedRAMP', 'ATO', 'NIST SP 800-53', 'Security', 'DoD IL5'],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'ev-iso-27001',
      organization_id: 'org-1',
      title: 'ISO/IEC 27001:2022 Information Security Management System',
      category: 'Certification',
      description: 'Global audit certificate verifying comprehensive ISMS policies, physical and cloud controls.',
      issuing_organization: 'BSI Assurance Services',
      issue_date: '2023-04-10T00:00:00Z',
      valid_until: '2026-04-10T00:00:00Z',
      file_name: 'ISO_27001_Audit_Certificate.pdf',
      file_storage_path: 'org-1/user-1/ev-iso-27001/ISO_27001_Audit_Certificate.pdf',
      verification_status: 'verified',
      verified_by_user_id: 'user-1',
      verified_at: '2025-01-10T10:00:00Z',
      tags: ['ISO 27001', 'ISMS', 'Global Compliance', 'InfoSec'],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'ev-cpars-radar',
      organization_id: 'org-1',
      title: 'DoD CPARS Past Performance Evaluation - Radar Integration',
      category: 'Past Performance',
      description: 'Official US Government Contractor Performance Assessment Report with Exceptional ratings.',
      issuing_organization: 'US Naval Air Systems Command (NAVAIR)',
      issue_date: '2024-05-20T00:00:00Z',
      valid_until: '2028-12-31T00:00:00Z',
      file_name: 'CPARS_Radar_Integration_Rating_2024.pdf',
      file_storage_path: 'org-1/user-1/ev-cpars-radar/CPARS_Radar_Integration_Rating_2024.pdf',
      verification_status: 'verified',
      verified_by_user_id: 'user-1',
      verified_at: '2025-01-10T10:00:00Z',
      tags: ['CPARS', 'DoD', 'Radar', 'Past Performance', 'Telemetry'],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'ev-insurance-expired',
      organization_id: 'org-1',
      title: 'Commercial General Liability Policy ($5M Coverage)',
      category: 'Insurance',
      description: 'Commercial liability certificate naming municipal and federal entities as additional insured.',
      issuing_organization: 'Hartford Commercial Underwriters',
      issue_date: '2023-01-01T00:00:00Z',
      valid_until: '2024-01-01T00:00:00Z', // Deliberately expired for testing matching engine
      file_name: 'Commercial_Liability_Policy_2023.pdf',
      file_storage_path: 'org-1/user-1/ev-insurance-expired/Commercial_Liability_Policy_2023.pdf',
      verification_status: 'expired',
      verified_by_user_id: 'user-1',
      verified_at: '2024-01-02T00:00:00Z',
      tags: ['Insurance', 'Liability', 'Commercial'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'ev-quality-manual',
      organization_id: 'org-1',
      title: 'Subcontractor Quality Assurance Manual (QAM-2026)',
      category: 'Compliance',
      description: 'Internal quality assurance protocols for software engineering and radar telemetry pipelines.',
      issuing_organization: 'Corporate Quality Governance Office',
      issue_date: '2026-02-01T00:00:00Z',
      valid_until: '2028-02-01T00:00:00Z',
      file_name: 'Subcontractor_QAM_2026.pdf',
      file_storage_path: 'org-1/user-1/ev-quality-manual/Subcontractor_QAM_2026.pdf',
      verification_status: 'pending_verification', // Demonstrates pending human review
      verified_by_user_id: null,
      verified_at: null,
      tags: ['Quality', 'QA', 'Manual', 'Compliance'],
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    },
    {
      id: 'ev-self-attested',
      organization_id: 'org-1',
      title: 'Self-Attested Software Security Checklist',
      category: 'Cybersecurity',
      description: 'Internal vendor self-attestation checklist for software bill of materials (SBOM).',
      issuing_organization: 'Internal Development Team',
      issue_date: '2025-06-01T00:00:00Z',
      valid_until: '2027-06-01T00:00:00Z',
      file_name: 'Self_Attested_Security_2025.pdf',
      file_storage_path: 'org-1/user-1/ev-self-attested/Self_Attested_Security_2025.pdf',
      verification_status: 'rejected', // Demonstrates rejected evidence
      verified_by_user_id: 'user-1',
      verified_at: '2025-06-15T00:00:00Z',
      rejection_reason: 'Self-attestation statement rejected: Tender explicitly requires independent third-party audit.',
      tags: ['Security', 'SBOM', 'Self-Attestation'],
      created_at: '2025-06-01T00:00:00Z',
      updated_at: '2025-06-15T00:00:00Z',
    },
  ];

  for (const ev of defaultEvidences) {
    evidenceStore.set(ev.id, ev);
  }
}

seedInitialEvidence();

export class EvidenceService {
  private repository?: EvidenceRepository;

  constructor(repository?: EvidenceRepository) {
    this.repository = repository;
  }

  /**
   * Checks whether a date has expired relative to current time.
   */
  static isExpired(dateString?: string | null): boolean {
    if (!dateString) return false;
    const expiry = new Date(dateString).getTime();
    return !isNaN(expiry) && expiry < Date.now();
  }

  /**
   * Creates and registers a new verified or pending evidence record.
   */
  createEvidence(params: CreateEvidenceParams): Evidence {
    const {
      organizationId,
      title,
      category,
      description,
      issuingOrganization,
      issueDate,
      validUntil,
      fileName,
      tags = [],
      userId,
    } = params;

    if (!organizationId || !title || !category) {
      throw new Error('Validation Error: organizationId, title, and category are required.');
    }

    const id = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const storagePath = fileName
      ? generateTenantStoragePath(organizationId, userId, id, fileName)
      : undefined;

    const isExpired = EvidenceService.isExpired(validUntil);
    const initialStatus: EvidenceVerificationStatus = isExpired
      ? 'expired'
      : 'pending_verification';

    const evidence: Evidence = {
      id,
      organization_id: organizationId,
      title,
      category,
      description: description || null,
      issuing_organization: issuingOrganization || null,
      issue_date: issueDate || null,
      valid_until: validUntil || null,
      file_name: fileName || null,
      file_storage_path: storagePath || null,
      verification_status: initialStatus,
      verified_by_user_id: null,
      verified_at: null,
      rejection_reason: null,
      tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    evidenceStore.set(id, evidence);
    return evidence;
  }

  /**
   * Retrieves an evidence record with strict multi-tenant boundary guard.
   */
  getEvidence(evidenceId: string, organizationId: string): Evidence | null {
    const ev = evidenceStore.get(evidenceId);
    if (!ev) return null;

    if (ev.organization_id !== organizationId) {
      throw new Error(
        `Security Violation: Cross-tenant access denied. Evidence "${evidenceId}" does not belong to organization "${organizationId}".`
      );
    }

    // Dynamic auto-expiration check
    if (ev.valid_until && EvidenceService.isExpired(ev.valid_until) && ev.verification_status !== 'expired') {
      ev.verification_status = 'expired';
      ev.updated_at = new Date().toISOString();
      evidenceStore.set(evidenceId, ev);
    }

    return ev;
  }

  /**
   * Lists all evidence artifacts strictly scoped to requesting organization.
   */
  listEvidence(
    organizationId: string,
    filters?: {
      category?: string;
      status?: EvidenceVerificationStatus;
      search?: string;
    }
  ): Evidence[] {
    seedInitialEvidence();
    const results: Evidence[] = [];

    for (const ev of evidenceStore.values()) {
      if (ev.organization_id === organizationId) {
        // Auto-check expiry
        if (ev.valid_until && EvidenceService.isExpired(ev.valid_until) && ev.verification_status !== 'expired') {
          ev.verification_status = 'expired';
          ev.updated_at = new Date().toISOString();
        }

        if (filters?.category && ev.category.toLowerCase() !== filters.category.toLowerCase()) {
          continue;
        }

        if (filters?.status && ev.verification_status !== filters.status) {
          continue;
        }

        if (filters?.search) {
          const query = filters.search.toLowerCase();
          const matches =
            ev.title.toLowerCase().includes(query) ||
            ev.description?.toLowerCase().includes(query) ||
            ev.tags.some((t) => t.toLowerCase().includes(query)) ||
            ev.issuing_organization?.toLowerCase().includes(query);

          if (!matches) continue;
        }

        results.push(ev);
      }
    }

    return results.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  }

  /**
   * Updates an evidence record, verifying tenant boundary and re-checking validity.
   */
  updateEvidence(
    evidenceId: string,
    organizationId: string,
    params: UpdateEvidenceParams
  ): Evidence {
    const ev = this.getEvidence(evidenceId, organizationId);
    if (!ev) {
      throw new Error(`Evidence "${evidenceId}" not found in organization "${organizationId}".`);
    }

    if (params.title !== undefined) ev.title = params.title;
    if (params.category !== undefined) ev.category = params.category;
    if (params.description !== undefined) ev.description = params.description;
    if (params.issuingOrganization !== undefined) ev.issuing_organization = params.issuingOrganization;
    if (params.issueDate !== undefined) ev.issue_date = params.issueDate;
    if (params.validUntil !== undefined) {
      ev.valid_until = params.validUntil;
      if (EvidenceService.isExpired(params.validUntil)) {
        ev.verification_status = 'expired';
      }
    }
    if (params.tags !== undefined) ev.tags = params.tags;
    if (params.verificationStatus !== undefined) {
      // Never allow marking an expired document as verified!
      if (params.verificationStatus === 'verified' && EvidenceService.isExpired(ev.valid_until)) {
        throw new Error('Compliance Violation: An expired certificate or evidence document cannot be marked as verified.');
      }
      ev.verification_status = params.verificationStatus;
    }
    if (params.rejectionReason !== undefined) ev.rejection_reason = params.rejectionReason;

    ev.updated_at = new Date().toISOString();
    evidenceStore.set(evidenceId, ev);
    return ev;
  }

  /**
   * Records human verification of an evidence artifact.
   */
  verifyEvidence(
    evidenceId: string,
    organizationId: string,
    verifiedByUserId: string,
    approved: boolean,
    rejectionReason?: string
  ): Evidence {
    const ev = this.getEvidence(evidenceId, organizationId);
    if (!ev) {
      throw new Error(`Evidence "${evidenceId}" not found.`);
    }

    if (approved) {
      if (EvidenceService.isExpired(ev.valid_until)) {
        throw new Error('Integrity Error: Cannot verify an expired evidence document.');
      }
      ev.verification_status = 'verified';
      ev.verified_by_user_id = verifiedByUserId;
      ev.verified_at = new Date().toISOString();
      ev.rejection_reason = null;
    } else {
      ev.verification_status = 'rejected';
      ev.rejection_reason = rejectionReason || 'Rejected by human reviewer.';
      ev.verified_by_user_id = verifiedByUserId;
      ev.verified_at = new Date().toISOString();
    }

    ev.updated_at = new Date().toISOString();
    evidenceStore.set(evidenceId, ev);
    return ev;
  }

  /**
   * Deletes evidence record and marks storage for deletion with tenant protection.
   */
  deleteEvidence(evidenceId: string, organizationId: string): boolean {
    const ev = this.getEvidence(evidenceId, organizationId);
    if (!ev) return false;

    evidenceStore.delete(evidenceId);
    return true;
  }

  // --- Real Supabase PostgreSQL Async Repositories ---

  async listEvidenceAsync(
    organizationId: string,
    filters?: { category?: string; status?: EvidenceVerificationStatus }
  ): Promise<Evidence[]> {
    if (this.repository) {
      return this.repository.listEvidence(organizationId, filters);
    }
    return this.listEvidence(organizationId, filters);
  }

  async getEvidenceAsync(evidenceId: string, organizationId: string): Promise<Evidence | null> {
    if (this.repository) {
      const ev = await this.repository.getEvidence(evidenceId);
      if (ev && ev.organization_id !== organizationId) {
        throw new Error(
          `Security Violation: Cross-tenant access denied. Evidence "${evidenceId}" does not belong to organization "${organizationId}".`
        );
      }
      return ev;
    }
    return this.getEvidence(evidenceId, organizationId);
  }

  async createEvidenceAsync(params: CreateEvidenceParams): Promise<Evidence> {
    if (this.repository) {
      const isExpired = EvidenceService.isExpired(params.validUntil);
      const initialStatus: EvidenceVerificationStatus = isExpired
        ? 'expired'
        : 'pending_verification';

      const storagePath = params.fileName
        ? generateTenantStoragePath(params.organizationId, params.userId, `ev-${Date.now()}`, params.fileName)
        : null;

      return this.repository.createEvidence({
        organization_id: params.organizationId,
        title: params.title,
        category: params.category,
        description: params.description || null,
        issuing_organization: params.issuingOrganization || null,
        issue_date: params.issueDate || null,
        valid_until: params.validUntil || null,
        file_name: params.fileName || null,
        file_storage_path: storagePath,
        verification_status: initialStatus,
        tags: params.tags || [],
      });
    }
    return this.createEvidence(params);
  }

  async verifyEvidenceAsync(
    evidenceId: string,
    organizationId: string,
    verifiedByUserId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<Evidence> {
    if (this.repository) {
      const ev = await this.getEvidenceAsync(evidenceId, organizationId);
      if (!ev) {
        throw new Error(`Evidence "${evidenceId}" not found.`);
      }
      if (approved && EvidenceService.isExpired(ev.valid_until)) {
        throw new Error('Integrity Error: Cannot verify an expired evidence document.');
      }
      return this.repository.verifyEvidence(evidenceId, verifiedByUserId, approved, rejectionReason);
    }
    return this.verifyEvidence(evidenceId, organizationId, verifiedByUserId, approved, rejectionReason);
  }

  async deleteEvidenceAsync(evidenceId: string, organizationId: string): Promise<boolean> {
    if (this.repository) {
      const ev = await this.getEvidenceAsync(evidenceId, organizationId);
      if (!ev) return false;
      await this.repository.deleteEvidence(evidenceId);
      return true;
    }
    return this.deleteEvidence(evidenceId, organizationId);
  }
}
