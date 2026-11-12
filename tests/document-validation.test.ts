import { describe, it, expect } from 'vitest';
import {
  validateDocument,
  verifyMagicBytes,
  calculateSha256,
  generateTenantStoragePath,
} from '../src/lib/documents/validation';

describe('Document Validation, Magic Numbers & Security Checks', () => {
  const validPdfHeader = Buffer.from('%PDF-1.7\n%synthetic test body');
  const validZipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]); // PK\x03\x04
  const fakePdfWithExeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ DOS/PE Executable

  it('verifies true PDF magic bytes', () => {
    const result = verifyMagicBytes(validPdfHeader);
    expect(result.matches).toBe(true);
    expect(result.detectedSignature).toBe('pdf');
  });

  it('verifies true OpenXML ZIP magic bytes (DOCX / XLSX)', () => {
    const result = verifyMagicBytes(validZipHeader);
    expect(result.matches).toBe(true);
    expect(result.detectedSignature).toBe('zip');
  });

  it('rejects empty documents (0 bytes)', () => {
    const empty = Buffer.alloc(0);
    const result = validateDocument(empty, 'tender.pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Document is empty (0 bytes)');
  });

  it('rejects files exceeding the configurable file-size limit', () => {
    const smallBuffer = Buffer.from('%PDF-1.4\nTest');
    const result = validateDocument(smallBuffer, 'tender.pdf', 'application/pdf', 5); // 5 bytes limit
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds maximum allowed limit');
  });

  it('detects and blocks MIME spoofing attacks (executable renamed to .pdf)', () => {
    const result = validateDocument(fakePdfWithExeBytes, 'malicious_contract.pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid file signature');
  });

  it('detects format mismatch when ZIP file is supplied with .pdf extension', () => {
    const result = validateDocument(validZipHeader, 'spoofed_document.pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('MIME/Format mismatch');
  });

  it('rejects unsupported file formats (.exe, .zip, .txt, .csv)', () => {
    const txtBuffer = Buffer.from('Plain text tender');
    const result = validateDocument(txtBuffer, 'tender.txt');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Unsupported file extension');
  });

  it('computes deterministic SHA-256 checksums', () => {
    const testContent = Buffer.from('%PDF-1.4\nDeterministic procurement file');
    const hash1 = calculateSha256(testContent);
    const hash2 = calculateSha256(testContent);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('generates isolated, multi-tenant storage paths preventing traversal', () => {
    const path = generateTenantStoragePath(
      'org-alpha-99',
      'user-beta-01',
      'doc-gamma-42',
      'RFP ../../Secret Tender#1.pdf'
    );

    // Directory traversal characters should be sanitized
    expect(path).not.toContain('..');
    expect(path).toBe('org-alpha-99/user-beta-01/doc-gamma-42/RFP_____Secret_Tender_1.pdf');
    expect(path.startsWith('org-alpha-99/')).toBe(true);
  });
});
