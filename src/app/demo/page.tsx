'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  ExternalLink,
  Layers,
  Sparkles,
  Download,
  Info,
  Clock,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

// Synthetic benchmark data for demonstration (strictly labeled as synthetic public benchmark)
const SYNTHETIC_SOLICITATION = {
  id: 'opp-faa-2026-synthetic',
  title: 'FAA NextGen Radar Telemetry Modernization Framework (Illustrative Benchmark)',
  solicitationNumber: 'DTFAWA-26-R-00412 (Synthetic Public Benchmark)',
  agency: 'Public Benchmark Specification (FAA / DOT Framework)',
  totalPages: 142,
  naicsCode: '541512 — Computer Systems Design Services',
  valueEstimate: '$4.2M — $8.5M (Illustrative IDIQ Task Order)',
  submissionDeadline: 'December 15, 2026 — 17:00 EST',
  requirementsCount: 84,
  matchedCount: 79,
  criticalGapsCount: 4,
  discretionaryGapsCount: 1,
};

const SYNTHETIC_REQUIREMENTS = [
  {
    id: 'REQ-012',
    section: 'Section C.4.1 (Scope of Work)',
    page: 'Page 14',
    title: 'Controlled Unclassified Information (CUI) & NIST Compliance',
    text: 'The Offeror must demonstrate active implementation of NIST SP 800-171 Rev 2 across all systems processing telemetry data, with an active SPRS score on file prior to award.',
    status: 'MATCHED',
    confidence: '98%',
    evidenceTitle: 'SOC 2 Type II & NIST SP 800-171 Audit Assessment Package (2026)',
    evidenceExcerpt: 'Section 4.2 confirms full NIST 800-171 Rev 2 implementation across cloud workloads with SPRS score of 104 recorded on 2026-03-15.',
  },
  {
    id: 'REQ-027',
    section: 'Section C.6.3 (Technical Infrastructure)',
    page: 'Page 28',
    title: 'Multi-Region Ingestion Throughput',
    text: 'Ingestion pipeline must support minimum 50,000 telemetry messages/second across three redundant CONUS regions with sub-200ms latency.',
    status: 'MATCHED',
    confidence: '94%',
    evidenceTitle: 'Case Study: Raytheon Subcontract Telemetry Gateway Benchmark',
    evidenceExcerpt: 'Architecture achieved sustained 85,000 msgs/sec across AWS us-east-1 and us-west-2 during FAA ADS-B load test.',
  },
  {
    id: 'REQ-068',
    section: 'Section H.7 (Special Contract Requirements)',
    page: 'Page 88',
    title: 'Facility Security Clearance (FCL) Mandate',
    text: 'The prime offeror and all tier-1 subcontractors must possess an active Top Secret Facility Security Clearance (FCL) sponsored by DSS at time of proposal submission.',
    status: 'CRITICAL_GAP',
    confidence: '100%',
    evidenceTitle: null,
    evidenceExcerpt: 'No verified Top Secret Facility Security Clearance found in company Evidence Bank. Organization holds active Secret Clearance only.',
  },
  {
    id: 'REQ-074',
    section: 'Section L.5.2 (Key Personnel)',
    page: 'Page 104',
    title: 'Lead Systems Architect Minimum Qualifications',
    text: 'The designated Lead Systems Architect must hold a minimum of 10 years experience in radar telemetry systems and an active CISSP certification.',
    status: 'MATCHED',
    confidence: '91%',
    evidenceTitle: 'Key Personnel Dossier: Dr. Elena Rostova (Principal Solutions Architect)',
    evidenceExcerpt: '12 years DoD/FAA aerospace telemetry experience; active CISSP #482910 verified.',
  },
];

