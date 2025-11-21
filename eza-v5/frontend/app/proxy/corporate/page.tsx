/**
 * Corporate Portal Page - Multi-Tenant
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import AiAuditList from './components/AiAuditList';
import PolicyConfig from './components/PolicyConfig';
import WorkflowBuilder from './components/WorkflowBuilder';
import { useTenantStore } from '@/lib/tenantStore';
import { fetchCorporateAudits } from '@/api/corporate';
import { MOCK_CORPORATE_AUDITS } from '@/mock/corporate';
import { PolicyConfig as PolicyConfigType, CorporateAudit } from '@/lib/types';

const mockPolicyConfig: PolicyConfigType = {
  high_risk_topics: ['Financial advice', 'Medical diagnosis'],
  illegal_use_cases: ['Discrimination', 'Fraud'],
  custom_rules: [],
};

export default function CorporatePage() {
  const searchParams = useSearchParams();
  const { setTenant, getTenant } = useTenantStore();
  const tenant = getTenant();

  // Initialize tenant from URL
  useEffect(() => {
    const tenantParam = searchParams.get('tenant');
    if (tenantParam && tenantParam !== tenant.id) {
      setTenant(tenantParam);
    }
  }, [searchParams, tenant.id, setTenant]);

  // SWR with hybrid mock + live backend
  const { data: auditItems = MOCK_CORPORATE_AUDITS } = useSWR(
    'corporate-audits',
    fetchCorporateAudits,
    {
      fallbackData: MOCK_CORPORATE_AUDITS,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const [policyConfig, setPolicyConfig] = useState(mockPolicyConfig);

  const handleSavePolicy = (config: PolicyConfigType) => {
    setPolicyConfig(config);
    console.info('[Mock Mode] Policy saved (local state only):', config);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Kurumsal AI Uyum Paneli
          </h1>
          <p className="text-gray-600">
            {tenant.description}
          </p>
        </div>

        <AiAuditList items={auditItems || MOCK_CORPORATE_AUDITS} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PolicyConfig config={policyConfig} onSave={handleSavePolicy} />
          <WorkflowBuilder />
        </div>
      </div>
    </DashboardLayout>
  );
}

