'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileSearch,
  Plus,
  Calendar,
  Tag,
  ShieldCheck,
  ChevronRight,
  Filter,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  User,
  History,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Opportunity, OpportunityStage, OpportunityPriority, ReadinessOverview, OpportunityActivity } from '@/types/models';
import { OpportunityService } from '@/lib/opportunities/service';

const oppService = new OpportunityService();

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);

  useEffect(() => {
    setOpportunities(oppService.listOpportunities('org-1'));
  }, []);

  const refreshList = () => {
    setOpportunities(
      oppService.listOpportunities('org-1', {
        stage: stageFilter !== 'all' ? (stageFilter as OpportunityStage) : undefined,
        priority: priorityFilter !== 'all' ? (priorityFilter as OpportunityPriority) : undefined,
        search: searchTerm || undefined,
      })
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setOpportunities(
      oppService.listOpportunities('org-1', {
        stage: stageFilter !== 'all' ? (stageFilter as OpportunityStage) : undefined,
        priority: priorityFilter !== 'all' ? (priorityFilter as OpportunityPriority) : undefined,
        search: e.target.value,
      })
    );
  };

  const selectedOpp = selectedOppId
    ? oppService.getOpportunity(selectedOppId, 'org-1')
    : null;

  const selectedReadiness: ReadinessOverview | null = selectedOppId
    ? oppService.getReadinessOverview(selectedOppId, 'org-1')
    : null;

  const selectedActivities: OpportunityActivity[] = selectedOppId
    ? oppService.getActivities(selectedOppId, 'org-1')
    : [];

  const handleStageChange = (newStage: OpportunityStage) => {
    if (!selectedOppId) return;
    oppService.updateOpportunity(selectedOppId, 'org-1', 'user-1', { stage: newStage });
    refreshList();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tender Opportunities Pipeline
          </h1>
          <p className="text-sm text-slate-500">
            Lifecycle management, evidence readiness scoring, and audit trails for all active bids.
          </p>
        </div>
        <Link href="/upload">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            <span>Upload New Tender Intake</span>
          </Button>
        </Link>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by tender title, reference code, buyer, or description..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setOpportunities(
                oppService.listOpportunities('org-1', {
                  stage: e.target.value !== 'all' ? (e.target.value as OpportunityStage) : undefined,
                  priority: priorityFilter !== 'all' ? (priorityFilter as OpportunityPriority) : undefined,
                  search: searchTerm || undefined,
                })
              );
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Stages</option>
            <option value="DISCOVERED">DISCOVERED</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="IN_PREPARATION">IN PREPARATION</option>
            <option value="READY_FOR_REVIEW">READY FOR REVIEW</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="WON">WON</option>
            <option value="LOST">LOST</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setOpportunities(
                oppService.listOpportunities('org-1', {
                  stage: stageFilter !== 'all' ? (stageFilter as OpportunityStage) : undefined,
                  priority: e.target.value !== 'all' ? (e.target.value as OpportunityPriority) : undefined,
                  search: searchTerm || undefined,
                })
              );
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Opportunity Cards */}
      <div className="grid grid-cols-1 gap-4">
        {opportunities.map((opp) => {
          const readiness = oppService.getReadinessOverview(opp.id, 'org-1');

          return (
            <Card
              key={opp.id}
              className="hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
              onClick={() => setSelectedOppId(opp.id)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                        {opp.reference_code || 'UNTITLED-SOL'}
                      </span>

                      <Badge
                        variant={
                          opp.priority === 'urgent'
                            ? 'destructive'
                            : opp.priority === 'high'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-[10px] uppercase"
                      >
                        {opp.priority || 'medium'} priority
                      </Badge>

                      <Badge variant="outline" className="text-xs uppercase font-semibold">
                        {opp.stage.replace('_', ' ')}
                      </Badge>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 dark:text-white hover:text-blue-600 transition-colors">
                      {opp.title}
                    </h2>

                    {opp.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {opp.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Buyer: {opp.issuing_body || 'Not Specified'}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Submission Due: {opp.submission_deadline ? new Date(opp.submission_deadline).toLocaleDateString() : 'TBD'}
                      </span>
                      {opp.estimated_value && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                            <DollarSign className="w-3.5 h-3.5" />
                            {opp.estimated_value.toLocaleString()} {opp.currency}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Readiness Breakdown Pill */}
                  <div className="flex items-center gap-6 lg:border-l lg:border-slate-200 dark:lg:border-slate-800 lg:pl-6 flex-shrink-0">
                    <div className="text-left lg:text-right space-y-1">
                      <div className="flex items-center gap-1.5 lg:justify-end">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Readiness Status:
                        </span>
                        <Badge
                          variant={
                            readiness.readiness_stage === 'SUBMISSION_READY'
                              ? 'success'
                              : readiness.readiness_stage === 'ACTION_REQUIRED'
                              ? 'destructive'
                              : 'warning'
                          }
                          className="text-[10px]"
                        >
                          {readiness.readiness_stage.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-2 lg:justify-end">
                        <span className="text-emerald-600 font-semibold">{readiness.matched_count} Matched</span>
                        <span>&bull;</span>
                        <span className="text-rose-600 font-semibold">{readiness.missing_evidence_count + readiness.expired_evidence_count} Missing/Expired</span>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" className="gap-1 text-xs">
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Opportunity Detail Drawer / Modal */}
      {selectedOpp && selectedReadiness && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-blue-600 font-semibold bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                    {selectedOpp.reference_code}
                  </span>
                  <Badge variant="outline" className="uppercase text-xs font-semibold">
                    {selectedOpp.stage.replace('_', ' ')}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedOpp.title}
                </h2>
                <p className="text-xs text-slate-500">
                  Buyer: {selectedOpp.issuing_body} &bull; Assigned: {selectedOpp.assigned_team_member || 'Unassigned'}
                </p>
              </div>

              <button
                onClick={() => setSelectedOppId(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {/* Stage Selector */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between gap-4 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Update Opportunity Workflow Stage:
              </span>
              <select
                value={selectedOpp.stage}
                onChange={(e) => handleStageChange(e.target.value as OpportunityStage)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
              >
                <option value="DISCOVERED">DISCOVERED</option>
                <option value="UNDER_REVIEW">UNDER REVIEW</option>
                <option value="QUALIFICATION">QUALIFICATION</option>
                <option value="IN_PREPARATION">IN PREPARATION</option>
                <option value="READY_FOR_REVIEW">READY FOR REVIEW</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="WON">WON</option>
                <option value="LOST">LOST</option>
                <option value="WITHDRAWN">WITHDRAWN</option>
              </select>
            </div>

            {/* Transparent Readiness Overview Box */}
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    Tender Evidence Readiness Audit
                  </CardTitle>
                  <Badge
                    variant={
                      selectedReadiness.readiness_stage === 'SUBMISSION_READY'
                        ? 'success'
                        : selectedReadiness.readiness_stage === 'ACTION_REQUIRED'
                        ? 'destructive'
                        : 'warning'
                    }
                  >
                    {selectedReadiness.readiness_stage.replace('_', ' ')}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-blue-900/90 dark:text-blue-300 font-medium">
                  {selectedReadiness.calculation_explanation}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Reqs</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedReadiness.total_requirements}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold">Matched</span>
                    <p className="text-lg font-bold text-emerald-600 mt-0.5">
                      {selectedReadiness.matched_count}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900">
                    <span className="text-[10px] text-amber-600 uppercase font-semibold">Partial</span>
                    <p className="text-lg font-bold text-amber-600 mt-0.5">
                      {selectedReadiness.partially_matched_count}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900">
                    <span className="text-[10px] text-rose-600 uppercase font-semibold">Missing Evidence</span>
                    <p className="text-lg font-bold text-rose-600 mt-0.5">
                      {selectedReadiness.missing_evidence_count}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900">
                    <span className="text-[10px] text-rose-600 uppercase font-semibold">Expired</span>
                    <p className="text-lg font-bold text-rose-600 mt-0.5">
                      {selectedReadiness.expired_evidence_count}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 mt-3 italic">
                  &bull; {selectedReadiness.disclaimer}
                </p>
              </CardContent>
            </Card>

            {/* Activity Trail */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-400" />
                Audit Trail & Activity Log
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
                {selectedActivities.map((act) => (
                  <div key={act.id} className="flex items-start justify-between gap-4 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {act.description}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        By {act.user_name || 'Team Member'} &bull; Action: {act.action}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {new Date(act.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
              <Link href="/checklist">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <span>Open Interactive Compliance Checklist</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <Button size="sm" onClick={() => setSelectedOppId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
