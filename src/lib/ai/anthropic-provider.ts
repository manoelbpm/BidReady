import { AIProvider, ExtractionRequest, ExtractionResponse } from './types';
import { TenderExtractionResultSchema } from '../extraction/schemas';

export class AnthropicAIProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-3-5-sonnet-20241022';

  private apiKey: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.endpoint = endpoint || 'https://api.anthropic.com/v1/messages';
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
        error: 'Missing ANTHROPIC_API_KEY: Set environment variable to enable live Anthropic extraction.',
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
4. Output strictly valid JSON matching the required tender schema. Do not include markdown codeblocks.`;

      const documentExcerpt = request.parsedDocument.sections
        .slice(0, 100)
        .map((s) => `[${s.coordinates || `Section: ${s.sectionHeading || 'Body'}`}]\n${s.text}`)
        .join('\n\n');

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 4096,
          temperature: 0.1,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Analyze this tender file (${request.fileName}) and output the complete JSON extraction result:\n\n${documentExcerpt}`,
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
          error: `Anthropic API HTTP Error (${response.status}): ${errText}`,
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text;

      if (!rawText) {
        return {
          success: false,
          provider: this.name,
          modelVersion: this.defaultModel,
          error: 'Empty response payload received from Anthropic API.',
          durationMs: Date.now() - startTime,
        };
      }

      const cleanJsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedJson = JSON.parse(cleanJsonString);

      const validatedResult = TenderExtractionResultSchema.parse({
        ...parsedJson,
        extraction_metadata: {
          model_provider: this.name,
          model_version: this.defaultModel,
          tokens_consumed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
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
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
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
        error: isAbort ? `Anthropic API call timed out after ${timeout}ms.` : `Anthropic Error: ${err?.message}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
