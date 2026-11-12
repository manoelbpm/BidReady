import fs from 'fs';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { GeminiAIProvider } from '../src/lib/ai/gemini-provider';
import { DocumentProcessingService } from '../src/lib/documents/service';
import {
  DocumentRepository,
  SubscriptionRepository,
  OpportunityRepository,
} from '../src/lib/supabase/repositories';

// Load .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key: string) => {
  const m = envFile.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const geminiApiKey = getEnv('GEMINI_API_KEY');
const geminiModel = getEnv('GEMINI_MODEL') || 'gemini-2.5-flash';

const TEST_ORG_ID = 'b22937b6-51e5-48a0-a75d-7b3405427298';

async function main() {
  console.log('--- BIDREADY M4.11.2 REAL INFERENCE RUNNER ---');
  console.log('Target Model:', geminiModel);
  console.log('Supabase URL:', supabaseUrl);

  // 1. Authenticate user
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = await client.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });

  if (auth.error || !auth.data?.user) {
    throw new Error(`Authentication failed: ${auth.error?.message}`);
  }
  const userId = auth.data.user.id;
  console.log('Authenticated as:', auth.data.user.email, 'User ID:', userId);

  const docRepo = new DocumentRepository(client);
  const subRepo = new SubscriptionRepository(client);
  const oppRepo = new OpportunityRepository(client);

  // 2. Check quota before
  const subBefore = await subRepo.getSubscription(TEST_ORG_ID);
  const quotaBefore = subBefore?.analysesUsedInPeriod ?? 0;
  console.log('Quota Before Run:', quotaBefore, '/', subBefore?.monthlyAnalysesLimit);

  // 3. Initialize Real Gemini Provider
  const provider = new GeminiAIProvider(geminiApiKey, undefined, geminiModel);
  const service = new DocumentProcessingService(provider, undefined, docRepo, subRepo, oppRepo);

  // 4. Construct synthetic tender document
  const tenderText = `
FEDERAL AVIATION ADMINISTRATION (FAA)
SOLICITATION RFP: FAA-2026-RADAR-009
PROJECT: NextGen Radar & Air Traffic Telemetry Infrastructure Modernization

SECTION 1: KEY MILESTONES & PROPOSAL SCHEDULE
1.1 Clarification Questions Deadline: November 25, 2026 at 17:00 UTC. All vendor clarification questions must be formally submitted electronically through the FAA FAST procurement portal Q&A module.
1.2 Final Proposal Submission Due Date: December 18, 2026 at 21:00 UTC. Complete electronic proposals must be submitted via the FAA FAST procurement portal. Packages must be in searchable PDF/A format, maximum file size 50MB per volume. Separate Cost/Pricing Volume from Technical Volume.

SECTION 4: MANDATORY QUALIFICATIONS & COMPLIANCE REQUIREMENTS
4.1 Cybersecurity & Compliance: The offeror and all sub-tier infrastructure providers must hold current ISO 27001 and SOC 2 Type II compliance certificates prior to contract award.
4.2 High Availability SLA: Core air traffic telemetry services must guarantee 99.999% operational availability per calendar year with automated failover in under 30 seconds.

SECTION 6: DESIRABLE SYSTEM ENHANCEMENTS
6.4 Interoperability: Preference will be given to architectures supporting NATO STANAG 4586 telemetry ingestion protocols for unmanned aerial monitoring feeds.

SECTION 7: PROPOSAL EXHIBITS & EVIDENCE
7.1 Financial Audits: Offerors shall submit independently audited financial statements for the preceding three fiscal years (2023, 2024, and 2025).

SECTION 8: INFRASTRUCTURE FOOTPRINT
8.1 Staging: The RFP does not specify whether physical redundant hardware must be stationed within CONUS or OCONUS. Offerors must request clarification.
`.trim();

  const lines = tenderText.split('\n').filter((l) => l.trim().length > 0);
  const streamContent = 'BT /F1 12 Tf 72 712 Td (' + lines.map((l) => l.replace(/[()]/g, '')).join(') Tj T* (') + ') Tj ET';
  const pdfSource = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamContent.length} >>
