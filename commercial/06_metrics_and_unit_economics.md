# COMMERCIAL METRICS & UNIT ECONOMICS DASHBOARD — BIDREADY

**Document ID:** `COMM-DOC-006`  
**Target Market:** United States (B2B SaaS Commercial Validation)  
**Lifecycle Stage:** M5.0 Commercial Validation  
**Currency:** USD ($) / Financial Rationale in Portuguese  
**Status:** Tracking Model Spec

---

## 1. THE 10-METRIC COMMERCIAL VALIDATION FUNNEL

To track commercial viability objectively without emotional bias, BidReady will track the following 10 funnel metrics weekly:

```
[Top of Funnel]
  1. Identified Target Companies (Scored ICPs)
  2. Qualified Outbound / Inbound Contacts
  3. Unique Landing Page Visitors (Conversion Rate to Signup)
         ↓
[Product Engagement / Activation]
  4. Workspaces Created (Self-Service Registrations)
  5. Interactive Product Demos Viewed (Loom / Video Retention)
  6. Activated Free Pilots (Uploaded ≥ 1 Solicitation Document)
         ↓
[Monetization & Commercial Viability]
  7. Paid Subscription Conversions (Trial-to-Paid %)
  8. Monthly Recurring Revenue (MRR)
  9. Customer Acquisition Cost (CAC)
 10. Gross Margin & Unit Contribution per Customer
```

---

## 2. METRICS DEFINITIONS, BENCHMARKS & TARGETS

| Metric | Calculation Method | M5.0 Target / Benchmark | Red Flag / Intervention Trigger |
| :--- | :--- | :--- | :--- |
| **1. Identified Companies** | Companies matching ICP criteria (5-50 FTE, US, IT/Cyber) | 100 qualified companies / week | < 30 / week (tighten search criteria) |
| **2. Qualified Contacts** | Decision-maker emails verified via ZeroBounce/NeverBounce | 150 contacts / week | Bounce rate > 3% (stop sending immediately) |
| **3. Landing Page Visits** | Unique sessions on landing page via clean UTM parameters | 200 – 500 visits / month | Bounce rate > 75% on hero section |
| **4. Registrations** | Workspaces created with verified corporate email domain | 5% – 8% visitor-to-signup | < 2% (rewrite headline and value prop) |
| **5. Demos Watched** | 5-minute video views with > 60% completion rate | > 35% completion | < 20% (shorten video or improve hook) |
| **6. Pilot Activation** | Users who upload at least 1 RFP document within 24 hours | > 50% of registered users | < 25% (onboarding friction / drop-off) |
| **7. Trial-to-Paid %** | Activated pilot users who convert to Starter ($29) or Pro ($69) | 10% – 15% conversion | < 5% (pricing mismatch or lack of value) |
| **8. Net New MRR** | (New Subscriptions - Churn) × Average Revenue Per Account | $300 – $1,000 / month | Zero conversions after 30 days |
| **9. CAC (Blended)** | Total Commercial Spend ÷ Number of Paid Customers Acquired | < $80 per customer | > $150 (unsustainable on $29/mo tier) |
| **10. Gross Margin** | (Subscription Revenue - AI Token & Infrastructure Cost) ÷ Revenue | > 85% gross margin | < 70% (optimize LLM prompt token length) |

---

## 3. UNIT ECONOMICS & MARGIN ANALYSIS (PER PLAN)

To guarantee that scaling does not consume operational capital, we analyze the **unit cost per customer per month**:

### Cost Structure Hypotheses:
- **LLM Token Costs (Claude / OpenAI / Gemini):**
  - Average RFP document: 120 pages ≈ 60,000 words ≈ 80,000 tokens.
  - Multi-pass parsing + extraction + embeddings: ~$0.15 to $0.40 per document analysis.
- **Supabase & Storage Overhead:** ~$0.05 per active tenant per month.
- **Paddle Merchant of Record Fee:** 5% + $0.50 per transaction.

### Unit Contribution Matrix:

| Tier | Monthly Price | Quota Limit | Est. Usage (70% capacity) | Est. AI & Infra Cost | Paddle Processing Fee | Net Monthly Contribution | Gross Margin (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter** | **$29.00** | 10 analyses | 7 docs ($1.75) | $1.85 | $1.95 (5% + $0.50) | **+$25.20** | **86.9%** |
| **Pro** | **$69.00** | 40 analyses | 28 docs ($7.00) | $7.25 | $3.95 (5% + $0.50) | **+$57.80** | **83.7%** |
| **Business**| **$149.00** | 120 analyses | 84 docs ($21.00)| $21.50 | $7.95 (5% + $0.50) | **+$119.55** | **80.2%** |

> **Conclusion:** Even under heavy document consumption, unit gross margin remains above **80% across all tiers**, guaranteeing healthy contribution margins without negative unit economics.

---

## 4. WEEKLY OPERATIONAL REPORTING TEMPLATE

A lightweight markdown table to be reviewed every Friday:

```markdown
### BIDREADY COMMERCIAL KPI SUMMARY (WEEK ENDING: [DATE])

| Metric | Current Week | Previous Week | % Change | Target |
| :--- | :--- | :--- | :--- | :--- |
| Targeted Companies Scored | 0 | 0 | - | 100 |
| Inbound Landing Page Visits | 0 | 0 | - | 100 |
| New Workspaces Created | 0 | 0 | - | 10 |
| Solicitations Parsed (Trial) | 0 | 0 | - | 25 |
| New Paid Customers | 0 | 0 | - | 2 |
| Total Active Subscriptions | 0 | 0 | - | - |
| Current MRR ($) | $0.00 | $0.00 | - | - |
| Total Cash Spend (Marketing) | $0.00 | $0.00 | - | < $100 |
```
