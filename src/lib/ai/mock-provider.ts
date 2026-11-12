import { AIProvider, ExtractionRequest, ExtractionResponse } from './types';
import { TenderExtractionResult, TenderExtractionResultSchema } from '../extraction/schemas';

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-tender-engine-v1';

  private simulateFailure = false;
  private failureMessage = 'Simulated AI Extraction Failure for testing.';

  constructor(options?: { simulateFailure?: boolean; failureMessage?: string }) {
    if (options?.simulateFailure) this.simulateFailure = options.simulateFailure;
    if (options?.failureMessage) this.failureMessage = options.failureMessage;
  }

  setSimulateFailure(shouldFail: boolean, message?: string) {
    this.simulateFailure = shouldFail;
    if (message) this.failureMessage = message;
  }

  async extractTender(
    request: ExtractionRequest,
    _options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<ExtractionResponse> {
    const startTime = Date.now();

    if (this.simulateFailure) {
      return {
        success: false,
        provider: this.name,
        modelVersion: this.defaultModel,
        error: this.failureMessage,
        durationMs: Date.now() - startTime,
      };
    }

    const { parsedDocument, fileName, opportunityContext } = request;
    const firstSection = parsedDocument.sections[0] || { text: 'General procurement documentation', coordinates: 'Page 1' };
    const secondSection = parsedDocument.sections[1] || firstSection;

    // Build deterministic structured result referencing real extracted sections
    const rawResult: TenderExtractionResult = {
      executive_summary: `This solicitation document (${fileName}) outlines procurement specifications, compliance thresholds, and delivery milestones. It requires verified capabilities and rigorous adherence to stated deadlines.`,
      opportunity_identification: {
        title: opportunityContext?.title || `Procurement Solicitation: ${fileName.replace(/\.[^/.]+$/, '')}`,
        reference_code: opportunityContext?.referenceCode || 'SOL-2026-BID-001',
        issuing_body: opportunityContext?.buyerName || 'Procurement Authority',
        estimated_value: 2500000,
        currency: 'USD',
      },
      important_dates: [
        {
          title: 'Final Proposal Submission Due Date',
          deadline_type: 'submission',
          due_date: '2026-12-15T17:00:00Z',
          timezone: 'EST',
          description: 'Sealed electronic tender submissions must be uploaded via the designated portal.',
          source_reference: {
            page_number: firstSection.pageNumber || 1,
            section_title: firstSection.sectionHeading || 'Section A - Solicitation Schedule',
            sheet_name: firstSection.sheetName || null,
            coordinates: firstSection.coordinates || 'Section A.1',
            snippet: 'All tenders must be submitted no later than 5:00 PM EST on December 15, 2026.',
            raw_quote: 'Offers must be fully transmitted by 17:00 EST on December 15, 2026.',
          },
          confidence_score: 0.98,
          manual_review_required: false,
        },
        {
          title: 'Questions and Inquiries Cutoff',
          deadline_type: 'questions_clarifications',
          due_date: '2026-11-25T17:00:00Z',
          timezone: 'EST',
          description: 'All clarification inquiries must be submitted in writing.',
          source_reference: {
            page_number: firstSection.pageNumber || 1,
            section_title: 'Clarification Protocols',
            coordinates: 'Section A.3',
            snippet: 'Questions received after November 25, 2026 will not be answered.',
            raw_quote: 'Written questions must arrive prior to November 25, 2026 at 17:00 EST.',
          },
          confidence_score: 0.95,
          manual_review_required: false,
        },
      ],
      mandatory_requirements: [
        {
          category: 'Security & Compliance',
          type: 'mandatory',
          title: 'Information Security Certification (ISO 27001 or SOC 2 Type II)',
          description: 'The contractor must maintain an active third-party audited security certification throughout contract execution.',
          source_reference: {
            page_number: secondSection.pageNumber || 2,
            section_title: secondSection.sectionHeading || 'Section C - Mandatory Technical Criteria',
            sheet_name: secondSection.sheetName || null,
            coordinates: secondSection.coordinates || 'Paragraph 4',
            snippet: 'Proof of ISO 27001 certification or SOC 2 Type II audit report is mandatory.',
            raw_quote: 'Bidders shall provide evidence of current ISO 27001 certification or SOC 2 Type II attestation.',
          },
          confidence_score: 0.97,
          manual_review_required: false,
        },
        {
          category: 'Key Personnel Qualifications',
          type: 'mandatory',
          title: 'Project Lead with Minimum 5 Years Specialized Experience',
          description: 'Designated lead personnel must hold relevant industry certifications and proven delivery track record.',
          source_reference: {
            page_number: secondSection.pageNumber || 2,
            section_title: secondSection.sectionHeading || 'Personnel Thresholds',
            coordinates: secondSection.coordinates || 'Section C.8',
            snippet: 'Key personnel resumes demonstrating at least 5 years experience required.',
            raw_quote: 'The proposed project manager must possess a minimum of five (5) years of continuous domain leadership.',
          },
          confidence_score: 0.92,
          manual_review_required: false,
        },
      ],
      desirable_requirements: [
        {
          category: 'Innovation & Acceleration',
          type: 'desirable',
          title: 'Accelerated Delivery Milestones (Under 90 Days)',
          description: 'Evaluation bonus points awarded for delivery completion schedules ahead of the standard timeline.',
          source_reference: {
            page_number: secondSection.pageNumber || 2,
            section_title: 'Evaluation Preference',
            coordinates: 'Section M.3',
            snippet: 'Delivery schedules completing primary implementation within 90 days receive trade-off advantage.',
            raw_quote: 'Bonus evaluation scoring will be afforded to proposals demonstrating sub-90 day deployment.',
          },
          confidence_score: 0.82,
          manual_review_required: true, // Marked for human review because confidence < 0.85
          review_reason: 'Subjective evaluation criterion with discretionary buyer bonus scoring.',
        },
      ],
      required_documents_and_evidence: [
        {
          title: 'Current Certificate of Commercial Liability Insurance ($5M)',
          category: 'Insurance Certificate',
          description: 'Proof of insurance coverage with buyer named as additional insured.',
          source_reference: {
            page_number: firstSection.pageNumber || 1,
            section_title: 'Insurance Obligations',
            coordinates: 'Clause G.2',
            snippet: 'Certificate of insurance with minimum $5,000,000 coverage required.',
            raw_quote: 'Contractor must submit certificate of insurance with minimum $5,000,000 general liability coverage.',
          },
          confidence_score: 0.96,
          manual_review_required: false,
        },
      ],
      submission_instructions: {
        format_requirements: 'Submissions must be packaged as searchable PDFs. Font size not less than 10pt.',
        submission_channel: 'Electronic upload via the official procurement agency portal.',
        packaging_notes: 'Separate technical proposal and commercial pricing files into distinct volumes.',
        source_reference: {
          page_number: firstSection.pageNumber || 1,
          section_title: 'Submission Guidelines',
          coordinates: 'Section L.1',
          snippet: 'All proposal volumes must be submitted in searchable PDF format.',
          raw_quote: 'Technical and cost proposals must be delivered in separate, unbundled electronic volumes.',
        },
      },
      questions_and_clarifications: {
        deadline: '2026-11-25T17:00:00Z',
        submission_method: 'Email to procurement.officer@agency.gov with subject prefix [SOL-2026-Q]',
        source_reference: {
          page_number: firstSection.pageNumber || 1,
          section_title: 'Inquiries',
          coordinates: 'Section A.3',
          snippet: 'Questions submitted via email with solicitation ID in subject.',
          raw_quote: 'Questions must be transmitted via email to procurement.officer@agency.gov.',
        },
      },
      missing_information: [
        {
          topic: 'Late Submission Grace Period',
          description: 'The solicitation does not state whether electronic transmission delays provide a grace window.',
          suggested_human_action: 'Submit a formal clarification inquiry before the questions cutoff date.',
          is_ambiguity: true,
          source_section: 'Section L - Submission Instructions',
        },
      ],
      human_review_warnings: [
        {
          severity: 'medium',
          item_title: 'Discretionary Trade-Off Desirable Requirement',
          reason: 'Bonus scoring clause contains ambiguous delivery milestone weighting.',
          recommended_action: 'Human review required to determine feasibility of accelerated 90-day delivery timeline.',
        },
      ],
      extraction_metadata: {
        model_provider: this.name,
        model_version: this.defaultModel,
        tokens_consumed: 1450,
        overall_confidence: 0.94,
        extracted_at: new Date().toISOString(),
      },
    };

    // Validate through Zod schema to guarantee contract
    const parsed = TenderExtractionResultSchema.parse(rawResult);

    return {
      success: true,
      provider: this.name,
      modelVersion: this.defaultModel,
      result: parsed,
      tokensUsed: {
        promptTokens: 850,
        completionTokens: 600,
        totalTokens: 1450,
      },
      durationMs: Date.now() - startTime,
    };
  }
}
