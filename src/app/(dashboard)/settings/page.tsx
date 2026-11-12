'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  Users,
  CreditCard,
  Shield,
  Activity,
  HardDrive,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubscriptionRecord, QuotaCheckResult, SAAS_PLANS } from '@/types/billing';
import { UsageAuditEntry } from '@/lib/billing/subscription-service';

function SettingsContent() {
  const searchParams = useSearchParams();
  const organizationId = searchParams?.get('orgId') || 'e2e00000-0000-4000-a000-000000000001';

  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [quota, setQuota] = useState<QuotaCheckResult | null>(null);
  const [usageLogs, setUsageLogs] = useState<UsageAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSubscriptionData = async () => {
    try {
      const res = await fetch(`/api/billing/subscription?orgId=${organizationId}`);
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription);
        setQuota(data.quota);
        setUsageLogs(data.recentUsageLogs || []);
      }
    } catch (e) {
      console.error('Error loading subscription', e);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, [organizationId]);

  const handleOpenCustomerPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      const data = await res.json();
      if (data.success && data.portalUrl) {
        window.open(data.portalUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert(data.error || 'Unable to open billing portal. Please verify your subscription status.');
      }
    } catch (e) {
      console.error('Error opening portal:', e);
      alert('Network error communicating with billing portal.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    // Direct user to secure Paddle customer portal to process authentic cancellation
    await handleOpenCustomerPortal();
  };

  const handleReactivateSubscription = async () => {
    // Direct user to secure Paddle customer portal to manage reactivation
    await handleOpenCustomerPortal();
  };

  const members = [
    { name: 'Sarah Jenkins', email: 'sarah.jenkins@defensecorp.com', role: 'Owner' },
    { name: 'Marcus Sterling', email: 'marcus.s@defensecorp.com', role: 'Admin' },
    { name: 'David Vance', email: 'david.vance@defensecorp.com', role: 'Member' },
  ];

  const planDef = subscription ? SAAS_PLANS[subscription.planId] : SAAS_PLANS.pro;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Organization & Usage Settings
        </h1>
        <p className="text-sm text-slate-500">
          Manage your organization workspace, team memberships, usage quotas, and security boundaries.
        </p>
      </div>

      {/* Organization Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Workspace Organization
              </CardTitle>
              <CardDescription>
                Primary tenant identifier and commercial details.
              </CardDescription>
            </div>
            <Badge variant="success">Active Tenant</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Organization Name
              </label>
              <input
                type="text"
                readOnly
                value="Global Defense Corp"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Tenant Slug
              </label>
              <input
                type="text"
                readOnly
                value="global-defense-corp-us"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription & Usage Quotas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Subscription & Capacity
              </CardTitle>
              <CardDescription>
                Current plan tier, server-enforced quotas, and billing cycle.
              </CardDescription>
            </div>
            <Link href="/pricing">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <span>Change Plan / Compare Tiers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 uppercase">Plan Tier</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {planDef.name}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant={
                    subscription?.status === 'active'
                      ? 'success'
                      : subscription?.status === 'past_due'
                      ? 'warning'
                      : 'destructive'
                  }
                  className="capitalize text-[10px]"
                >
                  {subscription?.status || 'Active'}
                </Badge>
                {subscription?.cancelAtPeriodEnd && (
                  <Badge variant="warning" className="text-[10px]">
                    Cancels at period end
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 uppercase">Analyses Allowance</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {subscription?.analysesUsedInPeriod || 0} / {subscription?.monthlyAnalysesLimit || 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {quota?.remaining ?? 0} analyses remaining this period
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 uppercase">Current Billing Cycle</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                Ends {subscription ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'Dec 01, 2026'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Auto-renews via Paddle Sandbox
              </p>
            </div>
          </div>

          {/* Customer Portal & Subscription Management */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Subscription Management (Paddle MoR Sandbox):
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={handleOpenCustomerPortal}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Manage Billing & Invoices ↗
              </Button>
              {subscription?.cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={handleReactivateSubscription}
                  className="text-xs text-emerald-600 hover:text-emerald-700"
                >
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={handleCancelSubscription}
                  className="text-xs text-rose-600 hover:text-rose-700"
                >
                  Cancel Plan
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Audit Trail */}
      {usageLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Document Consumption Logs
            </CardTitle>
            <CardDescription>
              Audit trail of analyses executed. Failed runs are never deducted from your allowance.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-2.5">Date & Time</th>
                  <th className="px-6 py-2.5">Status</th>
                  <th className="px-6 py-2.5">Charged</th>
                  <th className="px-6 py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usageLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(log.recordedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      {log.successfulRun ? (
                        <Badge variant="success" className="text-[10px]">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          Failed
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                      {log.analysesCounted > 0 ? '1 analysis' : '0 (no charge)'}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {log.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Authorized Team Members
            </CardTitle>
            <CardDescription>
              Role-Based Access Control (RBAC) enforced within this organization boundary.
            </CardDescription>
          </div>
          <Button size="sm">Invite Member</Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => (
                <tr key={m.email}>
                  <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">
                    {m.name}
                  </td>
                  <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">{m.email}</td>
                  <td className="px-6 py-3.5">
                    <Badge variant={m.role === 'Owner' ? 'default' : 'outline'}>{m.role}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
