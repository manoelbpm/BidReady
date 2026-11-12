'use client';

import React from 'react';
import { Menu, ShieldAlert, FileText } from 'lucide-react';
import { TenantSwitcher } from './tenant-switcher';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export function Header({ onToggleMobileMenu }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <TenantSwitcher
            currentOrgId="org-1"
            organizations={[
              { id: 'org-1', name: 'Global Defense Corp', role: 'owner' },
              { id: 'org-2', name: 'Aerospace Systems Ltd', role: 'admin' },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Compliance Guard Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <ShieldAlert className="w-3.5 h-3.5 text-blue-500" />
          <span>Tenant Isolated &bull; Traceable Extraction</span>
        </div>

        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
