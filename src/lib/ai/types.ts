import { TenderExtractionResult } from '../extraction/schemas';
import { ParsedDocumentResult } from '../documents/parsers/types';

export interface ExtractionRequest {
  documentId: string;
  fileName: string;
  parsedDocument: ParsedDocumentResult;
  opportunityContext?: {
    title?: string;
    referenceCode?: string;
    buyerName?: string;
  };
}

export interface ExtractionResponse {
  success: boolean;
  provider: string;
  modelVersion: string;
  pricingTier?: string;
  result?: TenderExtractionResult;
  error?: string;
  tokensUsed?: {
    promptTokens?: number;
    completionTokens?: number;
    thoughtsTokens?: number;
    totalTokens?: number;
  };
  estimatedCostUsd?: number;
  referenceCostUsd?: number;
  isFreeTier?: boolean;
  durationMs: number;
}

export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;

  extractTender(
    request: ExtractionRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<ExtractionResponse>;
}
