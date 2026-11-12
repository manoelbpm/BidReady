# BidReady — Automated Proposal Intelligence & RFP Decomposition SaaS

BidReady is a B2B SaaS platform engineered to ingest, decompose, and cross-reference procurement solicitations (RFPs, RFQs, SOWs, and commercial tenders) up to 50 MB in size. Built for government contractors, MSPs, and commercial proposal teams, BidReady extracts structured requirements, deliverable schedules, and cited compliance matrices directly from digital solicitation documents.

---

## ⚠️ Important Notices & Operating Boundaries

### 1. AI Output Traceability & Human-in-the-Loop Requirement
- **No Guaranteed Infallibility:** BidReady uses modern Large Language Models (LLMs) to accelerate document analysis. Like all generative AI systems, model outputs may contain inaccuracies, omissions, or misinterpretations.
- **Traceability, Not Guarantees:** BidReady's deterministic citations (binding extracted requirements to exact page numbers, section headers, and verbatim quotes) and past performance matching are **verification and traceability mechanisms designed to assist human reviewers**—they do **not** constitute a guarantee of absolute accuracy or completeness.
- **Mandatory Human Verification:** Every extracted clause, compliance determination, and proposal deliverable must be reviewed, verified, and approved by qualified human capture managers before submission. Semantic similarity scores indicate thematic relevance of company artifacts; they never prove legal, technical, or regulatory compliance.

### 2. Supported Formats & OCR Limitations
- **Supported Formats:** BidReady natively parses **PDF**, **DOCX**, and **XLSX** files up to **50 MB** with server-side magic-byte validation (`%PDF-`, `PK\x03\x04`).
- **Absence of Optical Character Recognition (OCR):** BidReady processes digital, selectable text streams. **Scanned, image-only documents lacking an embedded text layer cannot be processed** and will be rejected with an explicit notification (`requiresOcr / unprocessable`). BidReady does **not** provide automated OCR for flattened raster scans.

### 3. Public & Unclassified Procurement Scope
- **Intended Data Scope:** BidReady is architected strictly for **public procurement documents**, public SAM.gov solicitations, GSA task orders, and commercial tender solicitations.
- **No CUI or Classified Authorization:** BidReady is **NOT certified, authorized, or approved** to store or process Controlled Unclassified Information (CUI), ITAR-controlled technical data, or classified national security information. Do not upload classified or restricted defense data to the platform.

### 4. Legal & Commercial Disclaimer
- **No Legal Counsel:** BidReady is an administrative workflow and proposal intelligence tool. It does **not** provide legal advice, statutory compliance certifications, or formal bid protest counsel.
- **No Win or Award Guarantees:** Use of BidReady does **not** guarantee tender qualification, proposal responsiveness, evaluation scoring, or contract award outcomes.

---

## Technical Stack & Architecture

| Layer | Technologies & Declared Versions | Purpose & Implementation |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16.4.6** (App Router, Turbopack) | Serverless API routes, server actions, and optimized client rendering. |
| **Frontend UI** | **React 19.3.0**, **Tailwind CSS 4.3.3**, **Lucide React** (`^1.71.0`) | Modern responsive App Shell, interactive matrices, and compliance dashboards. |
| **Language** | **TypeScript** (`^5`) | Strict end-to-end type safety across domain models, payloads, and repositories. |
| **Database & Auth** | **Supabase** (`@supabase/supabase-js ^2.119.0`, `@supabase/ssr ^0.12.7`) | PostgreSQL 17 with Row-Level Security (RLS) and multi-tenant isolation. |
| **Document Parsers** | **pdf-parse** (`^2.4.5`), **mammoth** (`^1.13.0`), **xlsx** (`^0.18.5`) | Provider-independent text extraction with coordinate and table preservation. |
| **Schema Validation**| **Zod** (`^4.6.7`) | Runtime validation of LLM JSON outputs and API request payloads. |
| **AI Inference** | **Google Gemini Flash** (`gemini-2.5-flash`), Mock Provider | Provider-agnostic abstraction (`AIProvider`) with deterministic JSON schemas. |
| **Billing & MoR** | **Paddle** (REST API, Paddle.js overlay, HMAC webhooks) | Merchant of Record subscription billing, dynamic price IDs, and Customer Portal. |
| **Transactional Email**| **Resend** (`^6.38.0`) | Transactional email integration (outbox persistence requires remote Migration 8). |
| **Testing** | **Vitest** (`^5.1.0`) (27 test suites, 307 tests) | Multi-tenant isolation, billing security, webhook HMAC, and parser tests. |

