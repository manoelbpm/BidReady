import { DocumentParser, ParsedDocumentResult, ParsedDocumentSection } from './types';
import { SupportedExtension } from '../validation';

export class XlsxParser implements DocumentParser {
  supports(format: SupportedExtension): boolean {
    return format === 'xlsx';
  }

  async parse(buffer: Buffer): Promise<ParsedDocumentResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx');

      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetNames: string[] = workbook.SheetNames || [];

      if (sheetNames.length === 0) {
        return {
          format: 'xlsx',
          totalCharacters: 0,
          requiresOcr: false,
          metadata: { sheetCount: 0 },
          sections: [],
          rawFullText: '',
        };
      }

      const sections: ParsedDocumentSection[] = [];
      let fullText = '';
      let paragraphIndex = 0;

      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        // Convert worksheet to matrix (array of arrays)
        const rows: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });

        if (rows.length === 0) continue;

        // Convert rows to string matrix
        const stringMatrix: string[][] = rows.map((r) =>
          r.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : ''))
        );

        // Filter out completely blank rows
        const nonEmptyRows = stringMatrix.filter((r) => r.some((c) => c.length > 0));

        if (nonEmptyRows.length === 0) continue;

        // Format worksheet content as formatted tabular text
        const sheetTextRepresentation = nonEmptyRows
          .map((row, rIdx) => `[Row ${rIdx + 1}] ` + row.filter((c) => c.length > 0).join(' | '))
          .join('\n');

        fullText += `\n--- Worksheet: ${sheetName} ---\n` + sheetTextRepresentation + '\n';

        // Add section for the entire table
        sections.push({
          sheetName,
          paragraphIndex: paragraphIndex++,
          sectionHeading: `Worksheet "${sheetName}"`,
          text: sheetTextRepresentation,
          isTable: true,
          tableData: nonEmptyRows,
          coordinates: `Sheet "${sheetName}", Rows 1-${nonEmptyRows.length}`,
        });

        // Add discrete row entries for granular row-level citation
        nonEmptyRows.forEach((row, rIdx) => {
          const rowText = row.filter((c) => c.length > 0).join(' | ');
          if (rowText.length > 0) {
            sections.push({
              sheetName,
              paragraphIndex: paragraphIndex++,
              sectionHeading: `Worksheet "${sheetName}"`,
              text: rowText,
              coordinates: `Sheet "${sheetName}", Row ${rIdx + 1}`,
            });
          }
        });
      }

      const totalCharacters = fullText.length;

      return {
        format: 'xlsx',
        totalCharacters,
        requiresOcr: totalCharacters < 10,
        ocrReason: totalCharacters < 10 ? 'XLSX workbook contains no non-empty rows or cells.' : undefined,
        metadata: {
          sheetCount: sheetNames.length,
          sheetNames,
        },
        sections,
        rawFullText: fullText.trim(),
      };
    } catch (err: any) {
      throw new Error(`Corrupted XLSX Document: Unable to parse OpenXML spreadsheet package (${err?.message || 'Invalid format'}).`);
    }
  }
}
