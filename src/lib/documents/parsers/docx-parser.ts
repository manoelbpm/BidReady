import { DocumentParser, ParsedDocumentResult, ParsedDocumentSection } from './types';
import { SupportedExtension } from '../validation';

export class DocxParser implements DocumentParser {
  supports(format: SupportedExtension): boolean {
    return format === 'docx';
  }

  async parse(buffer: Buffer): Promise<ParsedDocumentResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');

      // 1. Convert to structured HTML to inspect headings and tables
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const html = htmlResult.value || '';

      // 2. Extract plain text as fallback/verification
      const rawTextResult = await mammoth.extractRawText({ buffer });
      const rawFullText = rawTextResult.value ? rawTextResult.value.trim() : '';

      const sections: ParsedDocumentSection[] = [];
      let currentHeading = 'Document Overview';
      let tableCount = 0;

      // Simple regex-based HTML chunker to extract sections, paragraphs and tables
      const elementRegex = /<(h[1-6]|p|table)[\s\S]*?<\/\1>/gi;
      let match;
      let paragraphIndex = 0;

      while ((match = elementRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();

        // Strip HTML tags for clean text content
        const cleanContent = fullTag
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (tagName.startsWith('h')) {
          currentHeading = cleanContent;
          sections.push({
            paragraphIndex: paragraphIndex++,
            sectionHeading: currentHeading,
            text: cleanContent,
            coordinates: `Section "${currentHeading}"`,
          });
        } else if (tagName === 'table') {
          tableCount++;
          // Parse table rows and cells
          const rows: string[][] = [];
          const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
          let rowMatch;
          while ((rowMatch = rowRegex.exec(fullTag)) !== null) {
            const cells: string[] = [];
            const cellRegex = /<(td|th)[\s\S]*?<\/\1>/gi;
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowMatch[0])) !== null) {
              const cellText = cellMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              cells.push(cellText);
            }
            if (cells.length > 0) rows.push(cells);
          }

          sections.push({
            paragraphIndex: paragraphIndex++,
            sectionHeading: currentHeading,
            text: `[Table ${tableCount}: ${cleanContent}]`,
            isTable: true,
            tableData: rows,
            coordinates: `Table ${tableCount} under "${currentHeading}"`,
          });
        } else if (tagName === 'p' && cleanContent.length > 0) {
          sections.push({
            paragraphIndex: paragraphIndex++,
            sectionHeading: currentHeading,
            text: cleanContent,
            coordinates: `Section "${currentHeading}", Paragraph ${paragraphIndex}`,
          });
        }
      }

      // If HTML chunker didn't produce sections (e.g. non-standard formatting), fallback to rawText paragraphs
      if (sections.length === 0 && rawFullText.length > 0) {
        const paragraphs = rawFullText.split(/\n+/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
        paragraphs.forEach((p: string, idx: number) => {
          sections.push({
            paragraphIndex: idx,
            sectionHeading: idx === 0 ? 'Document Header' : undefined,
            text: p,
            coordinates: `Paragraph ${idx + 1}`,
          });
        });
      }

      return {
        format: 'docx',
        totalCharacters: rawFullText.length,
        requiresOcr: rawFullText.length < 10,
        ocrReason: rawFullText.length < 10 ? 'DOCX contains no extractable body text.' : undefined,
        metadata: {
          tableCount,
          messages: htmlResult.messages || [],
        },
        sections,
        rawFullText,
      };
    } catch (err: any) {
      throw new Error(`Corrupted DOCX Document: Unable to unpack and extract OpenXML wordprocessingML stream (${err?.message || 'Invalid archive'}).`);
    }
  }
}
