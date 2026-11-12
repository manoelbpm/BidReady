import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-extrabold text-white">Privacy & Data Governance Policy</h1>
          <p className="text-xs text-slate-500 font-mono">
            Compliant with GDPR & LGPD Principles &bull; Confidentiality First Architecture
          </p>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <div className="p-4 rounded-xl border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-3">
            <Lock className="w-5 h-5 flex-shrink-0" />
            <span>
              <strong>Zero Model Training Guarantee:</strong> Proprietary tender files, pricing schedules, and company evidence uploaded to BidReady are never transmitted to public training pools or used to train third-party foundation models.
            </span>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">1. Data Storage & Encryption</h2>
            <p>
              Tender documents and evidence files are stored in private, encrypted cloud storage buckets with cryptographic access keys. File paths are isolated by organization and user identifiers (<code className="text-xs font-mono bg-slate-900 px-1 py-0.5 rounded">&lt;org_id&gt;/&lt;user_id&gt;/...</code>).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">2. Right to Deletion & Data Portability</h2>
            <p>
              Customers may delete individual documents, evidence artifacts, or their entire organization account at any time. Deletion operations scrub database metadata and remove private storage binary blobs permanently.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">3. Contact for Data Protection</h2>
            <p>
              For data protection questions, compliance certificates, or GDPR/LGPD data subject requests, contact <code className="text-xs font-mono text-blue-400">privacy@bidready.com</code>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
