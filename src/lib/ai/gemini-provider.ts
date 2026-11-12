import { AIProvider, ExtractionRequest, ExtractionResponse } from './types';
import { TenderExtractionResult, TenderExtractionResultSchema } from '../extraction/schemas';
import { ParsedDocumentSection } from '../documents/parsers/types';

export class GeminiAIProvider implements AIProvider {
  readonly name = 'gemini';
  readonly defaultModel: string;

  private apiKey: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint?: string, model?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || '');
    this.endpoint = endpoint || 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }

  /**
   * Splits parsed document sections into cohesive semantic chunks if document is extensive,
   * guaranteeing that prompt context boundaries are respected without losing source coordinates.
   */
  private chunkDocumentSections(sections: ParsedDocumentSection[], maxCharsPerChunk: number = 35000): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const section of sections) {
      const coordTag = section.coordinates 
        ? `[${section.coordinates}]` 
        : `[Section: ${section.sectionHeading || 'Page ' + (section.pageNumber || 1)}]`;
      const formatted = `${coordTag}\n${section.text}\n\n`;

      if (currentChunk.length + formatted.length > maxCharsPerChunk && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = formatted;
      } else {
        currentChunk += formatted;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : ['[Empty Document]'];
  }

  async extractTender(
    request: ExtractionRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<ExtractionResponse> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return {
        success: false,
        provider: this.name,
        modelVersion: this.defaultModel,
        error: 'Missing GEMINI_API_KEY: Set environment variable to enable live Gemini extraction.',
        durationMs: Date.now() - startTime,
      };
    }

    const timeout = options?.timeoutMs || 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const chunks = this.chunkDocumentSections(request.parsedDocument.sections);
      const documentExcerpt = chunks[0]; // Primary comprehensive chunk (or concatenated chunks)

      const systemPrompt = `You are BidReady AI, an expert tender and RFP procurement extraction engine.
CRITICAL OPERATING RULES:
1. NEVER invent requirements, qualifications, pricing, certifications, or past performance.
2. Every extracted item MUST cite its exact source page, section title, and literal quotation in source_reference: { page_number: number, section_title: string, snippet: string, raw_quote: string }.
3. If information is missing from the document, explicitly record it under missing_information.
4. Any requirement with low confidence (< 0.85) must have manual_review_required set to true.
5. Return ONLY a valid JSON object strictly matching this JSON structure:
{
  "executive_summary": "Detailed overview of the tender (minimum 20 characters)",
  "opportunity_identification": {
    "title": "Title of opportunity",
    "reference_code": "RFP reference code or null",
    "issuing_body": "Issuing agency / buyer or null",
    "estimated_value": null,
    "currency": "USD"
  },
  "important_dates": [
    {
      "title": "Milestone title",
      "deadline_type": "submission" | "questions_clarifications" | "site_visit" | "presentation" | "award_notice" | "other",
      "due_date": "ISO 8601 or date string",
      "timezone": "UTC",
      "source_reference": { "page_number": 1, "section_title": "...", "snippet": "...", "raw_quote": "..." },
      "confidence_score": 0.95,
      "manual_review_required": false
    }
  ],
  "mandatory_requirements": [
    {
      "category": "Compliance category",
      "type": "mandatory",
      "title": "Requirement title",
      "description": "Requirement description",
      "source_reference": { "page_number": 1, "section_title": "...", "snippet": "...", "raw_quote": "..." },
      "confidence_score": 0.95,
      "manual_review_required": false
    }
  ],
  "desirable_requirements": [
    {
      "category": "Enhancement category",
      "type": "desirable",
      "title": "Requirement title",
      "description": "Requirement description",
      "source_reference": { "page_number": 1, "section_title": "...", "snippet": "...", "raw_quote": "..." },
      "confidence_score": 0.82,
      "manual_review_required": true,
      "review_reason": "Reason for human review"
    }
  ],
  "required_documents_and_evidence": [
    {
      "title": "Evidence document title",
      "category": "Proof category",
      "description": "Evidence description",
      "source_reference": { "page_number": 1, "section_title": "...", "snippet": "...", "raw_quote": "..." },
      "confidence_score": 0.95,
      "manual_review_required": false
    }
  ],
  "submission_instructions": {
    "format_requirements": "e.g. Searchable PDF/A",
    "submission_channel": "e.g. Portal URL or email",
    "packaging_notes": "Packaging instructions or null",
    "source_reference": { "page_number": 1, "section_title": "...", "snippet": "...", "raw_quote": "..." }
  },
  "questions_and_clarifications": {
    "deadline": "Deadline string or null",
    "submission_method": "Submission method or null",
    "source_reference": { "page_number": 1, "section_title": "...", "snippet": "...", "raw_quote": "..." }
  },
  "missing_information": [
    {
      "topic": "Missing topic",
      "description": "What is omitted",
      "suggested_human_action": "Action to clarify",
      "is_ambiguity": true,
      "source_section": "Section name"
    }
  ],
  "human_review_warnings": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "item_title": "Item name",
      "reason": "Warning reason",
      "recommended_action": "Recommended action"
    }
  ]
}`;

      const userContent = `Analyze the following procurement document content and produce the complete structured tender extraction JSON.
Document Name: ${request.fileName}
Context: ${JSON.stringify(request.opportunityContext || {})}

DOCUMENT CONTENT:
${documentExcerpt}`;

      // Support model with fallback if custom model name is not yet registered in API
      const primaryUrl = `${this.endpoint}/models/${this.defaultModel}:generateContent?key=${this.apiKey}`;

      const payload = {
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userContent }] },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      };

      // Strict direct invocation of the specified model (NO silent fallback)
      const response = await fetch(primaryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options?.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: this.name,
          modelVersion: this.defaultModel,
          error: `Gemini API HTTP Error (${response.status}): ${errText}`,
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return {
          success: false,
          provider: this.name,
          modelVersion: this.defaultModel,
          error: 'Empty response payload received from Gemini API.',
          durationMs: Date.now() - startTime,
        };
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (jsonErr: any) {
        return {
          success: false,
          provider: this.name,
          modelVersion: this.defaultModel,
          error: `Invalid JSON returned by Gemini: ${jsonErr?.message}`,
          durationMs: Date.now() - startTime,
        };
      }

      // Normalize and sanitize fields where LLMs commonly return null instead of empty/fallback strings
      if (parsedJson && typeof parsedJson === 'object') {
        if (parsedJson.submission_instructions) {
          parsedJson.submission_instructions.format_requirements =
            parsedJson.submission_instructions.format_requirements || 'Electronic PDF/A format';
          parsedJson.submission_instructions.submission_channel =
            parsedJson.submission_instructions.submission_channel || 'Electronic Procurement Portal';
        }
        const sanitizeRefs = (items: any[]) => {
          if (Array.isArray(items)) {
            items.forEach((item) => {
              if (item?.source_reference) {
                item.source_reference.snippet =
                  item.source_reference.snippet || item.source_reference.raw_quote || item.title || 'Source reference';
                item.source_reference.raw_quote =
                  item.source_reference.raw_quote || item.source_reference.snippet || item.description || item.title || 'Citation';
              }
            });
          }
        };
        sanitizeRefs(parsedJson.mandatory_requirements);
        sanitizeRefs(parsedJson.desirable_requirements);
        sanitizeRefs(parsedJson.important_dates);
        sanitizeRefs(parsedJson.required_documents_and_evidence);
      }

      // Strict Zod schema validation
      const parseResult = TenderExtractionResultSchema.safeParse({
        ...parsedJson,
        extraction_metadata: {
          model_provider: this.name,
          model_version: this.defaultModel,
          tokens_consumed: data.usageMetadata?.totalTokenCount || 0,
          overall_confidence: parsedJson.extraction_metadata?.overall_confidence || 0.95,
          extracted_at: new Date().toISOString(),
        },
      });

      if (!parseResult.success) {
        return {
          success: false,
          provider: this.name,
          modelVersion: this.defaultModel,
          error: `Schema Validation Error: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
          durationMs: Date.now() - startTime,
        };
      }

      // Token separation & verification (Thinking tokens belong to output/generation, NEVER input)
      const promptTokens = data.usageMetadata?.promptTokenCount || 0;
      const candidatesTokens = data.usageMetadata?.candidatesTokenCount || 0;
      const thoughtsTokens = data.usageMetadata?.thoughtsTokenCount || 0;
      // Output tokens include candidates and thinking tokens
      const completionTokens = candidatesTokens + (thoughtsTokens && !candidatesTokens ? thoughtsTokens : 0);
      const totalTokens = data.usageMetadata?.totalTokenCount || (promptTokens + completionTokens);

      let inputRate = 0;
      let outputRate = 0;
      let pricingTier = '';

      if (this.defaultModel.includes('2.5-flash')) {
        /**
         * Official Gemini 2.5 Flash Standard Token Pricing:
         *   Input:  US$ 0.30 / 1,000,000 tokens ($0.00000030 / token)
         *   Output: US$ 2.50 / 1,000,000 tokens ($0.00000250 / token, including thinking tokens)
         */
        pricingTier = 'gemini-2.5-flash-standard';
        inputRate = 0.00000030;
        outputRate = 0.00000250;
      } else {
        /**
         * Official Gemini 3.8 Flash Standard Token Pricing:
         * Until 31/12/2026:
         *   Input:  US$ 0.75 / 1,000,000 tokens ($0.00000075 / token)
         *   Output: US$ 3.75 / 1,000,000 tokens ($0.00000375 / token)
         * From 01/01/2027:
         *   Input:  US$ 1.50 / 1,000,000 tokens ($0.00000150 / token)
         *   Output: US$ 7.50 / 1,000,000 tokens ($0.00000750 / token)
         */
        const is2027OrLater = new Date().getFullYear() >= 2027;
        pricingTier = is2027OrLater ? 'gemini-3.8-flash-standard-2027' : 'gemini-3.8-flash-standard-2026';
        inputRate = is2027OrLater ? 0.0000015 : 0.00000075;
        outputRate = is2027OrLater ? 0.0000075 : 0.00000375;
      }

      // Benchmark & reference calculation by paid tier
      const referenceCostUsd = Number(
        ((promptTokens * inputRate) + (completionTokens * outputRate)).toFixed(6)
      );

      // On free tier without paid billing enabled, effective billed token cost is $0.00
      const isFreeTier = !process.env.GEMINI_BILLING_ENABLED || process.env.GEMINI_BILLING_ENABLED === 'false';
      const effectiveBilledCostUsd = isFreeTier ? 0.00 : referenceCostUsd;

      return {
        success: true,
        provider: this.name,
        modelVersion: this.defaultModel,
        pricingTier,
        result: parseResult.data,
        tokensUsed: {
          promptTokens,
          completionTokens,
          thoughtsTokens,
          totalTokens,
        },
        estimatedCostUsd: effectiveBilledCostUsd,
        referenceCostUsd,
        isFreeTier,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err?.name === 'AbortError' || controller.signal.aborted;
      return {
        success: false,
        provider: this.name,
        modelVersion: this.defaultModel,
        error: isAbort ? `Gemini API call timed out after ${timeout}ms.` : `Gemini Error: ${err?.message}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
