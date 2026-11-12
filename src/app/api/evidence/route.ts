import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/api-auth';

export async function GET(request: NextRequest) {
  try {
    const { evidenceRepo, organizationId } = await getRequestContext(request);

    if (evidenceRepo) {
      const evidences = await evidenceRepo.listEvidence(organizationId);
      return NextResponse.json({
        success: true,
        organizationId,
        evidences,
      });
    }

    return NextResponse.json({
      success: true,
      organizationId,
      evidences: [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list evidences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { evidenceRepo, organizationId, userId } = await getRequestContext(request);
    const body = await request.json();

    if (!evidenceRepo) {
      return NextResponse.json(
        { success: false, error: 'Database repository unavailable' },
        { status: 500 }
      );
    }

    // Support seeding standard organizational evidence library
    if (body.action === 'seed') {
      const existing = await evidenceRepo.listEvidence(organizationId);
      if (existing.length === 0) {
        const seedItems = [
          {
            organization_id: organizationId,
            title: 'FedRAMP High Authorization Package (ATO Letter)',
            category: 'Cybersecurity',
            description: 'Formal Agency Authority to Operate (ATO) certification for Federal Information Security.',
            issuing_organization: 'Federal Risk and Authorization Management Program (FedRAMP)',
            issue_date: '2024-08-15T00:00:00Z',
            valid_until: '2027-08-15T00:00:00Z',
            file_name: 'FedRAMP_High_ATO_Letter_2025.pdf',
            verification_status: 'verified' as const,
            tags: ['FedRAMP', 'ATO', 'NIST SP 800-53', 'Security', 'DoD IL5'],
          },
          {
            organization_id: organizationId,
            title: 'ISO/IEC 27001:2022 Information Security Management System',
            category: 'Certification',
            description: 'Global audit certificate verifying comprehensive ISMS policies, physical and cloud controls.',
            issuing_organization: 'BSI Assurance Services',
            issue_date: '2023-04-10T00:00:00Z',
            valid_until: '2026-04-10T00:00:00Z',
            file_name: 'ISO_27001_Audit_Certificate.pdf',
            verification_status: 'verified' as const,
            tags: ['ISO 27001', 'ISMS', 'Global Compliance', 'InfoSec'],
          },
          {
            organization_id: organizationId,
            title: 'DoD CPARS Past Performance Evaluation - Radar Integration',
            category: 'Past Performance',
            description: 'Official US Government Contractor Performance Assessment Report with Exceptional ratings.',
            issuing_organization: 'US Naval Air Systems Command (NAVAIR)',
            issue_date: '2024-05-20T00:00:00Z',
            valid_until: '2028-12-31T00:00:00Z',
            file_name: 'CPARS_Radar_Integration_Rating_2024.pdf',
            verification_status: 'verified' as const,
            tags: ['CPARS', 'DoD', 'Radar', 'Past Performance', 'Telemetry'],
          },
          {
            organization_id: organizationId,
            title: 'Commercial General Liability Policy ($5M Coverage)',
            category: 'Insurance',
            description: 'Commercial liability certificate naming municipal and federal entities as additional insured.',
            issuing_organization: 'Hartford Commercial Underwriters',
            issue_date: '2023-01-01T00:00:00Z',
            valid_until: '2024-01-01T00:00:00Z', // Deliberately expired
            file_name: 'Commercial_Liability_Policy_2023.pdf',
            verification_status: 'expired' as const,
            tags: ['Insurance', 'Liability', 'Commercial'],
          },
          {
            organization_id: organizationId,
            title: 'Subcontractor Quality Assurance Manual (QAM-2026)',
            category: 'Compliance',
            description: 'Internal quality assurance protocols for software engineering and radar telemetry pipelines.',
            issuing_organization: 'Corporate Quality Governance Office',
            issue_date: '2026-02-01T00:00:00Z',
            valid_until: '2028-02-01T00:00:00Z',
            file_name: 'Subcontractor_QAM_2026.pdf',
            verification_status: 'pending_verification' as const,
            tags: ['Quality', 'QA', 'Manual', 'Compliance'],
          },
        ];

        const inserted = [];
        for (const item of seedItems) {
          const res = await evidenceRepo.createEvidence(item);
          inserted.push(res);
        }

        return NextResponse.json({
          success: true,
          seeded: true,
          count: inserted.length,
          evidences: inserted,
        });
      }

      return NextResponse.json({
        success: true,
        seeded: false,
        message: 'Evidence library already populated',
        count: existing.length,
        evidences: existing,
      });
    }

    const created = await evidenceRepo.createEvidence({
      organization_id: organizationId,
      title: body.title,
      category: body.category,
      description: body.description || null,
      issuing_organization: body.issuing_organization || null,
      issue_date: body.issue_date || null,
      valid_until: body.valid_until || null,
      file_name: body.file_name || null,
      verification_status: body.verification_status || 'pending_verification',
      tags: body.tags || [],
    });

    return NextResponse.json({
      success: true,
      evidence: created,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create evidence' },
      { status: 500 }
    );
  }
}
