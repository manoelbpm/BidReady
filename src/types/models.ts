export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  billing_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: string;
  user?: UserProfile;
}

export interface SourceReference {
  page_number?: number | null;
  section_title?: string | null;
  snippet?: string | null;
  raw_quote?: string | null;
}

export type OpportunityStage =
  | 'DISCOVERED'
  | 'UNDER_REVIEW'
  | 'QUALIFICATION'
  | 'IN_PREPARATION'
  | 'READY_FOR_REVIEW'
  | 'SUBMITTED'
  | 'WON'
  | 'LOST'
  | 'WITHDRAWN'
  | 'intake'
  | 'analyzing'
  | 'review'
  | 'bid_decision'
  | 'drafting';

export type OpportunityPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Opportunity {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  title: string;
  description?: string | null;
  reference_code?: string | null;
  issuing_body?: string | null; // Buyer / Agency
  contact_email?: string | null;
  estimated_value?: number | null;
  currency?: string | null;
  submission_deadline?: string | null;
  clarification_deadline?: string | null;
  stage: OpportunityStage;
  priority?: OpportunityPriority;
  assigned_team_member?: string | null;
  internal_notes?: string | null;
  source_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface Document {
  id: string;
  organization_id: string;
  opportunity_id?: string | null;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  checksum_sha256?: string | null;
  status: DocumentStatus;
  uploaded_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export type AnalysisStatus = 'pending' | 'extracting' | 'analyzing' | 'completed' | 'failed';

export interface AnalysisRun {
  id: string;
  organization_id: string;
  opportunity_id: string;
  document_id: string;
  status: AnalysisStatus;
  model_provider: string; // e.g., 'gemini', 'anthropic', 'openai'
  model_version: string;
  confidence_score?: number | null; // 0.0 - 1.0
  executive_summary?: string | null;
  human_review_notes?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
}

export type RequirementType = 'mandatory' | 'desirable';

export interface Requirement {
  id: string;
  organization_id: string;
  opportunity_id: string;
  analysis_run_id?: string | null;
  type: RequirementType;
  category: string; // e.g. Technical, Compliance, Legal, Financial, SLA
  title: string;
  description: string;
  source_reference: SourceReference;
  confidence_score: number; // 0.0 to 1.0
  manual_review_required: boolean;
  verified_by_user_id?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export type DeadlineType = 'submission' | 'questions_clarifications' | 'site_visit' | 'presentation' | 'award_notice' | 'other';

export interface Deadline {
  id: string;
  organization_id: string;
  opportunity_id: string;
  title: string;
  deadline_type: DeadlineType;
  due_date: string;
  timezone: string;
  source_reference?: SourceReference | null;
  created_at: string;
}

export type ChecklistStatus = 'pending' | 'in_progress' | 'completed' | 'flagged';

export interface ChecklistItem {
  id: string;
  organization_id: string;
  opportunity_id: string;
  requirement_id?: string | null;
  title: string;
  notes?: string | null;
  status: ChecklistStatus;
  assigned_to_user_id?: string | null;
  source_reference?: SourceReference | null;
  created_at: string;
  updated_at: string;
}

export type EvidenceVerificationStatus =
  | 'verified'
  | 'pending_verification'
  | 'expired'
  | 'rejected'
  | 'requires_human_review';

export interface Evidence {
  id: string;
  organization_id: string;
  title: string;
  category: string; // Certification, Past Performance, Compliance, Security, Insurance, Financial
  description?: string | null;
  issuing_organization?: string | null;
  issue_date?: string | null;
  valid_until?: string | null;
  file_storage_path?: string | null;
  file_name?: string | null;
  verification_status: EvidenceVerificationStatus;
  verified_by_user_id?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type MatchOutcome =
  | 'MATCHED'
  | 'PARTIALLY_MATCHED'
  | 'MISSING_EVIDENCE'
  | 'EXPIRED_EVIDENCE'
  | 'REQUIRES_REVIEW';

export interface RequirementEvidenceMatch {
  id: string;
  organization_id: string;
  opportunity_id: string;
  requirement_id: string;
  evidence_id?: string | null;
  match_outcome: MatchOutcome;
  confidence_score: number; // 0.0 to 1.0
  match_explanation: string;
  missing_information?: string | null;
  human_review_required: boolean;
  human_review_notes?: string | null;
  verified_by_user_id?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
  // Hydrated joins when available
  requirement?: Requirement;
  evidence?: Evidence;
}

export interface OpportunityActivity {
  id: string;
  organization_id: string;
  opportunity_id: string;
  user_id: string;
  user_name?: string;
  action:
    | 'STATUS_CHANGE'
    | 'EVIDENCE_LINKED'
    | 'REQUIREMENT_VERIFIED'
    | 'COMMENT_ADDED'
    | 'PRIORITY_UPDATED'
    | 'ASSIGNED_MEMBER';
  description: string;
  created_at: string;
}

export type ReadinessStage =
  | 'NOT_READY'
  | 'ACTION_REQUIRED'
  | 'NEEDS_VERIFICATION'
  | 'SUBMISSION_READY';

export interface ReadinessOverview {
  opportunity_id: string;
  total_requirements: number;
  matched_count: number;
  partially_matched_count: number;
  missing_evidence_count: number;
  expired_evidence_count: number;
  requires_review_count: number;
  mandatory_total: number;
  mandatory_matched: number;
  readiness_stage: ReadinessStage;
  calculation_explanation: string;
  disclaimer: string;
}

export type NotificationType =
  | 'DEADLINE_APPROACHING'
  | 'EVIDENCE_EXPIRING'
  | 'MISSING_MANDATORY_EVIDENCE'
  | 'REVIEW_PENDING'
  | 'TASK_ASSIGNED';

export interface InternalNotification {
  id: string;
  organization_id: string;
  user_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface Subscription {
  id: string;
  organization_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  monthly_doc_limit: number;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export type UsageMetric = 'documents_processed' | 'pages_analyzed' | 'ai_tokens_consumed';

export interface UsageRecord {
  id: string;
  organization_id: string;
  metric: UsageMetric;
  quantity: number;
  recorded_at: string;
}
