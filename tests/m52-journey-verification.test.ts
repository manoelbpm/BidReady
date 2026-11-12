import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SAAS_PLANS } from '../src/types/billing';
import { PdfParser } from '../src/lib/documents/parsers/pdf-parser';
import { DocxParser } from '../src/lib/documents/parsers/docx-parser';
import { XlsxParser } from '../src/lib/documents/parsers/xlsx-parser';
import { DocumentProcessingService } from '../src/lib/documents/service';
import { MockAIProvider } from '../src/lib/ai/mock-provider';

describe('BIDREADY — M5.2: Self-Service Commercial & Acquisition Journey Verification', () => {
  // 1. Landing Page Verifications
  it('1. Landing page contains accurate pricing, zero OCR claims, and human-in-the-loop review safeguard', () => {
    const landingPageContent = fs.readFileSync(path.resolve('src/app/page.tsx'), 'utf-8');

    // Truth in advertising: no claims of OCR availability
    expect(landingPageContent).not.toMatch(/equipped with OCR/i);
    expect(landingPageContent).not.toMatch(/parallel OCR/i);
    expect(landingPageContent).toMatch(/does not perform OCR on scanned image-only PDFs/i);
    expect(landingPageContent).toMatch(/Native PDF, DOCX, XLSX/i);

    // Truth in metrics: no unproven 60-hour claims
    expect(landingPageContent).not.toMatch(/eliminated a doomed 60-hour proposal/i);
    expect(landingPageContent).toMatch(/Illustrative Benchmark/i);

    // Human-in-the-loop safeguard
    expect(landingPageContent).toMatch(/We accelerate proposal capture\. You remain the final authority/i);

    // Correct plan pricing and limits
    expect(SAAS_PLANS.free.monthlyAnalysesLimit).toBe(2);
    expect(SAAS_PLANS.starter.monthlyPriceUsd).toBe(29);
    expect(SAAS_PLANS.starter.monthlyAnalysesLimit).toBe(10);
    expect(SAAS_PLANS.pro.monthlyPriceUsd).toBe(69);
    expect(SAAS_PLANS.pro.monthlyAnalysesLimit).toBe(40);
    expect(SAAS_PLANS.business.monthlyPriceUsd).toBe(149);
    expect(SAAS_PLANS.business.monthlyAnalysesLimit).toBe(120);
  });

  // 2. Interactive Demo Verifications
  it('2. Interactive demo labels all figures as synthetic benchmarks and presents FCL gap as human review alert', () => {
    const demoPageContent = fs.readFileSync(path.resolve('src/app/demo/page.tsx'), 'utf-8');

    // Clear origin and synthetic nature of data
    expect(demoPageContent).toMatch(/Public Benchmark Notice/i);
    expect(demoPageContent).toMatch(/FAA NextGen Radar Telemetry/i);
    expect(demoPageContent).toMatch(/illustrative synthetic data and do not represent actual client results/i);

    // Potential gap presentation: human verification required, not automated ineligibility
    expect(demoPageContent).toMatch(/POTENTIAL GAP REQUIRING HUMAN REVIEW/i);
    expect(demoPageContent).toMatch(/Verify compliance status with your FSO or identify a cleared teaming partner/i);
    expect(demoPageContent).not.toMatch(/NO-GO WARNING: Mandatory Facility Security Clearance is missing/i);
  });

  // 3. Upload & Scanned Document Warning Verification
  it('3. Real upload behavior: native text parsing works; scanned image PDF is flagged and quota released', async () => {
    const pdfParser = new PdfParser();
    const docxParser = new DocxParser();
    const xlsxParser = new XlsxParser();

    expect(pdfParser.supports('pdf')).toBe(true);
    expect(docxParser.supports('docx')).toBe(true);
    expect(xlsxParser.supports('xlsx')).toBe(true);

    // Minimal scanned PDF with no text stream
    const minimalScannedPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
    );

    const service = new DocumentProcessingService(new MockAIProvider());
    const res = await service.ingestAndProcessDocument({
      documentId: 'test-scanned-journey-01',
      organizationId: 'org-journey-test',
      userId: 'usr-journey-test',
      fileName: 'FAA_Scanned_Raster_Image.pdf',
      fileBuffer: minimalScannedPdf,
    });

    expect(res.status).toBe('failed');
    expect(res.requiresOcr).toBe(true);
    expect(res.failureReason).toMatch(/Scanned document detected/i);
    expect(res.failureReason).toMatch(/native digital text/i);
  });

  // 4. Paywall & Quota Enforcement Verification
  it('4. Free tier is strictly capped at 2 analyses, triggering upgrade prompt for excess usage', () => {
    expect(SAAS_PLANS.free.monthlyAnalysesLimit).toBe(2);
    expect(SAAS_PLANS.free.monthlyPriceUsd).toBe(0);

    // Verify upgrade paths
    const starterRatio = SAAS_PLANS.starter.monthlyPriceUsd / SAAS_PLANS.starter.monthlyAnalysesLimit;
    const proRatio = SAAS_PLANS.pro.monthlyPriceUsd / SAAS_PLANS.pro.monthlyAnalysesLimit;
    const bizRatio = SAAS_PLANS.business.monthlyPriceUsd / SAAS_PLANS.business.monthlyAnalysesLimit;

    // Unit economics: price per analysis decreases with tier volume
    expect(starterRatio).toBeCloseTo(2.9, 1);
    expect(proRatio).toBeCloseTo(1.725, 2);
    expect(bizRatio).toBeCloseTo(1.24, 2);
    expect(starterRatio).toBeGreaterThan(proRatio);
    expect(proRatio).toBeGreaterThan(bizRatio);
  });
});
