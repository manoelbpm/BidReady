import { AIProvider, ExtractionRequest, ExtractionResponse } from './types';
import { TenderExtractionResultSchema } from '../extraction/schemas';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o';

  private apiKey: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.endpoint = endpoint || 'https://api.openai.com/v1/chat/completions';
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
        error: 'Missing OPENAI_API_KEY: Set environment variable to enable live OpenAI extraction.',
        durationMs: Date.now() - startTime,
      };
    }

    const timeout = options?.timeoutMs || 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const systemPrompt = `You are BidReady AI, an expert tender extraction engine.
CRITICAL RULES:
1. NEVER invent requirements, qualifications, pricing, certifications, or past performance.
2. Every extracted item MUST cite its exact source page, section title, and literal quotation.
3. If information is missing from the document, explicitly record it under missing_information.
4. Return strictly a JSON object.`;

      const documentExcerpt = request.parsedDocument.sections
        .slice(0, 100)
        .map((s) => `[${s.coordinates || `Section: ${s.sectionHeading || 'Body'}`}]\n${s.text}`)
        .join('\n\n');

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.defaultModel,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Analyze this tender file (${request.fileName}) and generate the complete JSON extraction result:\n\n${documentExcerpt}`,
            },
          ],
        }),
        signal: options?.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: this.name,
          modelVersion: this.defaultModel,
          error: `OpenAI API HTTP Error (${response.status}): ${errText}`,
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content;

      if (!rawText) {
        return {
          success: false,
          provider: this.name,
          modelVersion: this.defaultModel,
          error: 'Empty response payload received from OpenAI API.',
          durationMs: Date.now() - startTime,
        };
      }

      const parsedJson = JSON.parse(rawText);
      const validatedResult = TenderExtractionResultSchema.parse({
        ...parsedJson,
        extraction_metadata: {
          model_provider: this.name,
          model_version: this.defaultModel,
          tokens_consumed: data.usage?.total_tokens || 0,
          overall_confidence: parsedJson.extraction_metadata?.overall_confidence || 0.95,
          extracted_at: new Date().toISOString(),
        },
      });

      return {
        success: true,
        provider: this.name,
        modelVersion: this.defaultModel,
        result: validatedResult,
        tokensUsed: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err?.name === 'AbortError' || controller.signal.aborted;
      return {
        success: false,
        provider: this.name,
        modelVersion: this.defaultModel,
        error: isAbort ? `OpenAI API call timed out after ${timeout}ms.` : `OpenAI Error: ${err?.message}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
