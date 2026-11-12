import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            Back to BidReady
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg text-white">BidReady</span>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold text-white">Terms of Service</h1>
          <p className="text-xs text-slate-500 font-mono">
            Last Updated: November 2026 &bull; Commercial Draft subject to appropriate legal counsel review
          </p>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">1. Service Nature & Operational Scope</h2>
            <p>
              BidReady is an operational workflow and tender intelligence productivity platform designed to assist commercial contractors in extracting requirements, dates, and compliance matrices from procurement solicitation documents.
            </p>
            <div className="p-4 rounded-xl border border-blue-900 bg-blue-950/40 text-blue-300 text-xs font-semibold">
              CRITICAL LEGAL DISCLAIMER: BidReady is not a law firm and does not provide legal advice, procurement counsel, or statutory interpretations. Using BidReady does not guarantee tender eligibility, regulatory compliance, or contract award.
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">2. Multi-Tenant Data Ownership & Confidentiality</h2>
            <p>
              Customers retain 100% intellectual property and ownership over all uploaded solicitation documents, proprietary evidence, and proposal drafts. BidReady enforces strict PostgreSQL Row Level Security (RLS) to ensure zero cross-tenant contamination. Customer documents are never used to train generalized artificial intelligence models.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">3. Subscriptions, Usage Allowances & Cancellation</h2>
            <p>
              Subscriptions renew automatically on a monthly cycle. Document analysis quotas are enforced server-side. Unused quotas do not roll over. Customers may cancel their subscription at any time via the Settings area, retaining full access through the end of their current paid billing period.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">4. Merchant of Record & International Taxes</h2>
            <p>
              Order processing, billing collection, and sales tax/VAT compliance for international transactions are administered via our authorized Merchant of Record (Paddle.com Market Ltd).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
