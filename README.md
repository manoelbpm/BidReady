# BidReady — Tender Intelligence SaaS

BidReady is an international B2B SaaS platform engineered to ingest and analyze procurement solicitation documents (RFPs, RFQs, RFTs, and commercial tenders) in PDF, DOCX, and XLSX formats, converting them into traceable requirements, deadline schedules, and actionable compliance checklists.

> **Zero AI Hallucination Policy:** Every extracted requirement is tied to its original document coordinates (page, section, and verbatim quote). If extraction confidence is low (< 0.85), items are flagged for human review.

---

## Architecture & Milestones Overview

### Milestone 1 — Foundation & Security (Completed)
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vitest.
- Supabase PostgreSQL with strict Row Level Security (RLS) and multi-tenant isolation.
- Responsive App Shell (Sidebar, Header, Tenant Switcher, User Menu).
- Automated tests for tenant boundary enforcement and RBAC hierarchies.

### Milestone 2 — Ingestion & AI Extraction Pipeline (Completed)
- Server-side document ingestion with binary magic bytes validation (PDF `%PDF-`, DOCX/XLSX `PK\x03\x04`).
- Provider-independent parsers (PDF, DOCX, XLSX) with page boundary and table preservation.
- Provider-independent AI abstraction (`AIProvider`) with adapters for Mock, Gemini, Claude, and OpenAI.
- Structured tender extraction engine with 10-section JSON schema output.
- Full document processing lifecycle: `UPLOADED` → `VALIDATING` → `PARSING` → `EXTRACTING` → `REVIEW_REQUIRED` | `COMPLETED` | `FAILED`.

### Milestone 3 — Evidence Intelligence & Opportunity Management (Completed)
1. **Company Evidence Library:**
   - Complete lifecycle for corporate credentials, accreditations (FedRAMP, ISO 27001, CMMC), insurance policies, and CPARS past performance.
   - Distinct verification states: `VERIFIED`, `PENDING_VERIFICATION`, `EXPIRED`, `REJECTED`, `REQUIRES_HUMAN_REVIEW`.
   - Automated expiration detection preventing expired certificates from ever being treated as valid.
   - Human audit workflows (approval/rejection with rationale).
2. **Requirement-to-Evidence Matching Engine:**
   - Compares extracted tender requirements against verified evidence.
   - Produces outcomes: `MATCHED`, `PARTIALLY_MATCHED`, `MISSING_EVIDENCE`, `EXPIRED_EVIDENCE`, `REQUIRES_REVIEW`.
   - Explanations bind to exact source citations and confidence scores.
   - Strict rule: Semantic similarity alone never proves compliance.
3. **Opportunity Management:**
   - Workflow statuses: `DISCOVERED`, `UNDER_REVIEW`, `QUALIFICATION`, `IN_PREPARATION`, `READY_FOR_REVIEW`, `SUBMITTED`, `WON`, `LOST`, `WITHDRAWN`.
   - Priorities: `low`, `medium`, `high`, `urgent`.
   - Full audit trail (`OpportunityActivity`) tracking status, priority, and verification changes.
4. **Transparent Readiness Dashboard:**
   - Detailed breakdown: Matched, Partially Matched, Missing Evidence, Expired Evidence, and Requires Review.
   - Transparent calculation explaining the status without deceptive compliance percentages.
   - Clear legal disclaimers distinguishing internal readiness from external eligibility.
5. **Interactive Compliance Checklist:**
   - Connected directly to the Matching Engine.
   - In-line inspection of requirement citations and linked evidence.
   - Direct action buttons to record human verification.
6. **Internal Notification Center:**
   - Bell dropdown tracking upcoming submission cutoffs, expiring evidence, and unverified criteria.

---

## Getting Started

### 1. Prerequisites
- Node.js `v20+` (tested on Node `v24.13.0`)
- npm `11+`
- A Supabase project (or local Supabase CLI instance)

### 2. Environment Variables
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configured variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI Provider Selection (mock | gemini | anthropic | openai)
AI_DEFAULT_PROVIDER=mock
```

### 3. Database Migrations
Apply migration scripts in Supabase SQL editor:
1. `supabase/migrations/20261110000001_core_schema.sql`
2. `supabase/migrations/20261110000002_rls_policies.sql`
3. `supabase/migrations/20261110000003_evidence_and_matching.sql`

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 5. Running Automated Tests
```bash
npm test
```
Executes all 44 automated tests across 8 test suites with 100% pass rate.

### 6. Building for Production
```bash
npm run build
npm start
```

---

## Legal & Compliance Notice
BidReady is an operational workflow assistant. It does not constitute legal counsel, nor does it guarantee tender eligibility or award outcomes.
