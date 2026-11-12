# CUSTOMER ACQUISITION PLAYBOOK & OUTREACH SEQUENCES — BIDREADY

**Document ID:** `COMM-DOC-005`  
**Target Market:** United States (B2B IT, Cybersecurity & Federal Contractors)  
**Lifecycle Stage:** M5.0 Commercial Validation  
**Legal Compliance:** CAN-SPAM Act (15 U.S.C. 7701) & LinkedIn Professional Conduct Guidelines  
**Status:** Spec / Ready-to-Execute Playbook (**NO MESSAGES SENT**)  
**Language:** English (Outreach Copies) / Portuguese (Process & Rules)

---

## 1. COMPLIANCE & LEGAL FRAMEWORK (US OUTREACH RULES)

All outbound email and social communication designed in this playbook strictly adheres to **US Federal CAN-SPAM Act** requirements:
1. **Accurate Sender Identity:** Header information ("From", "To", "Reply-To") must accurately reflect the sender's domain.
2. **Non-Deceptive Subject Lines:** Subject lines must directly reflect the content of the email (no misleading "Re: our meeting yesterday" prefixes).
3. **Physical Postal Address:** Every email includes a valid registered commercial postal address or registered digital PO Box in the email footer.
4. **Clear, 1-Click Opt-Out:** Clear opt-out mechanism (either a 1-click unsubscribe link or clear text: *"Reply 'unsubscribe' to be permanently removed"*). Opt-out requests must be processed within 10 business days.
5. **Target Filtering:** Only verified B2B corporate email addresses (zero consumer `@gmail.com` or personal inboxes).

---

## 2. OUTBOUND SEQUENCE 1: "THE DISQUALIFICATION GAP" (FOUNDER TO FOUNDER)

**Target Persona:** CEO / Managing Partner of MSP / Defense Subcontractor (10-50 FTE)  
**Angle:** Empathy on lost engineering time and administrative disqualification risks.

### Email 1: The Observation (Day 1)
- **Subject:** quick question on your RFP compliance matrices
- **Preview Text:** How your team handles 100+ page solicitation breakdowns
- **Body:**
```text
Hi {{first_name}},

Noticed {{company_name}}'s work in {{industry_specialty}}—congrats on the recent growth.

When your team evaluates a 100+ page solicitation package (like a DoD or State SOW), who usually gets stuck spending 15 hours pulling out the mandatory clauses for the compliance matrix?

At most 20-person contractors, it's usually the Founder or a Senior Architect who should be billing client hours instead of hunting through PDF attachments.

We built BidReady to automate that exact step: upload a 100-page RFP PDF, and it extracts every technical requirement with page-level citations and flags your capability gaps in under 3 minutes.

Not asking for a meeting—would it be helpful if I sent over a 3-minute interactive walkthrough showing how it works on a sample federal solicitation?

Best,

[Sender Name]
BidReady | Proposal Intelligence
[Physical Address]
[Unsubscribe / Opt-out Link]
```

### Email 2: The Proof Point / Blind Test (Day 4)
- **Subject:** Re: quick question on your RFP compliance matrices
- **Preview Text:** Running a blind test on an old RFP
- **Body:**
```text
Hi {{first_name}},

Following up briefly on this.

Most capture leads we speak with test BidReady on a past RFP they already submitted 6 months ago. 

They upload the solicitation, and within 3 minutes they check if our automated extraction caught 100% of the mandatory clauses their team found manually.

We give every new team 3 complimentary full document analyses to test it out—no credit card or sales demo required:
[Link to Self-Service Sandbox / Landing Page]

If you have an old solicitation lying around, give it a 3-minute test and let me know if it missed anything.

Best,

[Sender Name]
BidReady
[Physical Address]
[Unsubscribe / Opt-out Link]
```

### Email 3: The Polite Breakup (Day 8)
- **Subject:** Closing the loop / {{company_name}} proposal capture
- **Preview Text:** Won't clutter your inbox
- **Body:**
```text
Hi {{first_name}},

I assume proposal compliance extraction isn't a bottleneck for {{company_name}} right now, or you already have a smooth workflow in place.

I won't clutter your inbox further. If you ever find your senior engineers burning weekends cross-referencing RFP clauses, feel free to bookmark BidReady.com.

Wishing you continued success on your upcoming bids.

Best,

[Sender Name]
BidReady
[Physical Address]
[Unsubscribe / Opt-out Link]
```

---

## 3. OUTBOUND SEQUENCE 2: "THE BILLABLE HOURS DRAIN" (CAPTURE LEAD)

**Target Persona:** Director of Capture / Senior Solutions Architect  
**Angle:** Direct operational efficiency, eliminating tedious copy-pasting.

