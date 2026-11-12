import { SupportedExtension } from '../validation';

export interface ParsedDocumentSection {
  pageNumber?: number;         // For PDF
  sheetName?: string;          // For XLSX
  sectionHeading?: string;     // For DOCX / Headings
  paragraphIndex: number;
  text: string;
  isTable?: boolean;
  tableData?: string[][];      // Matrix for tabular data
  coordinates?: string;        // e.g. "Row 3, Col B" or "Page 4, Paragraph 2"
}

export interface ParsedDocumentResult {
  format: SupportedExtension;
  totalCharacters: number;
  totalPages?: number;
  requiresOcr: boolean;
  ocrReason?: string;
  metadata: {
    title?: string;
    author?: string;
    sheetCount?: number;
    tableCount?: number;
    [key: string]: unknown;
  };
  sections: ParsedDocumentSection[];
  rawFullText: string;
}

export interface DocumentParser {
  supports(format: SupportedExtension): boolean;
  parse(buffer: Buffer): Promise<ParsedDocumentResult>;
}
