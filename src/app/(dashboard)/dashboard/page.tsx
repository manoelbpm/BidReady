import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  ChevronRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Dashboard | BidReady Tender Intelligence',
};

export default function DashboardPage() {
  const stats = [
    {
      title: 'Active Tenders',
      value: '4',
      change: '+2 this month',
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      title: 'Extracted Requirements',
      value: '142',
      change: '118 mandatory · 24 desirable',
      icon: CheckCircle2,
      color: 'text-emerald-600',
    },
    {
      title: 'Upcoming Deadlines',
      value: '3',
      change: 'Next: 4 days remaining',
      icon: Clock,
      color: 'text-amber-600',
    },
    {
      title: 'Flagged for Review',
      value: '7',
      change: 'Low confidence / Missing info',
      icon: AlertTriangle,
      color: 'text-rose-600',
    },
  ];

  const recentTenders = [
    {
      id: 'opp-1',
      title: 'DOD Advanced Logistics & Automated Warehousing RFP',
      reference: 'RFP-2026-LOG-0042',
      buyer: 'US Department of Defense',
      deadline: '2026-11-28',
      status: 'review',
      extractedReqs: 58,
      sourcePages: 84,
      confidence: '98%',
    },
    {
      id: 'opp-2',
      title: 'NATO Secure Tactical Communications Infrastructure',
      reference: 'NATO-NCI-COMM-26',
      buyer: 'NATO Communications and Information Agency',
      deadline: '2026-12-05',
      status: 'analyzing',
      extractedReqs: 41,
      sourcePages: 112,
      confidence: '94%',
    },
    {
      id: 'opp-3',
      title: 'FAA NextGen Radar Telemetry Processing Framework',
      reference: 'FAA-26-RAD-789',
      buyer: 'Federal Aviation Administration',
      deadline: '2026-12-15',
      status: 'bid_decision',
      extractedReqs: 43,
      sourcePages: 62,
      confidence: '99%',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tender Command Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automated requirement extraction, deadline tracking, and compliance checklists.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/upload">
            <Button className="gap-2">
              <UploadCloud className="w-4 h-4" />
              <span>Upload Tender Document</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Legal & Compliance Notice Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950 dark:text-blue-200">
            Strict Source Traceability & Zero AI Hallucination Policy
          </p>
          <p className="text-blue-800/90 dark:text-blue-400">
            Every requirement is cited directly from page and section coordinates of the uploaded tender file. BidReady does not invent certifications, qualifications, or pricing. This system is a workflow productivity assistant and does not constitute formal legal counsel.
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {stat.title}
                  </p>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">{stat.change}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Analyzed Tenders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Tender Analyses</CardTitle>
            <CardDescription>
              Tenders under review with traceable requirements and deadline monitoring.
            </CardDescription>
          </div>
          <Link href="/opportunities">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Tender Opportunity</th>
                  <th className="px-6 py-3">Issuing Buyer</th>
                  <th className="px-6 py-3">Submission Due</th>
                  <th className="px-6 py-3">Requirements</th>
                  <th className="px-6 py-3">Extraction Confidence</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {recentTenders.map((opp) => (
                  <tr
                    key={opp.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {opp.title}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {opp.reference}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">
                      {opp.buyer}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 text-xs font-medium">
                      {opp.deadline}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {opp.extractedReqs} items
                      </span>
                      <span className="text-slate-400 block text-[11px]">
                        from {opp.sourcePages} pages
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="success" className="text-xs">
                        {opp.confidence}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={opp.status === 'analyzing' ? 'warning' : 'default'}
                        className="capitalize text-xs"
                      >
                        {opp.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/opportunities`}>
                        <Button variant="ghost" size="sm" className="text-xs font-semibold">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
