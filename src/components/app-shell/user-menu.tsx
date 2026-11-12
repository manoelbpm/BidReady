'use client';

import React, { useState } from 'react';
import { User, LogOut, ShieldCheck, ChevronDown } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';

interface UserMenuProps {
  userEmail?: string;
  userName?: string;
}

export function UserMenu({
  userEmail = 'analyst@defensecorp.com',
  userName = 'Sarah Jenkins',
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-semibold text-xs flex items-center justify-center">
          {userName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase()}
        </div>
        <div className="text-left hidden md:block">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
            {userName}
          </p>
          <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{userEmail}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{userName}</p>
              <p className="text-xs text-slate-500 truncate">{userEmail}</p>
            </div>
            <div className="py-1">
              <a
                href="/settings"
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                Profile & Team
              </a>
              <a
                href="/settings#security"
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                Security & Audit Logs
              </a>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
