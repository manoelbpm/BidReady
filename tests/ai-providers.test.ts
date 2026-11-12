import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockAIProvider } from '../src/lib/ai/mock-provider';
import { GeminiAIProvider } from '../src/lib/ai/gemini-provider';
import { executeExtractionWithRetry, getAIProvider } from '../src/lib/ai/factory';
import { ExtractionRequest } from '../src/lib/ai/types';
import { TenderExtractionResultSchema } from '../src/lib/extraction/schemas';

describe('AI Provider Abstraction & Extraction Engine Tests', () => {
  const dummyRequest: ExtractionRequest = {
    documentId: 'doc-123',
    fileName: 'RFP-Synthetic-2026.pdf',
    parsedDocument: {
      format: 'pdf',
      totalCharacters: 800,
      totalPages: 3,
      requiresOcr: false,
      metadata: {},
      sections: [
        {
          pageNumber: 1,
          paragraphIndex: 0,
          sectionHeading: 'Section A - Schedule',
          text: 'Proposal submission deadline is December 15, 2026.',
          coordinates: 'Page 1, Paragraph 1',
        },
        {
          pageNumber: 2,
          paragraphIndex: 1,
          sectionHeading: 'Section C - Technical Criteria',
          text: 'Offeror must hold current ISO 27001 certification.',
          coordinates: 'Page 2, Paragraph 2',
        },
      ],
      rawFullText: 'Proposal submission deadline is December 15, 2026. Offeror must hold ISO 27001.',
    },
    opportunityContext: {
      title: 'Autonomous Radar Modernization',
      referenceCode: 'RFP-2026-001',
      buyerName: 'Federal Aviation Administration',
    },
  };

  it('Mock provider produces compliant structured tender extraction matching Zod schema', async () => {
    const provider = new MockAIProvider();
    const response = await provider.extractTender(dummyRequest);

    expect(response.success).toBe(true);
    expect(response.provider).toBe('mock');
    expect(response.result).toBeDefined();

    // Verify Zod schema compliance
    const validation = TenderExtractionResultSchema.safeParse(response.result);
    expect(validation.success).toBe(true);

    // Verify traceability coordinates
    const mandatory = response.result!.mandatory_requirements[0];
    expect(mandatory.source_reference.page_number).toBeDefined();
    expect(mandatory.source_reference.raw_quote).toBeTruthy();
    expect(mandatory.confidence_score).toBeGreaterThan(0.8);
  });

  it('flags desirable requirement for human review when confidence is below 0.85', async () => {
    const provider = new MockAIProvider();
    const response = await provider.extractTender(dummyRequest);

    const desirable = response.result!.desirable_requirements.find(
      (r) => r.confidence_score < 0.85
    );
    expect(desirable).toBeDefined();
    expect(desirable?.manual_review_required).toBe(true);
    expect(desirable?.review_reason).toBeDefined();
  });

  it('distinguishes missing information from unextracted data', async () => {
    const provider = new MockAIProvider();
    const response = await provider.extractTender(dummyRequest);

    expect(response.result!.missing_information.length).toBeGreaterThan(0);
    const missing = response.result!.missing_information[0];
    expect(missing.topic).toBeTruthy();
    expect(missing.suggested_human_action).toBeTruthy();
  });

  it('executeExtractionWithRetry retries on transient errors and succeeds within bounded limit', async () => {
    const mockProvider = new MockAIProvider();
    let calls = 0;

    // Simulate failure on first 2 calls, success on 3rd
    vi.spyOn(mockProvider, 'extractTender').mockImplementation(async () => {
      calls++;
      if (calls < 3) {
        return {
          success: false,
          provider: 'mock',
          modelVersion: 'test',
          error: 'Transient upstream rate limit (429)',
          durationMs: 10,
        };
      }
      return {
        success: true,
        provider: 'mock',
        modelVersion: 'test',
        result: (await new MockAIProvider().extractTender(dummyRequest)).result,
        durationMs: 10,
      };
    });

    const result = await executeExtractionWithRetry(mockProvider, dummyRequest, {
      maxAttempts: 3,
      initialDelayMs: 10,
      backoffMultiplier: 1.5,
    });

    expect(calls).toBe(3);
    expect(result.success).toBe(true);
  });

  it('fails cleanly when provider exceeds max bounded retry attempts', async () => {
    const failingProvider = new MockAIProvider({
      simulateFailure: true,
      failureMessage: 'Unrecoverable API quota exceeded.',
    });

    const result = await executeExtractionWithRetry(failingProvider, dummyRequest, {
      maxAttempts: 2,
      initialDelayMs: 5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unrecoverable API quota exceeded');
  });

  describe('Gemini Provider HTTP Mocking', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('handles simulated Gemini API success response', async () => {
      const mockGeminiJson = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    executive_summary: 'Gemini extracted executive summary with high fidelity.',
                    opportunity_identification: {
                      title: 'Live Procurement Test',
                      reference_code: 'RFP-GEMINI-01',
                      issuing_body: 'Department of Energy',
                      estimated_value: 1000000,
                      currency: 'USD',
                    },
                    important_dates: [],
                    mandatory_requirements: [],
                    desirable_requirements: [],
                    required_documents_and_evidence: [],
                    submission_instructions: {
                      format_requirements: 'PDF only',
                      submission_channel: 'Portal',
                    },
                    questions_and_clarifications: {},
                    missing_information: [],
                    human_review_warnings: [],
                    extraction_metadata: {
                      model_provider: 'gemini',
                      model_version: 'gemini-1.5-pro',
                      overall_confidence: 0.96,
                    },
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 300,
          totalTokenCount: 800,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGeminiJson,
      } as any);

      const geminiProvider = new GeminiAIProvider('fake-test-key');
      const response = await geminiProvider.extractTender(dummyRequest);

      expect(response.success).toBe(true);
      expect(response.provider).toBe('gemini');
      expect(response.tokensUsed?.totalTokens).toBe(800);
      expect(response.result?.opportunity_identification.title).toBe('Live Procurement Test');
    });

    it('reports missing API key with clear instructions without crashing', async () => {
      const geminiProvider = new GeminiAIProvider('');
      const response = await geminiProvider.extractTender(dummyRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Missing GEMINI_API_KEY');
    });
  });
});
