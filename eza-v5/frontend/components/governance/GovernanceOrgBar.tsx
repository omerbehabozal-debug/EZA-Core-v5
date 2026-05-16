'use client';

import { useEffect } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { cn } from '@/lib/utils';

export default function GovernanceOrgBar({ className }: { className?: string }) {
  const {
    organizations,
    currentOrganization,
    setCurrentOrganization,
    loadOrganizations,
    isLoading,
  } = useOrganization();

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <label htmlFor="governance-org-select" className="text-xs font-medium text-eza-text-muted">
        Organizasyon
      </label>
      <select
        id="governance-org-select"
        className="min-w-[12rem] max-w-full rounded-lg border border-eza-border bg-eza-surface px-3 py-1.5 text-sm text-eza-text shadow-eza-sm focus:border-eza-accent focus:outline-none focus:ring-1 focus:ring-eza-accent"
        value={currentOrganization?.id ?? ''}
        onChange={(e) => {
          const org = organizations.find((o) => o.id === e.target.value);
          setCurrentOrganization(org ?? null);
        }}
        disabled={isLoading || organizations.length === 0}
      >
        <option value="">
          {isLoading ? 'Yükleniyor…' : 'Organizasyon seçin'}
        </option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}
