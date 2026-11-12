import { DocumentParser, ParsedDocumentResult, ParsedDocumentSection } from './types';
import { SupportedExtension } from '../validation';

export class PdfParser implements DocumentParser {
  supports(format: SupportedExtension): boolean {
    return format === 'pdf';
  }

  async parse(buffer: Buffer): Promise<ParsedDocumentResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfModule = require('pdf-parse');

      let fullText = '';
      let totalPages = 1;
      let pageTexts: Array<{ text: string; num: number }> = [];
      let pdfInfo: any = {};

      if (pdfModule?.PDFParse) {
        // Modern Class-based API
        const instance = new pdfModule.PDFParse({ data: buffer });
        await instance.load();
        const textResult = await instance.getText();
        const infoResult = await instance.getInfo();

        fullText = textResult?.text ? textResult.text.trim() : '';
        totalPages = textResult?.total || 1;
        if (Array.isArray(textResult?.pages)) {
          pageTexts = textResult.pages;
        }
        pdfInfo = infoResult?.info || {};

        if (typeof instance.destroy === 'function') {
          await instance.destroy();
        }
      } else if (typeof pdfModule === 'function') {
        // Legacy function API
        const data = await pdfModule(buffer);
        fullText = data?.text ? data.text.trim() : '';
        totalPages = data?.numpages || 1;
        pdfInfo = data?.info || {};
      } else {
        throw new Error('Unsupported pdf-parse module format.');
      }

      // Clean fullText from artificial page marker strings like "-- 1 of 1 --"
      const cleanedFullText = fullText
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
        .trim();

      const totalCharacters = cleanedFullText.length;
      const averageCharsPerPage = totalPages > 0 ? totalCharacters / totalPages : 0;

      // Scanned PDF detection heuristic: virtually no characters or very low ratio per page
      const requiresOcr = totalCharacters < 50 || averageCharsPerPage < 30;
      const ocrReason = requiresOcr
        ? `Scanned document detected: PDF contains minimal or no extractable text layer (${totalCharacters} characters across ${totalPages} pages). Document appears to be a scanned image or raster PDF requiring Optical Character Recognition (OCR) before it can be processed. BidReady processes native digital text documents (PDF with text layer, DOCX, XLSX). Please upload a searchable PDF or Word/Excel document.`
        : undefined;

      const sections: ParsedDocumentSection[] = [];

      if (pageTexts.length > 0) {
        pageTexts.forEach((p) => {
          const pageNum = p.num || 1;
          const cleanPageText = (p.text || '')
            .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
            .trim();

          const paragraphs = cleanPageText
            .split(/\n\s*\n/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          if (paragraphs.length === 0 && cleanPageText.length > 0) {
            sections.push({
              pageNumber: pageNum,
              paragraphIndex: 0,
              text: cleanPageText,
              coordinates: `Page ${pageNum}, Full Content`,
            });
          } else {
            paragraphs.forEach((paragraph, pIdx) => {
              const isHeading = paragraph.length < 80 && !paragraph.endsWith('.');
              sections.push({
                pageNumber: pageNum,
                paragraphIndex: pIdx,
                sectionHeading: isHeading ? paragraph : undefined,
                text: paragraph,
                coordinates: `Page ${pageNum}, Paragraph ${pIdx + 1}`,
              });
            });
          }
        });
      } else if (cleanedFullText.length > 0) {
        sections.push({
          pageNumber: 1,
          paragraphIndex: 0,
          text: cleanedFullText,
          coordinates: 'Page 1, Main Content',
        });
      }

      return {
        format: 'pdf',
        totalCharacters,
        totalPages,
        requiresOcr,
        ocrReason,
        metadata: {
          info: pdfInfo,
          totalPages,
        },
        sections,
        rawFullText: cleanedFullText,
      };
    } catch (err: any) {
      if (err?.name === 'PasswordException' || err?.message?.includes('password')) {
        throw new Error('Encrypted Document: The PDF is password protected and cannot be extracted without the decryption key.');
      }
      throw new Error(`Corrupted PDF Document: Failed to parse PDF binary stream (${err?.message || 'Invalid structure'}).`);
    }
  }
}
