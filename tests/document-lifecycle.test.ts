import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { DocumentProcessingService } from '../src/lib/documents/service';
import { MockAIProvider } from '../src/lib/ai/mock-provider';

describe('Document Processing Lifecycle & Multi-Tenant Isolation', () => {
  // Synthetic valid XLSX workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Section', 'Requirements Criteria', 'Due Date'],
    ['Schedule', 'Submission Deadline', '2026-12-15'],
    ['Compliance', 'ISO 27001 Certification', 'Active'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'RFP_Criteria');
  const validXlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  it('runs complete document lifecycle transitioning to completed or review_required', async () => {
    const service = new DocumentProcessingService(new MockAIProvider());

    const result = await service.ingestAndProcessDocument({
      documentId: 'doc-lifecycle-01',
      organizationId: 'tenant-acme-corp',
      userId: 'user-alice-01',
      fileName: 'DOD-Logistics-RFP.xlsx',
      fileBuffer: validXlsxBuffer,
      opportunityTitle: 'DOD Logistics Automation',
      referenceCode: 'RFP-2026-LOG-01',
      buyerName: 'US Department of Defense',
    });

    expect(['completed', 'review_required']).toContain(result.status);
    expect(result.checksumSha256).toHaveLength(64);
    expect(result.parsedSummary?.sectionCount).toBeGreaterThan(0);
    expect(result.extractionResult).toBeDefined();
    expect(result.extractionResult?.mandatory_requirements.length).toBeGreaterThan(0);
  });

  it('prevents accidental duplicate processing of identical file within same organization', async () => {
    const service = new DocumentProcessingService(new MockAIProvider());

    // 1st processing
    const firstRun = await service.ingestAndProcessDocument({
      documentId: 'doc-original-01',
      organizationId: 'tenant-security-holdings',
      userId: 'user-bob-01',
      fileName: 'Procurement_Specs.xlsx',
      fileBuffer: validXlsxBuffer,
    });
    expect(['completed', 'review_required']).toContain(firstRun.status);

    // 2nd processing with different ID but same file content & same org
    const duplicateRun = await service.ingestAndProcessDocument({
      documentId: 'doc-duplicate-02',
      organizationId: 'tenant-security-holdings',
      userId: 'user-bob-01',
      fileName: 'Procurement_Specs_Copy.xlsx',
      fileBuffer: validXlsxBuffer,
    });

    expect(duplicateRun.status).toBe('failed');
    expect(duplicateRun.failureReason).toContain('Duplicate document detected');
  });

  it('enforces strict tenant isolation: org B cannot inspect org A documents', async () => {
    const service = new DocumentProcessingService(new MockAIProvider());

    await service.ingestAndProcessDocument({
      documentId: 'doc-tenantA-secret',
      organizationId: 'org-tenant-A',
      userId: 'user-A',
      fileName: 'Classified_Tender.xlsx',
      fileBuffer: validXlsxBuffer,
    });

    // Valid retrieval by owner organization
    const docForA = service.getDocument('doc-tenantA-secret', 'org-tenant-A');
    expect(docForA).toBeDefined();
    expect(docForA?.id).toBe('doc-tenantA-secret');

    // Forbidden retrieval by competitor organization B
    expect(() => {
      service.getDocument('doc-tenantA-secret', 'org-tenant-B-competitor');
    }).toThrowError(/Cross-tenant access denied/);
  });

  it('rejects corrupted documents during validation phase without calling AI provider', async () => {
    const corruptedBuffer = Buffer.from('corrupted binary noise without valid headers');
    const service = new DocumentProcessingService(new MockAIProvider());

    const result = await service.ingestAndProcessDocument({
      documentId: 'doc-corrupted-99',
      organizationId: 'org-tenant-A',
      userId: 'user-A',
      fileName: 'Corrupted.pdf',
      fileBuffer: corruptedBuffer,
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Invalid file signature');
  });

  it('rejects scanned image-only PDF lacking selectable text with clear alert message', async () => {
    // Valid PDF signature and structure, but zero extractable text (simulating raster/scanned image PDF)
    const minimalScannedPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
    );
    const service = new DocumentProcessingService(new MockAIProvider());

    const result = await service.ingestAndProcessDocument({
      documentId: 'doc-scanned-01',
      organizationId: 'org-tenant-A',
      userId: 'user-A',
      fileName: 'Scanned_Solicitation_ImageOnly.pdf',
      fileBuffer: minimalScannedPdf,
    });

    expect(result.status).toBe('failed');
    expect(result.requiresOcr).toBe(true);
    expect(result.failureReason).toMatch(/Scanned document/i);
    expect(result.failureReason).toMatch(/text layer/i);
  });
});
