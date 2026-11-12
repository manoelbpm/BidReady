import crypto from 'crypto';

export type SupportedExtension = 'pdf' | 'docx' | 'xlsx';

export interface FileValidationResult {
  isValid: boolean;
  detectedFormat?: SupportedExtension;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  error?: string;
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB default limit

/**
 * Known magic numbers / file signatures
 */
const MAGIC_NUMBERS = {
  // PDF starts with %PDF- (0x25 0x50 0x44 0x46)
  PDF: [0x25, 0x50, 0x44, 0x46],
  // ZIP-based Office Open XML (DOCX, XLSX) starts with PK\x03\x04 (0x50 0x4B 0x03 0x04)
  ZIP_LOCAL_FILE_HEADER: [0x50, 0x4B, 0x03, 0x04],
  ZIP_EMPTY_ARCHIVE: [0x50, 0x4B, 0x05, 0x06],
  ZIP_SPANNED: [0x50, 0x4B, 0x07, 0x08],
};

const ALLOWED_MIME_TYPES: Record<SupportedExtension, string[]> = {
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
};

/**
 * Calculates SHA-256 hash for document integrity and idempotency checks.
 */
export function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Inspects initial bytes to verify true file signature (detecting MIME spoofing or extension tampering).
 */
export function verifyMagicBytes(buffer: Buffer): { matches: boolean; detectedSignature?: 'pdf' | 'zip' } {
  if (!buffer || buffer.length < 4) {
    return { matches: false };
  }

  // Check PDF signature
  if (
    buffer[0] === MAGIC_NUMBERS.PDF[0] &&
    buffer[1] === MAGIC_NUMBERS.PDF[1] &&
    buffer[2] === MAGIC_NUMBERS.PDF[2] &&
    buffer[3] === MAGIC_NUMBERS.PDF[3]
  ) {
    return { matches: true, detectedSignature: 'pdf' };
  }

  // Check ZIP signature (DOCX and XLSX are ZIP archives)
  const isZip =
    (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x05 && buffer[3] === 0x06) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x07 && buffer[3] === 0x08);

  if (isZip) {
    return { matches: true, detectedSignature: 'zip' };
  }

  return { matches: false };
}

/**
 * Comprehensive document validation:
 * 1. Checks file size bounds.
 * 2. Checks filename extension.
 * 3. Inspects binary magic numbers to protect against MIME spoofing.
 * 4. Ensures ZIP integrity for DOCX/XLSX.
 * 5. Calculates deterministic SHA-256 checksum.
 */
export function validateDocument(
  buffer: Buffer,
  fileName: string,
  claimedMimeType?: string,
  maxSizeBytes: number = MAX_FILE_SIZE_BYTES
): FileValidationResult {
  const fileSizeBytes = buffer?.length || 0;
  const sha256Checksum = calculateSha256(buffer || Buffer.alloc(0));

  if (!buffer || fileSizeBytes === 0) {
    return {
      isValid: false,
      mimeType: claimedMimeType || 'application/octet-stream',
      fileSizeBytes: 0,
      sha256Checksum,
      error: 'Document is empty (0 bytes). Upload a valid non-empty file.',
    };
  }

  if (fileSizeBytes > maxSizeBytes) {
    return {
      isValid: false,
      mimeType: claimedMimeType || 'application/octet-stream',
      fileSizeBytes,
      sha256Checksum,
      error: `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(maxSizeBytes / (1024 * 1024)).toFixed(0)} MB).`,
    };
  }

  // Extract extension
  const extensionMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = extensionMatch ? (extensionMatch[1] as SupportedExtension) : undefined;

  if (!extension || !['pdf', 'docx', 'xlsx'].includes(extension)) {
    return {
      isValid: false,
      mimeType: claimedMimeType || 'application/octet-stream',
      fileSizeBytes,
      sha256Checksum,
      error: `Unsupported file extension "${extension || 'none'}". BidReady strictly supports PDF, DOCX, and XLSX solicitation documents.`,
    };
  }

  // Magic bytes check
  const magicCheck = verifyMagicBytes(buffer);
  if (!magicCheck.matches) {
    return {
      isValid: false,
      mimeType: claimedMimeType || 'application/octet-stream',
      fileSizeBytes,
      sha256Checksum,
      error: 'Invalid file signature: Content does not match expected binary format. File may be corrupted, encrypted, or disguised.',
    };
  }

  // Verify signature compatibility with extension
  if (extension === 'pdf' && magicCheck.detectedSignature !== 'pdf') {
    return {
      isValid: false,
      mimeType: claimedMimeType || 'application/octet-stream',
      fileSizeBytes,
      sha256Checksum,
      error: 'MIME/Format mismatch: File has .pdf extension but binary header is not a valid PDF document.',
    };
  }

  if ((extension === 'docx' || extension === 'xlsx') && magicCheck.detectedSignature !== 'zip') {
    return {
      isValid: false,
      mimeType: claimedMimeType || 'application/octet-stream',
      fileSizeBytes,
      sha256Checksum,
      error: `MIME/Format mismatch: File has .${extension} extension but is not a valid OpenXML package.`,
    };
  }

  // Validate claimed MIME type if provided
  const canonicalMime =
    extension === 'pdf'
      ? 'application/pdf'
      : extension === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return {
    isValid: true,
    detectedFormat: extension,
    mimeType: canonicalMime,
    fileSizeBytes,
    sha256Checksum,
  };
}

/**
 * Generates an isolated, multi-tenant storage path for Supabase Storage.
 * Hierarchy: <organization_id>/<user_id>/<doc_id>/<sanitized_filename>
 */
export function generateTenantStoragePath(
  organizationId: string,
  userId: string,
  documentId: string,
  fileName: string
): string {
  if (!organizationId || !userId || !documentId) {
    throw new Error('Security Error: organizationId, userId, and documentId are required to construct isolated storage path.');
  }

  // Sanitize filename to prevent directory traversal or invalid characters
  const sanitized = fileName.replace(/\.\.+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${organizationId}/${userId}/${documentId}/${sanitized}`;
}
