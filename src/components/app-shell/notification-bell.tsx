'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, AlertCircle, Clock, Check, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InternalNotification } from '@/types/models';

interface NotificationBellProps {
  initialNotifications?: InternalNotification[];
}

export function NotificationBell({
  initialNotifications = [
    {
      id: 'notif-1',
      organization_id: 'org-1',
      type: 'DEADLINE_APPROACHING',
      title: 'Clarification Deadline in 4 Days',
      message: 'FAA NextGen Radar (RFP-2026-FAA-098) clarification questions cutoff is Nov 25 at 17:00 EST.',
      severity: 'warning',
      link_url: '/opportunities',
      is_read: false,
      created_at: '2026-11-10T08:30:00Z',
    },
    {
      id: 'notif-2',
      organization_id: 'org-1',
      type: 'EVIDENCE_EXPIRING',
      title: 'Commercial Liability Policy Expired',
      message: 'Commercial General Liability Policy ($5M) has expired. Renewal certificate must be uploaded before final tender submission.',
      severity: 'critical',
      link_url: '/evidence',
      is_read: false,
      created_at: '2026-11-10T04:00:00Z',
    },
    {
      id: 'notif-3',
      organization_id: 'org-1',
      type: 'REVIEW_PENDING',
      title: 'Compliance Matching Requires Verification',
      message: 'FAA Radar Framework: 1 desirable requirement has low extraction confidence (82%) and requires manual review.',
      severity: 'info',
      link_url: '/checklist',
      is_read: true,
      created_at: '2026-11-09T14:00:00Z',
    },
  ],
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InternalNotification[]>(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Internal Notifications
                </span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No notifications. All tender deadlines and evidence are up to date.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`p-3 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      !n.is_read ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {n.severity === 'critical' ? (
                        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      ) : n.severity === 'warning' ? (
                        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                          {n.message}
                        </p>
                        {n.link_url && (
                          <Link
                            href={n.link_url}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline pt-0.5"
                          >
                            <span>Inspect Action</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
