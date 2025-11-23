/**
 * Dashboard Navbar Component
 */

'use client';

import Link from 'next/link';
import { Shield, User } from 'lucide-react';
import { useTenantStore } from '@/lib/tenantStore';
import TenantSwitcher from '@/components/TenantSwitcher';

export default function DashboardNavbar() {
  const { getTenant } = useTenantStore();
  const tenant = getTenant();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-semibold text-gray-900">EZA Proxy</span>
          </Link>
          <span className="text-sm text-gray-500">•</span>
          <span className="text-sm font-medium text-gray-700">{tenant.label}</span>
        </div>
        <div className="flex items-center gap-4">
          <TenantSwitcher />
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
        </div>
      </div>
    </nav>
  );
}