export default function DemoPage() {
  const [activeStep, setActiveStep] = useState<number>(3);
  const [selectedReq, setSelectedReq] = useState(SYNTHETIC_REQUIREMENTS[2]); // Default to critical gap

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              BidReady <span className="text-xs text-blue-400 font-mono font-normal">/ Interactive Demo</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm" className="border-slate-700 bg-slate-900 text-xs">
              <Link href="/">← Back to Landing Page</Link>
            </Button>
            <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs text-white">
              <Link href="/signup">Start Free Trial</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Synthetic Benchmark Alert Banner */}
      <div className="bg-blue-950/60 border-b border-blue-800/80 px-6 py-2.5 text-xs text-blue-200 flex items-center justify-between">
        <div className="max-w-7xl mx-auto flex items-center gap-2 w-full">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Public Benchmark Notice:</strong> This interactive walkthrough demonstrates BidReady&apos;s workflow using synthetic benchmark data derived from public FAA NextGen specifications. All figures, metrics, and outcomes are illustrative synthetic data and do not represent actual client results.
          </span>
        </div>
      </div>

      {/* Main Demo Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full flex flex-col gap-8">
        {/* Step Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Autonomous RFP Intelligence Walkthrough
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Illustrative capture workflow: from digital solicitation ingestion to compliance gap review.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveStep(1)}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeStep === 1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Ingestion
            </button>
            <button
              onClick={() => setActiveStep(2)}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeStep === 2 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Extraction
            </button>
            <button
              onClick={() => setActiveStep(3)}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeStep === 3 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Gap Matching (Live)
            </button>
          </div>
        </div>

        {/* Opportunity Overview Card */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Badge variant="outline" className="text-blue-400 border-blue-800 mb-2 font-mono text-[11px]">
                  {SYNTHETIC_SOLICITATION.solicitationNumber}
                </Badge>
                <CardTitle className="text-lg text-white font-bold">
                  {SYNTHETIC_SOLICITATION.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Agency: {SYNTHETIC_SOLICITATION.agency} • Value: {SYNTHETIC_SOLICITATION.valueEstimate}
                </CardDescription>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <div className="text-xs text-slate-500 font-mono">Parsed Pages (Illustrative)</div>
                  <div className="text-xl font-bold text-white font-mono">{SYNTHETIC_SOLICITATION.totalPages}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono">Requirements (Illustrative)</div>
                  <div className="text-xl font-bold text-blue-400 font-mono">{SYNTHETIC_SOLICITATION.requirementsCount}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-mono">Potential Gaps (Illustrative)</div>
                  <div className="text-xl font-bold text-rose-400 font-mono">{SYNTHETIC_SOLICITATION.criticalGapsCount}</div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 2-Column Interactive Workspace: Left = Compliance Matrix Grid, Right = Citation & Proof Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* Left Column: Requirements Grid */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Extracted Requirements & Compliance Matrix
              </h2>
              <span className="text-xs text-slate-400 font-mono">Click any row to inspect citations</span>
            </div>

            <div className="space-y-3">
              {SYNTHETIC_REQUIREMENTS.map((req) => {
                const isSelected = selectedReq.id === req.id;
                const isGap = req.status === 'CRITICAL_GAP';

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedReq(req)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500'
                        : isGap
                        ? 'border-rose-900/60 bg-rose-950/10 hover:border-rose-800'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">{req.id}</span>
                        <span className="text-xs text-blue-400 font-mono">{req.page}</span>
                        <span className="text-xs text-slate-500">• {req.section}</span>
                      </div>
                      <Badge
                        className={`text-[10px] font-mono ${
                          isGap
                            ? 'bg-rose-950 text-rose-400 border-rose-800'
                            : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        }`}
                      >
                        {isGap ? 'CRITICAL GAP' : `MATCHED (${req.confidence})`}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-semibold text-white mb-1.5">{req.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{req.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Showing 4 benchmark samples out of 84 parsed clauses.</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-400 hover:text-blue-300"
                onClick={() => alert('Download simulated: FAA_Radar_Sample_Compliance_Matrix.csv')}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Export CSV Matrix
              </Button>
            </div>
          </div>

          {/* Right Column: Citation & Evidence Inspector */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                Citation & Evidence Inspector
              </h2>
              <Badge variant="outline" className="font-mono text-[10px] text-slate-400">
                Provenance Verified
              </Badge>
            </div>

            <Card className="bg-slate-900/80 border-slate-800 text-slate-200 flex-1 flex flex-col">
              <CardHeader className="border-b border-slate-800/80 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-blue-400 font-bold">{selectedReq.id}</span>
                  <span className="text-xs text-slate-400 font-mono">{selectedReq.page} ({selectedReq.section})</span>
                </div>
                <CardTitle className="text-base text-white mt-1">{selectedReq.title}</CardTitle>
              </CardHeader>

              <CardContent className="pt-6 space-y-6 flex-1 text-xs">
                {/* Solicitation Excerpt Box */}
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Original Solicitation Excerpt (Audited)
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-slate-300 leading-relaxed font-sans">
                    &ldquo;{selectedReq.text}&rdquo;
                  </div>
                </div>

                {/* Company Evidence Match Box */}
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Matched Company Evidence Artifact
                  </div>

                  {selectedReq.evidenceTitle ? (
                    <div className="bg-emerald-950/20 p-3.5 rounded-lg border border-emerald-800/50 space-y-2">
                      <div className="font-bold text-emerald-300">{selectedReq.evidenceTitle}</div>
                      <div className="text-slate-300 text-xs leading-relaxed">
                        {selectedReq.evidenceExcerpt}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-950/30 p-3.5 rounded-lg border border-rose-800/70 space-y-2">
                      <div className="font-bold text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Potential Unverified Gap (No Matching Artifact in Bank)
                      </div>
                      <div className="text-rose-200/90 text-xs leading-relaxed">
                        {selectedReq.evidenceExcerpt}
                      </div>
                      <div className="pt-2 border-t border-rose-900/60 text-[11px] text-rose-300 font-medium">
                        Human Review Notice: Identified as an unverified requirement. Verify whether your organization or a proposed teaming partner possesses this clearance before committing proposal resources.
                      </div>
                    </div>
                  )}
                </div>

                {/* Go/No-Go Decision Engine Verdict */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-[11px] font-semibold uppercase text-slate-400 mb-2">
                    Capture Review Recommendation
                  </div>
                  {selectedReq.status === 'CRITICAL_GAP' ? (
                    <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-amber-200">
                      <strong>POTENTIAL GAP REQUIRING HUMAN REVIEW:</strong> Top Secret Facility Security Clearance was not found in your Evidence Bank. Verify compliance status with your FSO or identify a cleared teaming partner before proceeding with proposal development.
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-950/30 border border-blue-800/60 rounded-lg text-blue-200">
                      <strong>ALIGNED REQUIREMENT:</strong> High technical alignment (confidence: {selectedReq.confidence}). Requirement mapped directly to past performance evidence.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom CTA Card */}
        <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 p-6 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">
              Ready to test BidReady on your own solicitations?
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Get started with 2 complimentary document analyses on the Free Trial. No credit card required.
            </p>
          </div>
          <Button asChild className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-6">
            <Link href="/signup">
              Start Your Free Trial →
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
