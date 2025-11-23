/**
 * Dashboard Layout Component
 */

import { ReactNode } from 'react';
import Navbar from './DashboardNavbar';
import Sidebar from './DashboardSidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export default function DashboardLayout({ children, showSidebar = true }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        {showSidebar && <Sidebar />}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

