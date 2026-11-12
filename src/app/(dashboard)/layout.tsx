import React from 'react';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Header } from '@/components/app-shell/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Fixed Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar currentOrgName="Global Defense Corp" userRole="owner" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
