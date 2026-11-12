'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  MessageSquare,
  FileQuestion,
  ShieldCheck,
  CreditCard,
  UploadCloud,
  ChevronDown,
  Mail,
  BookOpen,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const faqs = [
  {
    q: 'How does BidReady guarantee zero AI hallucinations?',
    a: 'BidReady strictly requires every extracted mandatory requirement, deadline, or instruction to cite its exact page number, section title, and verbatim quotation from the uploaded file. If confidence is below threshold, it is automatically marked for manual verification.',
  },
  {
    q: 'What happens when an uploaded document has an expired certification?',
    a: 'The Evidence Matching Engine actively calculates the difference between current time and document validity dates. Expired certifications are flagged with the critical outcome EXPIRED_EVIDENCE and prevent the preparation status from moving to SUBMISSION_READY.',
  },
  {
    q: 'Are failed document uploads counted against our plan quota?',
    a: 'No. Our server-side subscription controller strictly deducts analysis units only when the processing pipeline succeeds in extracting valid requirements. Corrupted files or cancelled jobs are never charged.',
  },
  {
    q: 'How does billing work for international customers?',
    a: 'Billing is processed through our Merchant of Record (Paddle), handling international sales taxes (VAT, GST, US Sales Tax) automatically. You receive compliant tax invoices denominated in USD.',
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Help Center & Operations Support
        </h1>
        <p className="text-sm text-slate-500">
          Knowledge base, tender workflow guides, and dedicated support for proposal teams.
        </p>
      </div>

      {/* Guided Onboarding Checklist Box */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Quick Onboarding Workflow (First-Run Guide)
            </CardTitle>
            <Badge variant="default" className="text-[10px]">
              Step 1 of 4
            </Badge>
          </div>
          <CardDescription className="text-xs text-blue-900/90 dark:text-blue-300">
            Four simple steps to convert complex solicitations into actionable bid tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-blue-600">1. Evidence Library</div>
              <p className="text-slate-500 text-[11px]">Upload ISO, FedRAMP, insurance and CPARS credentials.</p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-blue-600">2. Ingest Solicitation</div>
              <p className="text-slate-500 text-[11px]">Upload PDF, DOCX or XLSX tender documents.</p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-blue-600">3. Run Matching</div>
              <p className="text-slate-500 text-[11px]">Correlate criteria against corporate credentials.</p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-blue-600">4. Audit Readiness</div>
              <p className="text-slate-500 text-[11px]">Resolve missing evidence and verify deadlines.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frequently Asked Questions */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 space-y-1.5">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {faq.q}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {faq.a}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Support Inquiries Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Contact Dedicated Support
          </CardTitle>
          <CardDescription>
            Reach our operations desk for assistance with document parsing or custom integration requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert('Support ticket submitted. Our operations desk will respond within 4 business hours.');
            }}
            className="space-y-4 text-xs"
          >
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Topic / Inquiry Area</label>
              <select className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                <option>Document Ingestion or Parsing Inquiries</option>
                <option>Evidence Matching Calibration</option>
                <option>Plan Quotas & Invoicing</option>
                <option>Security & Compliance Question</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Detailed Message</label>
              <textarea
                rows={4}
                required
                placeholder="Describe the issue or assistance needed..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Submit Support Inquiry</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