*> Note on dependencies: Pinned versions are shown where fixed in `package.json` (e.g. Next.js 16.4.6, React 19.3.0, Tailwind CSS 4.3.3); dependencies with semver range prefixes (`^`) reflect ranges declared in `package.json` and resolved in `package-lock.json`.*

---

## Core Capabilities & Implemented Features

### 1. Multi-Format Ingestion & Parsing
- Binary magic-byte header validation preventing file extension spoofing.
- Coordinate preservation extracting page offsets, section markers, and spreadsheet cell/sheet indices.
- Fast failure on flat-scanned or corrupt files with automatic quota reservation release.

### 2. Structured Extraction & Compliance Matrix Engine
- Extraction of mandatory requirements, desirable criteria, submission deadlines, and deliverables.
- Deterministic page, section, and verbatim quote attribution for every extracted item.
- Interactive compliance checklist with real-time human verification toggles.

### 3. Company Evidence Repository & Capability Matching
- Structured storage for past performance (CPARS), certifications (ISO, CMMC, FedRAMP), and capability statements.
- Expiration tracking preventing expired credentials from being marked as compliant.
- Multi-tier matching engine categorizing alignment into `MATCHED`, `PARTIALLY_MATCHED`, `MISSING_EVIDENCE`, and `EXPIRED_EVIDENCE`.

### 4. Atomic Quota Enforcement & Subscription Tiers
Usage quotas are enforced at the PostgreSQL database level using atomic row-level locks (`FOR UPDATE`), preventing concurrent race conditions:

| Plan | Price | Monthly Document Analyses | Evidence Repository | Support Level |
| :--- | :--- | :--- | :--- | :--- |
| **Free** | **$0 / mo** | **2 analyses / month** | Up to 5 artifacts (base seed) | Community / Documentation |
| **Starter** | **$29 / mo** | **10 analyses / month** | Unlimited artifacts | Standard Email Support |
| **Pro** | **$69 / mo** | **40 analyses / month** | Unlimited artifacts | Priority email support, with a target response time of up to 24 business hours. This is not a resolution-time guarantee or contractual SLA. |
| **Business** | **$149 / mo**| **120 analyses / month** | Unlimited artifacts | Multi-Seat Org Access & Standard Support |

### 5. Billing, Webhook Security & Customer Portal
- Server-authoritative checkout intent generation (`create_checkout_intent` RPC).
- Dynamic Price ID resolution distinguishing between Paddle Sandbox and Live environments.
- HMAC-SHA256 signature verification on inbound webhooks with replay and timing-drift protection.
- Self-service Customer Portal allowing customers to update payment methods or cancel anytime.

### 6. Transactional Email Outbox & Idempotency
- Official Resend SDK integration for 4 transactional events: `welcome`, `analysis_completed`, `quota_alert`, and `payment_receipt`.
- Persistent email outbox design with atomic claim locks (`claim_email_outbox_slot` RPC). **Important Notice:** Migration 8 (`20261111000008_email_outbox.sql`) is defined locally and has **NOT** yet been applied to the remote Supabase database. Consequently, database-level outbox persistence and persistent slot locking are **not** currently operational in the remote production environment until that migration is applied.
- Strict production protection: `RESEND_MOCK_MODE=true` is forbidden in production, and mock keys produce explicit operational errors without false successes.
- All email deliveries are 100% non-blocking; provider outages never interrupt payments or document processing.

