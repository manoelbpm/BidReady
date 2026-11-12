import { z } from 'zod';

export const SourceReferenceSchema = z.object({
  page_number: z.number().int().positive().nullable().optional(),
  section_title: z.string().nullable().optional(),
  sheet_name: z.string().nullable().optional(),
  coordinates: z.string().nullable().optional(),
  snippet: z.string().min(1),
  raw_quote: z.string().min(1),
});

export type ExtractedSourceReference = z.infer<typeof SourceReferenceSchema>;

export const ExtractedRequirementSchema = z.object({
  id: z.string().optional(),
  category: z.string().default('General Compliance'),
  type: z.enum(['mandatory', 'desirable']),
  title: z.string().min(3),
  description: z.string().min(10),
  source_reference: SourceReferenceSchema,
  confidence_score: z.number().min(0).max(1),
  manual_review_required: z.boolean(),
  review_reason: z.string().nullable().optional(),
});

export type ExtractedRequirement = z.infer<typeof ExtractedRequirementSchema>;

export const ExtractedDeadlineSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3),
  deadline_type: z.enum([
    'submission',
    'questions_clarifications',
    'site_visit',
    'presentation',
    'award_notice',
    'other',
  ]),
  due_date: z.string(), // ISO 8601 or normalized date string
  timezone: z.string().default('UTC'),
  description: z.string().nullable().optional(),
  source_reference: SourceReferenceSchema.nullable().optional(),
  confidence_score: z.number().min(0).max(1),
  manual_review_required: z.boolean().default(false),
});

export type ExtractedDeadline = z.infer<typeof ExtractedDeadlineSchema>;

export const RequiredEvidenceSchema = z.object({
  title: z.string().min(3),
  category: z.string().default('Certification / Proof'),
  description: z.string(),
  source_reference: SourceReferenceSchema.nullable().optional(),
  confidence_score: z.number().min(0).max(1),
  manual_review_required: z.boolean().default(false),
});

export type RequiredEvidence = z.infer<typeof RequiredEvidenceSchema>;

export const MissingInformationSchema = z.object({
  topic: z.string().min(3),
  description: z.string(),
  suggested_human_action: z.string(),
  is_ambiguity: z.boolean().default(false),
  source_section: z.string().nullable().optional(),
});

export type MissingInformation = z.infer<typeof MissingInformationSchema>;

export const HumanReviewWarningSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  item_title: z.string(),
  reason: z.string(),
  recommended_action: z.string(),
});

export type HumanReviewWarning = z.infer<typeof HumanReviewWarningSchema>;

export const TenderExtractionResultSchema = z.object({
  executive_summary: z.string().min(20),
  opportunity_identification: z.object({
    title: z.string().min(3),
    reference_code: z.string().nullable().optional(),
    issuing_body: z.string().nullable().optional(),
    estimated_value: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
  }),
  important_dates: z.array(ExtractedDeadlineSchema),
  mandatory_requirements: z.array(ExtractedRequirementSchema),
  desirable_requirements: z.array(ExtractedRequirementSchema),
  required_documents_and_evidence: z.array(RequiredEvidenceSchema),
  submission_instructions: z.object({
    format_requirements: z.string(),
    submission_channel: z.string(), // e.g. "Portal URL", "Physical courier", "Email"
    packaging_notes: z.string().nullable().optional(),
    source_reference: SourceReferenceSchema.nullable().optional(),
  }),
  questions_and_clarifications: z.object({
    deadline: z.string().nullable().optional(),
    submission_method: z.string().nullable().optional(),
    source_reference: SourceReferenceSchema.nullable().optional(),
  }),
  missing_information: z.array(MissingInformationSchema),
  human_review_warnings: z.array(HumanReviewWarningSchema),
  extraction_metadata: z.object({
    model_provider: z.string(),
    model_version: z.string(),
    tokens_consumed: z.number().optional(),
    overall_confidence: z.number().min(0).max(1),
    extracted_at: z.string(),
  }),
});

export type TenderExtractionResult = z.infer<typeof TenderExtractionResultSchema>;