stream
${streamContent}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${250 + streamContent.length}
%%EOF`;

  const pdfBuffer = Buffer.from(pdfSource);
  const documentId = randomUUID();

  console.log('Starting Ingestion & Live AI Extraction for Document ID:', documentId);
  const startTime = Date.now();

  const record = await service.ingestAndProcessDocument({
    documentId,
    organizationId: TEST_ORG_ID,
    userId,
    fileName: 'FAA-Radar-Tender-2026.pdf',
    fileBuffer: pdfBuffer,
    opportunityTitle: 'NextGen Radar & Air Traffic Telemetry RFP',
    referenceCode: 'FAA-2026-RADAR-009',
    buyerName: 'Federal Aviation Administration',
  });

  const totalDuration = Date.now() - startTime;
  console.log('Execution Finished in:', totalDuration, 'ms');
  console.log('Document Status:', record.status);

  if (record.status === 'failed') {
    console.error('FAILED REASON:', record.failureReason);
    process.exit(1);
  }

  // 5. Check quota after
  const subAfter = await subRepo.getSubscription(TEST_ORG_ID);
  const quotaAfter = subAfter?.analysesUsedInPeriod ?? 0;
  console.log('Quota After Run:', quotaAfter, '/', subAfter?.monthlyAnalysesLimit);

  // 6. Read back using brand new fresh client
  console.log('--- COLD START READ PROOF WITH NEW CLIENT ---');
  const freshClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await freshClient.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });

  const freshDocRepo = new DocumentRepository(freshClient);
  const freshOppRepo = new OpportunityRepository(freshClient);
  const freshSubRepo = new SubscriptionRepository(freshClient);

  const persistedDoc = await freshDocRepo.getDocument(documentId);
  console.log('Persisted Document Status in DB:', persistedDoc?.status);
  console.log('Persisted Storage Path in DB:', persistedDoc?.storage_path);

  let runs: any[] = [];
  let requirements: any[] = [];
  if (record.opportunityId) {
    runs = await freshDocRepo.listAnalysisRuns(record.opportunityId);
    requirements = await freshOppRepo.listRequirements(record.opportunityId);
  }

  const audits = await freshSubRepo.listUsageAudit(TEST_ORG_ID);
  const latestAudit = audits.find((a) => a.document_id === documentId);

  const report = {
    modelUsed: geminiModel,
    isRealCall: true,
    documentId,
    opportunityId: record.opportunityId,
    documentStatus: record.status,
    totalDurationMs: totalDuration,
    quota: {
      before: quotaBefore,
      after: quotaAfter,
      debited: quotaAfter - quotaBefore === 1,
    },
    tokens: record.extractionResult?.extraction_metadata.tokens_consumed,
    extractionResult: {
      executiveSummary: record.extractionResult?.executive_summary,
      mandatoryCount: record.extractionResult?.mandatory_requirements.length,
      desirableCount: record.extractionResult?.desirable_requirements.length,
      mandatoryTitles: record.extractionResult?.mandatory_requirements.map((m) => ({
        title: m.title,
        quote: m.source_reference?.raw_quote,
        confidence: m.confidence_score,
      })),
      desirableTitles: record.extractionResult?.desirable_requirements.map((d) => ({
        title: d.title,
        quote: d.source_reference?.raw_quote,
        manualReview: d.manual_review_required,
      })),
      dates: record.extractionResult?.important_dates.map((d) => ({
        title: d.title,
        date: d.due_date,
      })),
      submission: record.extractionResult?.submission_instructions,
      missingInfo: record.extractionResult?.missing_information,
    },
    analysisRunsCount: runs.length,
    latestRunId: runs[0]?.id,
    requirementsPersistedCount: requirements.length,
    auditLog: latestAudit,
  };

  fs.writeFileSync(
    'scripts/real-inference-result.json',
    JSON.stringify(report, null, 2)
  );

  console.log('SUCCESSFULLY WRITTEN EVIDENCE TO scripts/real-inference-result.json');
  console.log('SUMMARY:', JSON.stringify({
    model: report.modelUsed,
    docStatus: report.documentStatus,
    quotaDebited: report.quota.debited,
    mandatoryExtracted: report.extractionResult.mandatoryCount,
    requirementsInDb: report.requirementsPersistedCount,
    auditNotes: report.auditLog?.notes,
  }, null, 2));
}

main().catch((err) => {
  console.error('UNHANDLED ERROR:', err);
  process.exit(1);
});