---

## Database Migrations

All database structures, Row-Level Security policies, and stored procedures are organized into sequential migration scripts under `supabase/migrations/`:

```
supabase/migrations/
├── 20261110000001_core_schema.sql
├── 20261110000002_rls_policies.sql
├── 20261110000003_evidence_and_matching.sql
├── 20261110000004_billing_and_subscriptions.sql
├── 20261110000005_secure_checkout_intents_rpc.sql
├── 20261111000006_unique_provider_subscription_id.sql
├── 20261111000007_billing_final_consolidation.sql
└── 20261111000008_email_outbox.sql
```

### Remote vs. Local Migration Status:
- **Migrations 1 to 7 (`20261110000001` through `20261111000007`):** Fully applied and active on the remote Supabase production/staging database (`ghqbqzljfpkjdrnuyddo`, PostgreSQL 17).
- **Migration 8 (`20261111000008_email_outbox.sql`):** Defined in the local repository; **NOT applied to the remote Supabase database**. Outbox persistence, delivery state auditing, and PostgreSQL slot claim locks in production depend on applying this migration during the production deployment window. It is currently **not** operational on the remote environment.

---

## Environment Variables Configuration

Refer to `.env.example` as the canonical template. Create a `.env.local` file for local development:

```bash
cp .env.example .env.local
```

### Inventory of Environment Variables (Never Commit Real Secrets):

```env
# ==========================================
# 1. Supabase Infrastructure
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ==========================================
# 2. Application & Routing
# ==========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# ==========================================
# 3. AI Inference Providers
# ==========================================
AI_DEFAULT_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_BILLING_ENABLED=true

# ==========================================
# 4. Paddle Billing (Sandbox or Live)
# ==========================================
PADDLE_ENV=sandbox
PADDLE_API_KEY=paddlegb_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_WEBHOOK_TOLERANCE_SECONDS=300
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_...
PADDLE_PRICE_STARTER=pri_...
PADDLE_PRICE_PRO=pri_...
PADDLE_PRICE_BUSINESS=pri_...

# ==========================================
# 5. Transactional Emails (Resend)
# ==========================================
RESEND_API_KEY=re_...
EMAIL_FROM=BidReady <notifications@bidready.io>
RESEND_MOCK_MODE=false

# ==========================================
# 6. Operations & Maintenance
# ==========================================
BILLING_MAINTENANCE_MODE=false
PLATFORM_ADMIN_SECRET=your-admin-secret
```

---

## Getting Started & Local Development

### 1. Prerequisites
- **Node.js:** `v20.x` or `v24.x` (tested on Node `v24.13.0`)
- **npm:** `v10+` or `v11+`
- **PostgreSQL / Supabase:** A Supabase project with migrations applied.

### 2. Installation
```bash
git clone https://github.com/manoelbpm/BidReady.git
cd BidReady
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Landing Page:** [http://localhost:3000](http://localhost:3000)
- **Interactive Demo:** [http://localhost:3000/demo](http://localhost:3000/demo)
- **Self-Service Signup:** [http://localhost:3000/signup](http://localhost:3000/signup)
- **Pricing & Checkout:** [http://localhost:3000/pricing](http://localhost:3000/pricing)
- **Document Upload:** [http://localhost:3000/upload](http://localhost:3000/upload)

### 4. Running the Test Suite
```bash
npm test
```
The test suite consists of **27 test files** comprising **307 tests** validating multi-tenant isolation, quota limits, Paddle webhook HMAC verification, document parser edge cases, and email idempotency.

### 5. Building for Production
```bash
npm run build
npm start
```
Compiles all 24 static and dynamic routes via Next.js Turbopack and executes strict TypeScript typechecking.

---

## License & Ownership
Copyright © 2026 BidReady. All rights reserved. Commercial SaaS application.
