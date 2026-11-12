'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSearch,
  UploadCloud,
  CheckSquare,
  ShieldCheck,
  Settings,
  ShieldAlert,
  Building2,
  CreditCard,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  currentOrgName?: string;
  userRole?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Opportunities', href: '/opportunities', icon: BriefcaseIcon },
  { name: 'Upload & Analyze', href: '/upload', icon: UploadCloud },
  { name: 'Requirements & Tasks', href: '/checklist', icon: CheckSquare },
  { name: 'Evidence Library', href: '/evidence', icon: ShieldCheck },
  { name: 'Plans & Pricing', href: '/pricing', icon: CreditCard },
  { name: 'Settings & Usage', href: '/settings', icon: Settings },
  { name: 'Support & FAQ', href: '/support', icon: HelpCircle },
];

function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return <FileSearch {...props} />;
}

export function Sidebar({ currentOrgName = 'Global Defense Corp', userRole = 'owner' }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-900 text-slate-100 flex flex-col min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
            BidReady
          </span>
          <span className="text-[10px] uppercase font-semibold text-blue-400 tracking-wider block -mt-1">
            Tender Intelligence
          </span>
        </div>
      </div>

      {/* Organization Tenant Indicator */}
      <div className="p-4 mx-3 my-3 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{currentOrgName}</p>
            <p className="text-[10px] text-slate-400 capitalize">{userRole} Tenant</p>
          </div>
        </div>
        <Badge variant="success" className="text-[10px] px-1.5 py-0">
          Active
        </Badge>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Tender Workflow
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Compliance / Disclaimer Guard */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
        <p className="leading-tight text-slate-500 font-medium">
          Strict Multi-Tenant Isolation
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          Zero data leakage. Provider-independent extraction with source citation.
        </p>
      </div>
    </aside>
  );
}
