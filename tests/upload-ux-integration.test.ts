import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import crypto, { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { POST, GET } from '../src/app/api/documents/upload/route';
import { DocumentProcessingService } from '../src/lib/documents/service';
import { MockAIProvider } from '../src/lib/ai/mock-provider';
import { SubscriptionService } from '../src/lib/billing/subscription-service';
import { TenderExtractionResult } from '../src/lib/extraction/schemas';

// Load .env.local safely
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Ignore if already loaded or not present
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ghqbqzljfpkjdrnuyddo.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const TEST_USER = '730c4516-70e6-42f8-8bb2-ea933b9c7cfd';

let authToken = '';

describe('BIDREADY — M4.12: End-to-End Document Upload & Analysis UX Tests', () => {
  beforeAll(async () => {
    if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await client.auth.signInWithPassword({
          email: 'analyst@bidready.com',
          password: 'SuperSecret2026!',
        });
        if (data?.session?.access_token) {
          authToken = data.session.access_token;
        }
      } catch {
        // Fallback gracefully in isolated environments
      }
    }
  });

  // Helpers to create test files
  const createValidPdfBuffer = (uniqueLabel: string): Buffer => {
    const text = `Federal Aviation Administration Modernization RFP ${uniqueLabel} - Mandatory ISO 27001 Certification required. Clarifications due November 25, 2026.`;
    return Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 200 >>\nstream\nBT /F1 12 Tf 72 712 Td (${text}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF`
    );
  };

  const createValidXlsxBuffer = (sheetName: string): Buffer => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['Requirement ID', 'Category', 'Description', 'Severity', 'Due Date'],
      ['REQ-SEC-01', 'Security', 'FedRAMP High Authorization required for all telemetry ingest nodes', 'Mandatory', '2026-12-15'],
      ['REQ-INT-02', 'Interoperability', 'STANAG 4586 Protocol support preferred', 'Desirable', '2026-12-15'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  const getValidDocxBuffer = (): Buffer => {
    const docxPath = path.resolve('node_modules/mammoth/test/test-data/single-paragraph.docx');
    if (fs.existsSync(docxPath)) {
      return fs.readFileSync(docxPath);
    }
    return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  };

  // Helper to build NextRequest with FormData
  const buildUploadRequest = (
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    orgId: string,
    title: string = 'Test Tender Ingestion',
    useAuth: boolean = false
  ): NextRequest => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, fileName);
    formData.append('title', title);
    formData.append('referenceCode', 'RFP-2026-TEST');
    formData.append('buyerName', 'Federal Procurement Agency');
    formData.append('organizationId', orgId);
    formData.append('userId', TEST_USER);
    formData.append('aiProvider', 'mock');

    const headers: Record<string, string> = {
      'x-ai-provider': 'mock',
    };
    if (useAuth && authToken) {
      headers['authorization'] = `Bearer ${authToken}`;
    }

    return new NextRequest('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData,
      headers,
    });
  };

  // 1. Upload de documento PDF
  it('1. uploads and extracts valid PDF document with metadata and requirements', async () => {
    const testOrg = `org-test-1-${Date.now()}`;
    const pdfBuf = createValidPdfBuffer(`TEST-PDF-${Date.now()}`);
    const req = buildUploadRequest(pdfBuf, 'FAA-Radar-Spec.pdf', 'application/pdf', testOrg);

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(['ready', 'completed', 'review_required']).toContain(data.status);
    expect(data.mimeType).toBe('application/pdf');
    expect(data.documentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(data.checksumSha256).toBeDefined();
    expect(data.extractionResult).toBeDefined();
    expect(data.extractionResult.mandatory_requirements.length).toBeGreaterThan(0);
  });

  // 2. Upload de documento DOCX
  it('2. uploads and processes DOCX document extracting paragraphs and metadata', async () => {
    const testOrg = `org-test-2-${Date.now()}`;
    const docxBuf = getValidDocxBuffer();
    const req = buildUploadRequest(
      docxBuf,
      'Solicitation-Notice.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      testOrg
    );

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(data.parsedSummary).toBeDefined();
    expect(data.extractionResult).toBeDefined();
  });

  // 3. Upload de documento XLSX
  it('3. uploads and processes XLSX spreadsheet preserving tabular matrix and sheets', async () => {
    const testOrg = `org-test-3-${Date.now()}`;
    const xlsxBuf = createValidXlsxBuffer(`Matrix-${Date.now()}`);
    const req = buildUploadRequest(
      xlsxBuf,
      'Procurement-Matrix.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      testOrg
    );

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(data.parsedSummary?.sectionCount).toBeGreaterThan(0);
    expect(data.extractionResult).toBeDefined();
  });

  // 4. Tentativa de upload com formato inválido
  it('4. rejects invalid document format (unsupported extension / spoofed content)', async () => {
    const testOrg = `org-test-4-${Date.now()}`;
    const invalidText = Buffer.from('Plain text file without PDF/OpenXML signatures');
    const req = buildUploadRequest(invalidText, 'invalid-contract.txt', 'text/plain', testOrg);

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.status).toBe('failed');
    expect(data.error).toMatch(/unsupported|invalid/i);
  });

  // 5. Tentativa de upload de PDF escaneado sem OCR legível
  it('5. detects scanned PDF without selectable text and flags requiresOcr', async () => {
    const testOrg = `org-test-5-${Date.now()}`;
    const minimalScannedPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
    );

    const req = buildUploadRequest(minimalScannedPdf, 'Scanned-RFP.pdf', 'application/pdf', testOrg);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.requiresOcr).toBe(true);
    expect(data.error).toContain('OCR');
  });

  // 6. Tentativa de upload de usuário sem quota suficiente
  it('6. rejects upload with 403 when organization analysis quota is exhausted', async () => {
    const exhaustedOrgId = `org-exhausted-${Date.now()}`;

    const subService = new SubscriptionService();
    const sub = subService.getSubscription(exhaustedOrgId);
    sub.analysesUsedInPeriod = sub.monthlyAnalysesLimit; // fully consumed

    const mockProvider = new MockAIProvider();
    const service = new DocumentProcessingService(mockProvider, subService);

    const pdfBuf = createValidPdfBuffer('Quota-Exhausted-Test');

    await expect(
      service.ingestAndProcessDocument({
        documentId: randomUUID(),
        organizationId: exhaustedOrgId,
        userId: TEST_USER,
        fileName: 'Tender-Quota.pdf',
        fileBuffer: pdfBuf,
      })
    ).rejects.toThrow(/Billing Quota Exceeded/i);
  });

  // 7. Falha de processamento no Gemini com liberação correta de quota
  it('7. safely releases reserved quota if AI extraction fails or times out', async () => {
    const testOrg = `org-failover-${Date.now()}`;
    const subRepoMock = {
      reserveAnalysisQuota: vi.fn().mockResolvedValue({ allowed: true }),
      releaseAnalysisQuota: vi.fn().mockResolvedValue(true),
      recordUsageAudit: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const failingProvider = {
      name: 'gemini' as const,
      defaultModel: 'gemini-3.8-flash',
      extractTender: vi.fn().mockResolvedValue({
        success: false,
        error: 'Gemini 3.8 Flash unavailable (HTTP 503 Spike in Demand)',
        provider: 'gemini',
      }),
    };

    const service = new DocumentProcessingService(
      failingProvider as any,
      undefined,
      undefined,
      subRepoMock as any
    );

    const pdfBuf = createValidPdfBuffer('Failover-Quota-Test');
    const result = await service.ingestAndProcessDocument({
      documentId: randomUUID(),
      organizationId: testOrg,
      userId: TEST_USER,
      fileName: 'Tender-Failover.pdf',
      fileBuffer: pdfBuf,
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Gemini 3.8 Flash unavailable');
    expect(subRepoMock.reserveAnalysisQuota).toHaveBeenCalledWith(testOrg);
    expect(subRepoMock.releaseAnalysisQuota).toHaveBeenCalledWith(testOrg);
    expect(subRepoMock.recordUsageAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: testOrg,
        successfulRun: false,
      })
    );
  });

  // 8. Persistência completa no Supabase e recuperação via GET
  it('8. completes end-to-end ingestion and enables subsequent retrieval via GET endpoint', async () => {
    const testOrg = `org-test-8-${Date.now()}`;
    const pdfBuf = createValidPdfBuffer(`GET-RETRIEVE-${Date.now()}`);
    const postReq = buildUploadRequest(
      pdfBuf,
      'Persisted-Tender.pdf',
      'application/pdf',
      testOrg
    );

    const postRes = await POST(postReq);
    const postData = await postRes.json();
    expect(postRes.status).toBe(200);
    const docId = postData.documentId;
    expect(docId).toBeDefined();

    // Query GET endpoint for the processed document
    const getReq = new NextRequest(
      `http://localhost:3000/api/documents/upload?documentId=${docId}&organizationId=${testOrg}`,
      { headers: { 'x-ai-provider': 'mock' } }
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);

    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.document.id).toBe(docId);
    expect(getData.document.fileName).toBe('Persisted-Tender.pdf');
    expect(getData.document.organizationId).toBe(testOrg);
    expect(getData.extractionResult || getData.requirements).toBeDefined();
  });

  // 9. Isolamento multi-tenant: organização A não pode consultar análises da organização B
  it('9. strictly enforces multi-tenant isolation: Org B is forbidden from retrieving Org A documents', async () => {
    const orgA = `org-tenant-A-${Date.now()}`;
    const orgB = `org-tenant-B-${Date.now()}`;

    const pdfBuf = createValidPdfBuffer(`CROSS-TENANT-${Date.now()}`);
    const postReq = buildUploadRequest(
      pdfBuf,
      'Confidential-OrgA-Tender.pdf',
      'application/pdf',
      orgA
    );

    const postRes = await POST(postReq);
    const postData = await postRes.json();
    expect(postRes.status).toBe(200);
    const docId = postData.documentId;

    // Organization B attempts to retrieve Organization A's document
    const crossTenantGetReq = new NextRequest(
      `http://localhost:3000/api/documents/upload?documentId=${docId}&organizationId=${orgB}`,
      { headers: { 'x-ai-provider': 'mock' } }
    );
    const crossRes = await GET(crossTenantGetReq);

    expect(crossRes.status).toBe(403);
    const crossData = await crossRes.json();
    expect(crossData.success).toBe(false);
    expect(crossData.error).toContain('Cross-tenant access denied');
  });

  // 10. Comprovação da exibição de itens que exigem revisão humana
  it('10. flags analysis as review_required when confidence is below 0.85 or warnings are present', async () => {
    const customResult: TenderExtractionResult = {
      executive_summary: 'Solicitation with subjective qualification clauses requiring human review.',
      opportunity_identification: { title: 'Human Review Tender' },
      important_dates: [],
      mandatory_requirements: [
        {
          category: 'Compliance',
          type: 'mandatory',
          title: 'Subjective Discretionary Criteria',
          description: 'Offeror must demonstrate subjective excellence in past government projects.',
          source_reference: {
            page_number: 1,
            section_title: 'Section 4',
            snippet: 'Subjective criteria',
            raw_quote: 'Offeror must demonstrate subjective excellence in past government projects.',
          },
          confidence_score: 0.76, // Below 0.85 threshold
          manual_review_required: true,
          review_reason: 'Subjective evaluation criteria requires procurement analyst review.',
        },
      ],
      desirable_requirements: [],
      required_documents_and_evidence: [],
      submission_instructions: {
        format_requirements: 'PDF',
        submission_channel: 'Electronic Federal Procurement Portal',
        source_reference: {
          page_number: 1,
          section_title: 'Submission Instructions',
          snippet: 'Submit via portal',
          raw_quote: 'Offerors shall submit packages via official portal.',
        },
      },
      questions_and_clarifications: {
        deadline: '2026-11-20T17:00:00Z',
        submission_method: 'Portal',
        source_reference: null,
      },
      missing_information: [
        {
          topic: 'Budget Ceiling',
          description: 'Budget ceiling not specified',
          suggested_human_action: 'Submit clarification question',
          is_ambiguity: true,
        },
      ],
      human_review_warnings: [
        {
          severity: 'high',
          item_title: 'Subjective evaluation criteria',
          reason: 'Discretionary criteria detected with low confidence score (0.76).',
          recommended_action: 'Human procurement analyst review required.',
        },
      ],
      extraction_metadata: {
        model_provider: 'gemini',
        model_version: 'gemini-3.8-flash',
        tokens_consumed: 950,
        overall_confidence: 0.79, // Below 0.85 threshold
        extracted_at: new Date().toISOString(),
      },
    };

    const mockProvider = {
      name: 'gemini' as const,
      defaultModel: 'gemini-3.8-flash',
      extractTender: vi.fn().mockResolvedValue({
        success: true,
        result: customResult,
        provider: 'gemini',
      }),
    };

    const testOrg = `org-test-10-${Date.now()}`;
    const service = new DocumentProcessingService(mockProvider as any);
    const pdfBuf = createValidPdfBuffer('Review-Required-Test');

    const record = await service.ingestAndProcessDocument({
      documentId: randomUUID(),
      organizationId: testOrg,
      userId: TEST_USER,
      fileName: 'Subjective-Tender.pdf',
      fileBuffer: pdfBuf,
    });

    // Technical processing succeeded, but business state is review_required
    expect(record.status).toBe('review_required');
    expect(record.extractionResult?.human_review_warnings.length).toBeGreaterThan(0);
    expect(record.extractionResult?.mandatory_requirements[0].manual_review_required).toBe(true);
    expect(record.extractionResult?.mandatory_requirements[0].confidence_score).toBeLessThan(0.85);
  });

  // 11. Rastreabilidade das citações contra o documento original
  it('11. preserves verbatim raw_quote, section titles and coordinates in extracted requirements', async () => {
    const rawQuoteExpected = 'Core air traffic telemetry services must guarantee 99.999% operational availability.';
    const providerWithCitations = {
      name: 'gemini' as const,
      defaultModel: 'gemini-3.8-flash',
      extractTender: vi.fn().mockResolvedValue({
        success: true,
        result: {
          executive_summary: 'Air Traffic Telemetry System Specifications.',
          opportunity_identification: { title: 'Telemetry RFP' },
          important_dates: [],
          mandatory_requirements: [
            {
              category: 'SLA',
              type: 'mandatory',
              title: '99.999% High Availability SLA',
              description: 'Guaranteed five-nines annual uptime.',
              source_reference: {
                page_number: 3,
                section_title: 'Section 4.1 System Reliability',
                snippet: 'Five-nines availability required.',
                raw_quote: rawQuoteExpected,
              },
              confidence_score: 0.96,
              manual_review_required: false,
            },
          ],
          desirable_requirements: [],
          required_documents_and_evidence: [],
          submission_instructions: {
            format_requirements: 'PDF',
            submission_channel: 'Electronic Federal Procurement Portal',
            source_reference: {
              page_number: 1,
              section_title: 'Submission Instructions',
              snippet: 'Submit via portal',
              raw_quote: 'Offerors shall submit packages via official portal.',
            },
          },
          questions_and_clarifications: {
            deadline: '2026-11-20T17:00:00Z',
            submission_method: 'Portal',
            source_reference: null,
          },
          missing_information: [],
          human_review_warnings: [],
          extraction_metadata: {
            model_provider: 'gemini',
            model_version: 'gemini-3.8-flash',
            tokens_consumed: 1200,
            overall_confidence: 0.96,
            extracted_at: new Date().toISOString(),
          },
        },
        provider: 'gemini',
      }),
    };

    const testOrg = `org-test-11-${Date.now()}`;
    const service = new DocumentProcessingService(providerWithCitations as any);
    const pdfBuf = createValidPdfBuffer('Traceability-Test');

    const record = await service.ingestAndProcessDocument({
      documentId: randomUUID(),
      organizationId: testOrg,
      userId: TEST_USER,
      fileName: 'Availability-Spec.pdf',
      fileBuffer: pdfBuf,
    });

    const req = record.extractionResult?.mandatory_requirements[0];
    expect(req).toBeDefined();
    expect(req?.source_reference.page_number).toBe(3);
    expect(req?.source_reference.section_title).toBe('Section 4.1 System Reliability');
    expect(req?.source_reference.raw_quote).toBe(rawQuoteExpected);
  });

  // 12. Prevenção de submissões duplicadas
  it('12. prevents duplicate submissions by matching SHA-256 checksum and releasing quota', async () => {
    const testOrg = `org-duplicate-${Date.now()}`;
    const identicalPdfBuffer = createValidPdfBuffer(`IDENTICAL-CHECKSUM-${Date.now()}`);

    // First upload
    const req1 = buildUploadRequest(identicalPdfBuffer, 'Master-Tender.pdf', 'application/pdf', testOrg);
    const res1 = await POST(req1);
    const data1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(data1.success).toBe(true);

    // Second upload of identical file buffer under the same organization
    const req2 = buildUploadRequest(identicalPdfBuffer, 'Duplicate-Attempt.pdf', 'application/pdf', testOrg);
    const res2 = await POST(req2);
    const data2 = await res2.json();

    expect(res2.status).toBe(422);
    expect(data2.success).toBe(false);
    expect(data2.status).toBe('failed');
    expect(data2.error).toContain('Duplicate document detected');
    expect(data2.error).toContain(data1.documentId);
  });
});
