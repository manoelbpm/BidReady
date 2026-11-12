import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Lock,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { SAAS_PLANS } from '@/types/billing';

export const metadata: Metadata = {
  title: 'BidReady — RFP Requirement Decomposition & Evidence Intelligence for IT & Defense Contractors',
  description:
    'Turn 100-page federal, state, and commercial RFPs into audited compliance matrices with verifiable page citations and instant capability gap detection.',
  openGraph: {
    title: 'BidReady — RFP Compliance & Evidence Intelligence',
    description:
      'Automated requirement extraction and past performance matching for US B2B IT & Cybersecurity vendors.',
    type: 'website',
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* 1. Header & Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
                BidReady
                <span className="text-[10px] uppercase font-semibold tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/50">
                  GovCon
                </span>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#sample-matrix" className="hover:text-white transition-colors">
              Sample Matrix
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 text-sm h-9 px-4 font-medium"
            >
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 overflow-hidden border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />
        
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/70 border border-blue-800/60 text-blue-300 text-xs font-medium mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Built for US Federal, State & Commercial RFP Bidders
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.12]">
            Turn 100-Page RFPs Into <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              Audited Compliance Matrices
            </span>{' '}
            in Minutes.
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Extract technical requirements, cross-reference your past performance evidence, and surface critical compliance gaps before spending weeks writing doomed proposals.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base shadow-xl shadow-blue-600/20"
            >
              <Link href="/signup">
                Start 2 Free Document Analyses
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto h-12 px-6 border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 font-medium text-base"
            >
              <Link href="/demo">
                <FileText className="w-4 h-4 mr-2 text-blue-400" />
                Explore Interactive Demo
              </Link>
            </Button>
          </div>

          {/* Social Proof & Trust Badges */}
          <div className="pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-400 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Zero Long-Term Lock-in</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span>Enterprise Zero Data Training</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Verifiable Page-Level Citations</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Problem Section: The Compliance Trap */}
      <section className="py-20 bg-slate-900/40 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-bold tracking-widest text-blue-400 mb-3">
              The Cost of Manual Proposal Shredding
            </h2>
            <p className="text-3xl font-bold text-white tracking-tight">
              Bidding on complex RFPs shouldn&apos;t mean drowning in 200 pages of PDF boilerplate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-slate-900/70 border-slate-800 text-slate-200">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg font-bold text-white">The Disqualification Trap</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Missing a single mandatory clause buried on page 84 of an attachment disqualifies your entire bid before evaluators even score your technical proposal.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800 text-slate-200">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 mb-4">
                  <Layers className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg font-bold text-white">Burned Engineering Hours</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Senior cloud architects billing $225/hr spend 20 hours reading dense SOWs just to assemble an initial compliance matrix, draining project profitability.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800 text-slate-200">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 mb-4">
                  <Search className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg font-bold text-white">Scattered Past Performance</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Case studies, CPARs, and security audit certifications are scattered across drives and old inboxes. Matching the right proof is a constant fire drill.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. How It Works (3 Steps) */}
      <section id="how-it-works" className="py-24 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-bold tracking-widest text-blue-400 mb-3">
              Automated RFP Intelligence
            </h2>
            <p className="text-3xl font-bold text-white tracking-tight">
              Three steps from raw solicitation to Go/No-Go clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="flex flex-col p-6 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                  1
                </span>
                <h3 className="font-bold text-white text-base">Upload Solicitation</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Drop your RFP, Statement of Work (SOW), or task order file. Our parsing engine reads digital text, tables, headers, and clauses in seconds.
              </p>
              <div className="mt-auto text-xs text-slate-500 font-mono bg-slate-950 p-2.5 rounded border border-slate-800/80">
                Supports: Native PDF, DOCX, XLSX (Scanned PDFs flagged)
              </div>
            </div>

            <div className="flex flex-col p-6 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                  2
                </span>
                <h3 className="font-bold text-white text-base">Decompose & Match</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                BidReady extracts mandatory requirements with direct page citations and cross-references your company&apos;s Evidence Bank to flag compliance gaps.
              </p>
              <div className="mt-auto text-xs text-slate-500 font-mono bg-slate-950 p-2.5 rounded border border-slate-800/80">
                NIST, CMMC, FAR, SOW Mandates
              </div>
            </div>

            <div className="flex flex-col p-6 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                  3
                </span>
                <h3 className="font-bold text-white text-base">Export Matrix</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Export an executive compliance cross-reference matrix in CSV or Google Sheets, fully mapped to your evidence library and proposal writers.
              </p>
              <div className="mt-auto text-xs text-slate-500 font-mono bg-slate-950 p-2.5 rounded border border-slate-800/80">
                1-Click Export for Proposal Reviews
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Sample Verifiable Matrix Section */}
      <section id="sample-matrix" className="py-24 bg-slate-900/30 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="text-blue-400 border-blue-800 mb-3 text-xs">
              Synthetic Public Benchmark
            </Badge>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
              Real Citation Traceability, Zero Guesswork.
            </h2>
            <p className="text-slate-400 text-sm">
              Below is an actual extraction from our public benchmark case (FAA NextGen Radar Telemetry Solicitation — DTFAWA-26-R-SAMPLE).
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
            <div className="bg-slate-900/90 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-sm text-white">
                  FAA NextGen Radar Telemetry Upgrade (Case DTFAWA-26-R-SAMPLE)
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                <span>Pages: 142</span>
                <span>•</span>
                <span>Requirements: 84</span>
                <span>•</span>
                <span className="text-rose-400 font-bold">Gaps: 4</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Req #</th>
                    <th className="px-5 py-3.5">Page Citation</th>
                    <th className="px-5 py-3.5">Mandatory Requirement Clause</th>
                    <th className="px-5 py-3.5">Evidence Matched</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  <tr className="hover:bg-slate-900/30">
                    <td className="px-5 py-4 font-mono font-medium text-slate-400">R-012</td>
                    <td className="px-5 py-4 font-mono text-blue-400">Page 14, §3.2</td>
                    <td className="px-5 py-4 font-medium text-white max-w-xs">
                      Offeror must demonstrate active compliance with NIST SP 800-171 Rev 2 for Controlled Unclassified Information.
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      SOC 2 Type II + NIST Assessment Report (2026)
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-800/60 font-mono text-[11px]">
                        MATCHED 100%
                      </Badge>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-900/30">
                    <td className="px-5 py-4 font-mono font-medium text-slate-400">R-045</td>
                    <td className="px-5 py-4 font-mono text-blue-400">Page 38, §5.1</td>
                    <td className="px-5 py-4 font-medium text-white max-w-xs">
                      Prime vendor must have 5+ years experience in ADS-B radar data telemetry ingestion.
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      Past Performance: DoD Telemetry Modernization Contract
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-800/60 font-mono text-[11px]">
                        MATCHED 95%
                      </Badge>
                    </td>
                  </tr>

                  <tr className="hover:bg-rose-950/10 bg-rose-950/5">
                    <td className="px-5 py-4 font-mono font-medium text-rose-400">R-068</td>
                    <td className="px-5 py-4 font-mono text-rose-400">Page 88, §H.7</td>
                    <td className="px-5 py-4 font-medium text-white max-w-xs">
                      Offeror must hold an active Top Secret Facility Security Clearance (FCL) sponsored by DSS at time of proposal submission.
                    </td>
                    <td className="px-5 py-4 text-rose-400/80 italic font-medium">
                      [No verified Top Secret FCL found in Evidence Bank]
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Badge className="bg-rose-950/80 text-rose-400 border-rose-800 font-mono text-[11px]">
                        CRITICAL GAP
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-900/60 p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                Illustrative Benchmark: Surfaces missing Facility Clearance as an unverified requirement, alerting capture teams to perform human verification before committing proposal development resources.
              </span>
              <Link href="/demo" className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center">
                Launch Interactive Demo Walkthrough →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Human Review Safeguard Banner */}
      <section className="py-14 bg-gradient-to-r from-blue-950/30 via-slate-900/50 to-indigo-950/30 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-white mb-3">
            We accelerate proposal capture. You remain the final authority.
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto">
            BidReady is a specialized requirements decomposition and evidence cross-referencing tool. It does <strong>not</strong> hallucinate bids, replace legal counsel, or promise contract wins. All procurement decisions in federal and commercial bidding require human verification of citations and scoring criteria.
          </p>
        </div>
      </section>

      {/* 7. Pricing Section */}
      <section id="pricing" className="py-24 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-bold tracking-widest text-blue-400 mb-3">
              Transparent, Predictable Pricing
            </h2>
            <p className="text-3xl font-bold text-white tracking-tight mb-4">
              Flexible plans that scale with your monthly bid pipeline.
            </p>
            <p className="text-slate-400 text-sm">
              All plans include full citation extraction. Upgrade, downgrade, or cancel anytime online.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Free Tier */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-1">{SAAS_PLANS.free.name}</h3>
                <p className="text-xs text-slate-400 mb-4 h-10">{SAAS_PLANS.free.description}</p>
                <div className="text-3xl font-extrabold text-white mb-6">
                  $0 <span className="text-xs text-slate-500 font-normal">/ month</span>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Monthly Allowance:
                </div>
                <div className="text-sm font-bold text-blue-400 mb-6 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> 2 Document Analyses / mo
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  {SAAS_PLANS.free.features.slice(1).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild variant="outline" className="w-full border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs">
                <Link href="/signup">Start Free Trial</Link>
              </Button>
            </div>

            {/* Starter Tier */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-1">{SAAS_PLANS.starter.name}</h3>
                <p className="text-xs text-slate-400 mb-4 h-10">{SAAS_PLANS.starter.description}</p>
                <div className="text-3xl font-extrabold text-white mb-6">
                  ${SAAS_PLANS.starter.monthlyPriceUsd} <span className="text-xs text-slate-500 font-normal">/ month</span>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Monthly Allowance:
                </div>
                <div className="text-sm font-bold text-blue-400 mb-6 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> 10 Document Analyses / mo
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  {SAAS_PLANS.starter.features.slice(1).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs">
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>

            {/* Pro Tier (Popular) */}
            <div className="rounded-xl border-2 border-blue-500 bg-slate-900/90 p-6 flex flex-col justify-between relative shadow-xl shadow-blue-900/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full">
                Most Popular
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">{SAAS_PLANS.pro.name}</h3>
                <p className="text-xs text-slate-400 mb-4 h-10">{SAAS_PLANS.pro.description}</p>
                <div className="text-3xl font-extrabold text-white mb-6">
                  ${SAAS_PLANS.pro.monthlyPriceUsd} <span className="text-xs text-slate-500 font-normal">/ month</span>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-3">
                  Monthly Allowance:
                </div>
                <div className="text-sm font-bold text-blue-400 mb-6 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> 40 Document Analyses / mo
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  {SAAS_PLANS.pro.features.slice(1).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium">
                <Link href="/signup">Start Free Trial</Link>
              </Button>
            </div>

            {/* Business Tier */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-1">{SAAS_PLANS.business.name}</h3>
                <p className="text-xs text-slate-400 mb-4 h-10">{SAAS_PLANS.business.description}</p>
                <div className="text-3xl font-extrabold text-white mb-6">
                  ${SAAS_PLANS.business.monthlyPriceUsd} <span className="text-xs text-slate-500 font-normal">/ month</span>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Monthly Allowance:
                </div>
                <div className="text-sm font-bold text-blue-400 mb-6 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> 120 Document Analyses / mo
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  {SAAS_PLANS.business.features.slice(1).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild variant="outline" className="w-full border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs">
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Section */}
      <section id="faq" className="py-24 bg-slate-900/30 border-b border-slate-800/80">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs uppercase font-bold tracking-widest text-blue-400 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-3xl font-bold text-white tracking-tight">
              Everything you need to know about BidReady.
            </p>
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-900/60 border-slate-800 text-slate-200">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Will my proprietary past performance data or RFP documents be used to train AI models?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                <strong>Never.</strong> BidReady enforces strict multi-tenant database isolation (Row-Level Security) and uses enterprise zero-data-retention API contracts. Your proprietary documents, case studies, and bid artifacts belong strictly to your organization.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 text-slate-200">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Does BidReady guarantee that our proposal will win the contract?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                <strong>No software can honestly guarantee a contract win.</strong> Government and enterprise contract awards depend on pricing reasonableness, past performance CPAR ratings, and evaluator discretion. BidReady guarantees you never get disqualified for clerical oversight and cuts compliance matrix prep time by 80%.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 text-slate-200">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Can BidReady handle scanned PDFs and messy federal formats?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                BidReady natively parses digital text from PDF, DOCX, and XLSX files, including complex multi-column tables, amendment attachments, and structured federal schedules. However, BidReady does not perform OCR on scanned image-only PDFs. If a scanned PDF lacking an extractable text layer is uploaded, the system automatically detects it, displays an alert, and releases your quota without consuming analysis credits, prompting you to provide a searchable PDF or Word document.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 text-slate-200">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  How does BidReady differ from running ChatGPT or Claude?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                General LLMs cannot maintain a structured, persistent evidence bank of your company&apos;s case studies, lack deterministic page citations, and frequently hallucinate or drop clauses when processing 100+ page documents. BidReady provides verifiable citation provenance and audit trails for procurement professionals.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 text-slate-200">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Can I cancel my subscription if our bidding cycle slows down?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 leading-relaxed">
                Yes, anytime with one click in your billing settings via our Paddle Customer Portal. There are no annual lock-ins, cancellation penalties, or sales calls required.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 9. Final Call to Action */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
            Stop losing weekends to 200-page solicitation PDFs.
          </h2>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Join forward-thinking B2B IT contractors who analyze requirements with surgical precision and make instant Go/No-Go decisions.
          </p>
          <Button
            asChild
            size="lg"
            className="h-13 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base shadow-xl shadow-blue-600/25"
          >
            <Link href="/signup">
              Get Started Free — Analyze Your First RFP in 3 Minutes
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
          <div className="mt-4 text-xs text-slate-500">
            No credit card required. 2 complimentary monthly analyses included on Free Trial.
          </div>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-300">BidReady GovCon Intelligence</span>
            <span>© 2026 BidReady. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">
              Terms of Service
            </Link>
            <Link href="/support" className="hover:text-slate-300 transition-colors">
              Support
            </Link>
            <Link href="/demo" className="text-blue-400 hover:text-blue-300 transition-colors">
              Interactive Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
