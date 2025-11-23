/**
 * Tenant Switcher Component
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTenantStore } from '@/lib/tenantStore';
import { TENANTS, REGULATOR_TENANTS, TenantType } from '@/lib/tenant';
import { cn } from '@/lib/utils';

interface TenantSwitcherProps {
  tenantType?: TenantType;
  className?: string;
}

export default function TenantSwitcher({ tenantType, className }: TenantSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenantId, setTenant, getTenant } = useTenantStore();
  const [isOpen, setIsOpen] = useState(false);

  const activeTenant = getTenant();

  // Filter tenants by type if specified
  const availableTenants = tenantType
    ? Object.values(TENANTS).filter(t => t.type === tenantType)
    : tenantType === 'regulator'
      ? REGULATOR_TENANTS.map(id => TENANTS[id])
      : Object.values(TENANTS);

  const handleSelect = (tenantId: string) => {
    setTenant(tenantId);
    setIsOpen(false);
    
    // Update URL with tenant parameter
    const currentPath = window.location.pathname;
    const newUrl = `${currentPath}?tenant=${tenantId}`;
    router.push(newUrl);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">{activeTenant.label}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="py-2">
              {availableTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelect(tenant.id)}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors',
                    currentTenantId === tenant.id && 'bg-blue-50 text-blue-700'
                  )}
                >
                  {tenant.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

