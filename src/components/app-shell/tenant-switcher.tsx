'use client';

import React, { useState } from 'react';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TenantOption {
  id: string;
  name: string;
  role: string;
}

interface TenantSwitcherProps {
  currentOrgId: string;
  organizations: TenantOption[];
  onSelectTenant?: (orgId: string) => void;
}

export function TenantSwitcher({
  currentOrgId,
  organizations = [
    { id: 'org-1', name: 'Global Defense Corp', role: 'owner' },
    { id: 'org-2', name: 'Aerospace Systems Ltd', role: 'admin' },
  ],
  onSelectTenant,
}: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
        aria-expanded={isOpen}
      >
        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="max-w-[150px] truncate">{activeOrg?.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-slate-400">
              Select Organization
            </div>
            <div className="space-y-0.5">
              {organizations.map((org) => {
                const isSelected = org.id === activeOrg.id;
                return (
                  <button
                    key={org.id}
                    onClick={() => {
                      onSelectTenant?.(org.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                      isSelected ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                    )}
                  >
                    <div className="truncate">
                      <p className="truncate text-sm">{org.name}</p>
                      <p className="text-[11px] text-slate-400 capitalize">{org.role}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1 px-1">
              <button
                onClick={() => {
                  alert('Organization creation and invitation management will open.');
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Organization</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
