import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { XlsxParser } from '../src/lib/documents/parsers/xlsx-parser';
import { PdfParser } from '../src/lib/documents/parsers/pdf-parser';
import { parseDocument } from '../src/lib/documents/parsers';

describe('Document Parsers & Source Coordinate Preservation', () => {
  it('parses XLSX worksheets, preserving sheet names, table structure and row coordinates', async () => {
    // Generate synthetic in-memory XLSX workbook
    const wb = XLSX.utils.book_new();

    const scheduleData = [
      ['Event', 'Milestone Date', 'Mandatory'],
      ['Questions Deadline', '2026-11-20', 'YES'],
      ['Proposal Submission', '2026-12-15', 'YES'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(scheduleData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Schedule & Deadlines');

    const criteriaData = [
      ['Req ID', 'Requirement Description', 'Category'],
      ['REQ-01', 'ISO 27001 Certification Required', 'Security'],
      ['REQ-02', 'CMMC Level 2 Authorization', 'Compliance'],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(criteriaData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Mandatory Criteria');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parser = new XlsxParser();
    const result = await parser.parse(buffer);

    expect(result.format).toBe('xlsx');
    expect(result.metadata.sheetCount).toBe(2);
    expect(result.sections.length).toBeGreaterThan(2);

    // Verify coordinates preservation
    const hasSheet1Coordinates = result.sections.some((s) =>
      s.coordinates?.includes('Sheet "Schedule & Deadlines"')
    );
    const hasSheet2Coordinates = result.sections.some((s) =>
      s.coordinates?.includes('Sheet "Mandatory Criteria"')
    );

    expect(hasSheet1Coordinates).toBe(true);
    expect(hasSheet2Coordinates).toBe(true);
    expect(result.rawFullText).toContain('ISO 27001 Certification Required');
  });

  it('detects scanned or minimal text PDF and classifies as requires_ocr', async () => {
    // Minimal valid synthetic PDF with no font or text streams
    const minimalScannedPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
    );

    const parser = new PdfParser();
    const result = await parser.parse(minimalScannedPdf);

    expect(result.format).toBe('pdf');
    expect(result.requiresOcr).toBe(true);
    expect(result.ocrReason).toContain('scanned image or raster PDF');
  });

  it('unified parseDocument dispatcher handles supported formats', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Column A', 'Column B']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseDocument(buffer, 'xlsx');
    expect(result.format).toBe('xlsx');
  });
});
