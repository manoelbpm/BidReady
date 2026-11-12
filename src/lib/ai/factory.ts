import { AIProvider, ExtractionRequest, ExtractionResponse } from './types';
import { MockAIProvider } from './mock-provider';
import { GeminiAIProvider } from './gemini-provider';
import { AnthropicAIProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';

export function getAIProvider(providerName?: string): AIProvider {
  const selected = (providerName || process.env.AI_DEFAULT_PROVIDER || 'mock').toLowerCase();

  switch (selected) {
    case 'gemini':
      return new GeminiAIProvider();
    case 'anthropic':
    case 'claude':
      return new AnthropicAIProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'mock':
    default:
      return new MockAIProvider();
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
}

/**
 * Executes AI extraction with bounded retries, exponential backoff, and timeouts.
 */
export async function executeExtractionWithRetry(
  provider: AIProvider,
  request: ExtractionRequest,
  options?: RetryOptions
): Promise<ExtractionResponse> {
  const maxAttempts = options?.maxAttempts || 3;
  const initialDelay = options?.initialDelayMs || 200;
  const multiplier = options?.backoffMultiplier || 2;
  const timeoutMs = options?.timeoutMs || 45000;

  let lastResponse: ExtractionResponse | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await provider.extractTender(request, { timeoutMs });
      if (response.success) {
        return response;
      }
      lastResponse = response;
    } catch (err: any) {
      lastResponse = {
        success: false,
        provider: provider.name,
        modelVersion: provider.defaultModel,
        error: `Unexpected Provider Error (Attempt ${attempt}/${maxAttempts}): ${err?.message}`,
        durationMs: 0,
      };
    }

    // If we have more attempts, wait with exponential backoff
    if (attempt < maxAttempts) {
      const delay = initialDelay * Math.pow(multiplier, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return (
    lastResponse || {
      success: false,
      provider: provider.name,
      modelVersion: provider.defaultModel,
      error: `Extraction failed after ${maxAttempts} bounded retry attempts.`,
      durationMs: 0,
    }
  );
}
