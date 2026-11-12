import { DocumentParser, ParsedDocumentResult } from './types';
import { SupportedExtension } from '../validation';
import { PdfParser } from './pdf-parser';
import { DocxParser } from './docx-parser';
import { XlsxParser } from './xlsx-parser';

export * from './types';

const parsers: DocumentParser[] = [
  new PdfParser(),
  new DocxParser(),
  new XlsxParser(),
];

export async function parseDocument(
  buffer: Buffer,
  format: SupportedExtension
): Promise<ParsedDocumentResult> {
  const selectedParser = parsers.find((p) => p.supports(format));

  if (!selectedParser) {
    throw new Error(`No parser registered for document format "${format}".`);
  }

  return await selectedParser.parse(buffer);
}
