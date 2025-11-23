/**
 * Dashboard Sidebar Component
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Shield, 
  BarChart3,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenantStore } from '@/lib/tenantStore';
import { getTenantColorClasses } from '@/lib/tenantColors';

const menuItems = [
  { href: '/proxy/regulator', label: 'Overview', icon: LayoutDashboard },
  { href: '/proxy/regulator?tab=risk', label: 'Risk Analizi', icon: BarChart3 },
  { href: '/proxy/regulator?tab=review', label: 'İçerik İnceleme', icon: FileText },
  { href: '/proxy/regulator?tab=reports', label: 'Raporlar', icon: FileText },
  { href: '/proxy/regulator?tab=audit', label: 'Audit Log', icon: History },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { getTenant } = useTenantStore();
  const tenant = getTenant();

  // Filter menu items based on enabled modules
  const filteredMenuItems = menuItems.filter(item => {
    // Simple mapping - can be enhanced
    if (item.label === 'Risk Analizi' && !tenant.enabledModules.includes('risk_matrix')) {
      return false;
    }
    if (item.label === 'İçerik İnceleme' && !tenant.enabledModules.includes('case_table')) {
      return false;
    }
    if (item.label === 'Raporlar' && !tenant.enabledModules.includes('reports')) {
      return false;
    }
    if (item.label === 'Audit Log' && !tenant.enabledModules.includes('audit_log')) {
      return false;
    }
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-6">
      <nav className="space-y-2">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href.split('?')[0]);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? getTenantColorClasses(tenant, true)
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