### Email 1: The Tactical Pain (Day 1)
- **Subject:** 100-page RFPs vs engineering hours at {{company_name}}
- **Preview Text:** Cutting compliance matrix prep time by 80%
- **Body:**
```text
Hi {{first_name}},

As {{job_title}}, how many hours does your team typically lose manually assembling compliance cross-reference tables from dense SOWs and RFPs?

Having principal architects copy-paste clauses from PDFs into Excel is one of the most expensive ways to spend capture budget.

BidReady was built specifically to solve this:
1. Ingest multi-document solicitation packages.
2. Auto-extract requirements with exact page & paragraph citations.
3. Cross-reference your company's past performance library to highlight instant Go/No-Go gaps.

Here is a 3-minute silent demo showing the extraction on a 140-page solicitation:
[Link to Interactive Loom Demo]

Open to your thoughts if this aligns with how you run your proposal shredding.

Best,

[Sender Name]
BidReady
[Physical Address]
[Unsubscribe / Opt-out Link]
```

### Email 2: The Direct Case Study / Comparison (Day 5)
- **Subject:** Re: 100-page RFPs vs engineering hours at {{company_name}}
- **Preview Text:** Citation accuracy vs generic AI
- **Body:**
```text
Hi {{first_name}},

One common hesitation we hear from technical capture leads: *"Can't we just paste the RFP into ChatGPT?"*

The short answer is yes—until it hallucinates a clause, drops an obscure mandatory requirement on page 74, or leaks proprietary past performance into a public model.

BidReady was built with deterministic provenance: every single requirement links directly back to the source sentence and page in the RFP, with an isolated tenant database that never trains public models.

You can run 3 free solicitations through the platform today to evaluate the parsing precision yourself:
[Link to Instant Workspace Signup]

Best,

[Sender Name]
BidReady
[Physical Address]
[Unsubscribe / Opt-out Link]
```

---

## 4. INBOUND LEAD NURTURING SEQUENCE (SELF-SERVE TRIAL ACTIVATION)

Triggered automatically when a prospect signs up for the 3 complimentary analyses.

### Trigger 0: Immediate Welcome (Minute 0)
- **Subject:** Your BidReady workspace is ready (+ 3 complimentary analyses)
- **Body:**
```text
Hi {{first_name}},

Welcome to BidReady! Your organization workspace is active with 3 complimentary document analyses.

Here is the quickest way to get value in the next 10 minutes:
1. Upload an old RFP you already know well.
2. Review the extracted requirements and page citations in your dashboard.
3. Upload 1 past performance case study into your Evidence Bank to see automated matching in action.

Access your dashboard here: [Dashboard Link]

If you run into any parsing questions, simply reply to this email.

Best,
The BidReady Team
```

### Trigger 1: Analysis Completed Notification (Immediate after 1st upload)
- **Subject:** [Complete] Your compliance extraction for {{opportunity_title}}
- **Body:**
```text
Hi {{first_name}},

BidReady has finished parsing {{opportunity_title}}.

Summary:
• Total Pages: {{pages_count}}
• Extracted Requirements: {{req_count}}
• Potential Gaps: {{gaps_count}}

Review your interactive matrix and citations here: [Link to Opportunity]
```

### Trigger 2: Trial Exhaustion / Upgrade Prompt (When 3rd analysis is consumed)
- **Subject:** You've completed your 3 complimentary analyses
- **Body:**
```text
Hi {{first_name}},

You've analyzed 3 solicitations in BidReady. We hope the automated citations and gap matching saved your team significant time!

To keep analyzing upcoming RFPs this month, you can activate your monthly plan starting at $29/mo (Starter: 10 analyses) or $69/mo (Pro: 40 analyses, multi-user).

Activate your subscription in 30 seconds here: [Billing Portal Link]

No contracts, cancel anytime online.
```

---

## 5. ORGANIC ACQUISITION CHANNELS (ZERO-PAID-AD STRATEGY)

To acquire early validation customers without spending advertising budget:

1. **Federal Subcontracting Communities & Slack Groups:**
   - Active participation in US government contracting communities (e.g., GovCon Giants, GovExec forums, Defense Tech Meetups, Subcontractor Exchange).
   - Value-first sharing: Break down complex new federal solicitations (e.g., new CMMC rule changes) and provide public, pre-parsed compliance checklists as free community resources.
2. **SAM.gov Contract Award Teaming Lists:**
   - Daily automated scraping of public SAM.gov Pre-Solicitation Notices and "Interested Vendors Lists".
   - Identify small businesses registered as interested subcontractors who will need to respond to prime contractor data calls.
3. **LinkedIn Thought Leadership for Proposal Managers:**
   - Short, visual posts analyzing common compliance matrix pitfalls (e.g., "The top 5 clauses that got IT vendors disqualified in Q3 2026").
   - Include 15-second screen clips showing automated page citation extraction.
