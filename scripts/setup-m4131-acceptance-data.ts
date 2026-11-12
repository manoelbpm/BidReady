import { createClient } from '@supabase/supabase-js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const org1Id = 'b22937b6-51e5-48a0-a75d-7b3405427298';

async function main() {
  console.log('--- SETTING UP M4.13.1 ISOLATED SYNTHETIC ACCEPTANCE DATA ---');

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await client.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });

  if (auth.error) {
    throw new Error(`Auth failed: ${auth.error.message}`);
  }
  const userId = auth.data.user.id;
  console.log(`Authenticated as Analyst (User: ${userId}, Org: ${org1Id})`);

  // 1. Create or ensure synthetic evidence library
  const evidencesToSeed = [
    {
      organization_id: org1Id,
      title: 'FedRAMP High Authorization Package (ATO Letter)',
      category: 'Cybersecurity',
      description: 'Formal Agency Authority to Operate (ATO) certification for Federal Information Security.',
      issuing_organization: 'Federal Risk and Authorization Management Program (FedRAMP)',
      issue_date: '2024-08-15T00:00:00Z',
      valid_until: '2028-12-31T00:00:00Z',
      file_name: 'FedRAMP_High_ATO_Letter_2025.pdf',
      verification_status: 'verified',
      tags: ['FedRAMP', 'ATO', 'NIST SP 800-53', 'Security', 'DoD IL5'],
    },
    {
      organization_id: org1Id,
      title: 'ISO 9001:2015 Quality Management Certificate',
      category: 'Quality',
      description: 'Accredited corporate quality management certification for software systems development.',
      issuing_organization: 'BSI Global Assurance',
      issue_date: '2024-01-10T00:00:00Z',
      valid_until: '2027-01-10T00:00:00Z',
      file_name: 'ISO_9001_Certificate_2024.pdf',
      verification_status: 'verified',
      tags: ['ISO 9001', 'Quality', 'Management', 'Process'],
    },
    {
      organization_id: org1Id,
      title: 'Legacy Radar Frequency Calibration Whitepaper',
      category: 'Research',
      description: 'Preliminary laboratory measurements of single-band radar signals and telemetry clocking.',
      issuing_organization: 'Radar Research Group',
      issue_date: '2024-03-01T00:00:00Z',
      valid_until: '2027-03-01T00:00:00Z',
      file_name: 'Radar_Calibration_Whitepaper.pdf',
      verification_status: 'verified',
      tags: ['Calibration', 'Telemetry'],
    },
    {
      organization_id: org1Id,
      title: 'Commercial General Liability Policy ($5M Coverage)',
      category: 'Insurance',
      description: 'Commercial liability policy for aviation facility operations.',
      issuing_organization: 'Hartford Commercial Underwriters',
      issue_date: '2022-01-01T00:00:00Z',
      valid_until: '2023-01-01T00:00:00Z', // Expired
      file_name: 'Commercial_Liability_Expired_2023.pdf',
      verification_status: 'expired',
      tags: ['Insurance', 'Liability', 'Commercial'],
    },
    {
      organization_id: org1Id,
      title: 'Software Quality Assurance Manual (QAM-2026 Draft)',
      category: 'Quality',
      description: 'Comprehensive software testing and verification manual awaiting internal audit signoff.',
      issuing_organization: 'Engineering Governance Office',
      issue_date: '2026-02-01T00:00:00Z',
      valid_until: '2028-02-01T00:00:00Z',
      file_name: 'QAM_Software_2026_Draft.pdf',
      verification_status: 'pending_verification',
      tags: ['Quality', 'QA', 'Manual'],
    },
  ];

  console.log('Seeding evidence library for Org 1...');
  for (const item of evidencesToSeed) {
    const { data: existing } = await client
      .from('evidences')
      .select('id')
      .eq('organization_id', org1Id)
      .eq('title', item.title)
      .maybeSingle();

    if (!existing) {
      const { data, error } = await client
        .from('evidences')
        .insert(item)
        .select('id, title')
        .single();
      if (error) console.error(`Failed to insert ${item.title}:`, error.message);
      else console.log(`Created evidence: ${data.title} (${data.id})`);
    } else {
      console.log(`Existing evidence confirmed: ${item.title} (${existing.id})`);
    }
  }

  // 2. Create the dedicated Synthetic Opportunity for M4.13.1
  const oppRef = `RFP-FAA-2026-M4131-${Date.now().toString().slice(-4)}`;
  const { data: opp, error: oppErr } = await client
    .from('opportunities')
    .insert({
      organization_id: org1Id,
      created_by_user_id: userId,
      title: 'FAA NextGen Radar & Airspace Surveillance System',
      description: '[SYNTHETIC ACCEPTANCE TENDER] Modernization of primary and secondary radar transponder processing for civil aviation.',
      reference_code: oppRef,
      issuing_body: 'Federal Aviation Administration (FAA)',
      contact_email: 'contracting@faa.gov',
      estimated_value: 8500000,
      currency: 'USD',
      submission_deadline: '2026-12-30T17:00:00Z',
      stage: 'intake',
      priority: 'high',
    })
    .select('*')
    .single();

  if (oppErr) throw new Error(`Failed to create opportunity: ${oppErr.message}`);
  console.log(`\nCreated Opportunity: "${opp.title}" (ID: ${opp.id}, Ref: ${opp.reference_code})`);

  // 3. Create the 6 Requirements (5 states + false positive gate)
  const requirementsToSeed = [
    // 1. MATCHED Scenario
    {
      organization_id: org1Id,
      opportunity_id: opp.id,
      type: 'mandatory',
      category: 'Cybersecurity',
      title: 'Active FedRAMP High Authorization Proof',
      description: 'Vendor must furnish official ATO proving active FedRAMP High certification for federal operations.',
      source_reference: {
        page_number: 14,
        section_title: 'Section C.4.1 - Cybersecurity Thresholds',
        snippet: 'Active FedRAMP High ATO required.',
        raw_quote: 'Offerors shall furnish active proof of FedRAMP High Authorization issued by an agency sponsor.',
      },
      confidence_score: 0.98,
      manual_review_required: false,
    },
    // 2. PARTIALLY_MATCHED Scenario
    {
      organization_id: org1Id,
      opportunity_id: opp.id,
      type: 'mandatory',
      category: 'Technical',
      title: 'Dual-band Primary and Secondary Radar Telemetry Ingestion',
      description: 'Vendor must demonstrate continuous ingestion across dual-band primary surveillance radar.',
      source_reference: {
        page_number: 22,
        section_title: 'Section D.2 - Telemetry Architecture',
        snippet: 'Dual-band telemetry required.',
        raw_quote: 'System must process dual primary and secondary radar transponders simultaneously.',
      },
      confidence_score: 0.90,
      manual_review_required: false,
    },
    // 3. MISSING_EVIDENCE Scenario
    {
      organization_id: org1Id,
      opportunity_id: opp.id,
      type: 'mandatory',
      category: 'Personnel',
      title: 'DoE Nuclear Facility Security Clearance (Q Clearance)',
      description: 'Field engineers must hold active Department of Energy Q Clearance credentials.',
      source_reference: {
        page_number: 31,
        section_title: 'Personnel Credentials',
        snippet: 'DoE Q Clearance required.',
        raw_quote: 'Contractor personnel assigned to FAA secure radar facilities must hold active Q Clearance.',
      },
      confidence_score: 0.95,
      manual_review_required: true,
    },
    // 4. EXPIRED_EVIDENCE Scenario
    {
      organization_id: org1Id,
      opportunity_id: opp.id,
      type: 'mandatory',
      category: 'Insurance',
      title: 'Commercial General Liability Policy ($5M Coverage)',
      description: 'Contractor must maintain current $5M commercial general liability insurance.',
      source_reference: {
        page_number: 40,
        section_title: 'Section H - Insurance Requirements',
        snippet: '$5M policy required.',
        raw_quote: 'Contractor shall maintain Commercial General Liability with policy limits not less than $5,000,000.',
      },
      confidence_score: 0.95,
      manual_review_required: false,
    },
    // 5. REQUIRES_REVIEW Scenario
    {
      organization_id: org1Id,
      opportunity_id: opp.id,
      type: 'desirable',
      category: 'Quality',
      title: 'Software Quality Assurance Manual (QAM) Compliance',
      description: 'Supplier should provide documented corporate software quality assurance manual.',
      source_reference: {
        page_number: 45,
        section_title: 'Section I - Quality Governance',
        snippet: 'QA manual required.',
        raw_quote: 'Bidders must furnish approved quality assurance manual detailing software telemetry review procedures.',
      },
      confidence_score: 0.88,
      manual_review_required: false,
    },
    // 6. CRITICAL FALSE-POSITIVE TEST: Requirement asks for Cloud Security Authorization, but only ISO 9001 Quality is available
    {
      organization_id: org1Id,
      opportunity_id: opp.id,
      type: 'mandatory',
      category: 'Cybersecurity',
      title: 'FedRAMP High Cloud Infrastructure Authorization (DoD IL5)',
      description: 'Offeror must prove active FedRAMP High package authorization for mission cloud hosting.',
      source_reference: {
        page_number: 50,
        section_title: 'Appendix K - Cloud Security',
        snippet: 'FedRAMP High package authorization required.',
        raw_quote: 'Cloud hosting providers must provide independent third-party assessment verifying FedRAMP High.',
      },
      confidence_score: 0.99,
      manual_review_required: false,
    },
  ];

  console.log('\nInserting 6 Requirements for Acceptance...');
  for (const req of requirementsToSeed) {
    const { data, error } = await client
      .from('requirements')
      .insert(req)
      .select('id, title, category, type')
      .single();
    if (error) console.error(`Error inserting ${req.title}:`, error.message);
    else console.log(`Created Requirement: [${data.type.toUpperCase()}] ${data.title} (${data.id})`);
  }

  console.log('\n--- DATA SETUP COMPLETE ---');
  console.log(`Opportunity ID: ${opp.id}`);
  return opp.id;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
