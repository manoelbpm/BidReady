'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  FileText,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Building,
  XCircle,
  Clock,
  Trash2,
  Check,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Evidence, EvidenceVerificationStatus } from '@/types/models';
import { EvidenceService } from '@/lib/evidence/service';

const evidenceService = new EvidenceService();

export default function EvidenceLibraryPage() {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setEvidences(evidenceService.listEvidence('org-1'));
  }, []);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Cybersecurity');
  const [newIssuingOrg, setNewIssuingOrg] = useState('');
  const [newValidUntil, setNewValidUntil] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newFileName, setNewFileName] = useState('');

  const refreshList = () => {
    setEvidences(evidenceService.listEvidence('org-1'));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    evidenceService.createEvidence({
      organizationId: 'org-1',
      userId: 'user-1',
      title: newTitle,
      category: newCategory,
      issuingOrganization: newIssuingOrg,
      validUntil: newValidUntil ? new Date(newValidUntil).toISOString() : undefined,
      fileName: newFileName || `${newTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      tags: newTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    });

    setIsModalOpen(false);
    setNewTitle('');
    setNewIssuingOrg('');
    setNewValidUntil('');
    setNewTags('');
    setNewFileName('');
    refreshList();
  };

  const handleVerify = (id: string, approved: boolean) => {
    evidenceService.verifyEvidence(
      id,
      'org-1',
      'user-1',
      approved,
      approved ? undefined : 'Documentation does not meet minimum technical scope.'
    );
    refreshList();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this corporate evidence artifact? Associated requirement matches will be updated.')) {
      evidenceService.deleteEvidence(id, 'org-1');
      refreshList();
    }
  };

  const filtered = evidences.filter((ev) => {
    if (filterCategory !== 'all' && ev.category.toLowerCase() !== filterCategory.toLowerCase()) {
      return false;
    }
    if (filterStatus !== 'all' && ev.verification_status !== filterStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Company Evidence Library
          </h1>
          <p className="text-sm text-slate-500">
            Repository of corporate credentials, ISO/FedRAMP accreditations, insurance policies, and CPARS past performance.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Verified Evidence</span>
        </Button>
      </div>

      {/* Compliance Integrity Callout */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-4 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-blue-950 dark:text-blue-200">
            Strict Evidence Validity Rule
          </p>
          <p className="text-blue-800/90 dark:text-blue-400">
            The matching engine never assumes a certification is valid merely because a tender mentions it. Expired documents are flagged as compliance risks and cannot be submitted.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Status:</span>
          {['all', 'verified', 'pending_verification', 'expired', 'rejected'].map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(s)}
              className="text-xs capitalize h-7"
            >
              {s.replace('_', ' ')}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Categories</option>
            <option value="Cybersecurity">Cybersecurity</option>
            <option value="Certification">Certification</option>
            <option value="Past Performance">Past Performance</option>
            <option value="Insurance">Insurance</option>
          </select>
        </div>
      </div>

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((ev) => {
          const isExpired = ev.verification_status === 'expired' || EvidenceService.isExpired(ev.valid_until);

          return (
            <Card
              key={ev.id}
              className={`transition-all ${
                isExpired
                  ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                  : 'hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="text-xs">
                    {ev.category}
                  </Badge>

                  {ev.verification_status === 'verified' && !isExpired && (
                    <Badge variant="success" className="gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified Active</span>
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive" className="gap-1 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Expired Document</span>
                    </Badge>
                  )}
                  {ev.verification_status === 'pending_verification' && !isExpired && (
                    <Badge variant="warning" className="gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending Audit</span>
                    </Badge>
                  )}
                  {ev.verification_status === 'rejected' && (
                    <Badge variant="destructive" className="gap-1 text-[11px]">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Rejected</span>
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base mt-2">{ev.title}</CardTitle>
                {ev.description && (
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {ev.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {ev.issuing_organization && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>Issuing Body: {ev.issuing_organization}</span>
                  </div>
                )}
                {ev.file_name && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="truncate">{ev.file_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>
                    Valid Through:{' '}
                    {ev.valid_until
                      ? new Date(ev.valid_until).toLocaleDateString()
                      : 'Indefinite / Permanent'}
                  </span>
                </div>

                {ev.tags && ev.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {ev.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Human Verification Action Bar */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {ev.verification_status !== 'verified' && !isExpired && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerify(ev.id, true)}
                        className="text-[11px] h-7 gap-1 text-emerald-600 hover:text-emerald-700"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </Button>
                    )}
                    {ev.verification_status !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleVerify(ev.id, false)}
                        className="text-[11px] h-7 gap-1 text-rose-600 hover:text-rose-700"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </Button>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(ev.id)}
                    className="text-slate-400 hover:text-rose-600 h-7 px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Evidence Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Register Verified Evidence Artifact
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Document / Certification Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CMMC Level 2 Third-Party Assessment Report"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Certification">Certification</option>
                    <option value="Past Performance">Past Performance</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Compliance">Compliance</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Issuing Authority</label>
                  <input
                    type="text"
                    placeholder="e.g. DISA / BSI / Lloyd's"
                    value={newIssuingOrg}
                    onChange={(e) => setNewIssuingOrg(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Expiration Date (Leave blank if indefinite)
                  </label>
                  <input
                    type="date"
                    value={newValidUntil}
                    onChange={(e) => setNewValidUntil(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Document File Name</label>
                  <input
                    type="text"
                    placeholder="e.g. CMMC_Level2_Audit_2026.pdf"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. CMMC, DoD, Cyber, NIST-800-171"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Evidence Artifact</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
