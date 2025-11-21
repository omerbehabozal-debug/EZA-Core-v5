/**
 * Regulator Portal Page - Multi-Tenant
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import CaseTable from './components/CaseTable';
import RiskMatrix from './components/RiskMatrix';
import ScreeningPanel from './components/ScreeningPanel';
import { useTenantStore } from '@/lib/tenantStore';
import { fetchRegulatorCases, fetchRegulatorRiskMatrix, fetchRegulatorAuditLogs } from '@/api/regulator';
import { MOCK_REGULATOR_CASES, MOCK_REGULATOR_RISK_MATRIX, MOCK_REGULATOR_AUDIT_LOGS } from '@/mock/regulator';
import type { RegulatorCase, RiskMatrixData, AuditLog } from '@/mock/regulator';
import { cn } from '@/lib/utils';
import { getTenantTabClasses } from '@/lib/tenantColors';

const tabs = [
  { id: 'risk', label: 'Risk Sınıflandırma', module: 'risk_matrix' },
  { id: 'review', label: 'İçerik İnceleme Masası', module: 'case_table' },
  { id: 'reports', label: 'Uygunluk Raporları', module: 'reports' },
  { id: 'audit', label: 'Audit Log', module: 'audit_log' },
];

export default function RegulatorPage() {
  const router = useRouter();
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

  // Get active tab from URL or default to 'risk'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'risk');
  const [selectedCase, setSelectedCase] = useState<RegulatorCase | null>(null);

  // Update activeTab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.find(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // SWR with hybrid mock + live backend
  const { data: cases, error: casesError } = useSWR(
    ['regulator-cases', tenant.id],
    () => fetchRegulatorCases(tenant.id),
    {
      fallbackData: MOCK_REGULATOR_CASES,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const { data: riskMatrix, error: riskError } = useSWR(
    ['regulator-risk-matrix', tenant.id],
    () => fetchRegulatorRiskMatrix(tenant.id),
    {
      fallbackData: MOCK_REGULATOR_RISK_MATRIX,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const { data: auditLogs, error: auditError } = useSWR(
    ['regulator-audit-logs', tenant.id],
    () => fetchRegulatorAuditLogs(tenant.id),
    {
      fallbackData: MOCK_REGULATOR_AUDIT_LOGS,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  // Filter tabs based on enabled modules
  const availableTabs = tabs.filter(tab => tenant.enabledModules.includes(tab.module));

  const handleReview = (caseId: string) => {
    const caseItem = cases?.find(c => c.id === caseId);
    setSelectedCase(caseItem || null);
  };

  const handleClose = () => setSelectedCase(null);


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className={cn('text-3xl font-semibold text-gray-900 mb-2')}>
            {tenant.label}
          </h1>
          <p className="text-gray-600">
            {tenant.description}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Update URL with tab parameter
                  const currentTenant = searchParams.get('tenant') || tenant.id;
                  router.push(`/proxy/regulator?tenant=${currentTenant}&tab=${tab.id}`);
                }}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  getTenantTabClasses(tenant, activeTab === tab.id)
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'risk' && tenant.enabledModules.includes('risk_matrix') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RiskMatrix data={riskMatrix || MOCK_REGULATOR_RISK_MATRIX} tenantId={tenant.id} />
            <Card>
              <CardHeader>
                <CardTitle>Risk İstatistikleri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Toplam İçerik</span>
                    <span className="font-semibold">1,234</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Yüksek Risk</span>
                    <span className="font-semibold text-red-600">45</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Orta Risk</span>
                    <span className="font-semibold text-yellow-600">123</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'review' && tenant.enabledModules.includes('case_table') && (
          <Card>
            <CardHeader>
              <CardTitle>İçerik İnceleme Masası</CardTitle>
            </CardHeader>
            <CardContent>
              {cases && cases.length > 0 ? (
                <CaseTable cases={cases} onReview={handleReview} />
              ) : (
                <p className="text-gray-600 text-center py-8">
                  Henüz veri yok. Önizleme verisi ile çalışan bir demo ortamı gösteriliyor.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'reports' && tenant.enabledModules.includes('reports') && (
          <Card>
            <CardHeader>
              <CardTitle>Uygunluk Raporları</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Raporlar burada görüntülenecek</p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'audit' && tenant.enabledModules.includes('audit_log') && (
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-900">{log.action}</span>
                        <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('tr-TR')}</span>
                      </div>
                      <p className="text-xs text-gray-600">{log.user}</p>
                      <p className="text-sm text-gray-700 mt-1">{log.details}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">
                  Henüz veri yok. Önizleme verisi ile çalışan bir demo ortamı gösteriliyor.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Model Registry (EU AI only) */}
        {tenant.id === 'eu_ai' && tenant.enabledModules.includes('model_registry') && (
          <Card>
            <CardHeader>
              <CardTitle>Model Registry</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">EU AI Act model kayıt sistemi burada görüntülenecek</p>
            </CardContent>
          </Card>
        )}

        {/* Screening Panel */}
        <ScreeningPanel
          caseItem={selectedCase}
          onClose={handleClose}
          onApprove={(id) => {
            console.info('[Mock Mode] Approve case:', id);
            handleClose();
          }}
          onWarning={(id) => {
            console.info('[Mock Mode] Warning case:', id);
            handleClose();
          }}
          onRemove={(id) => {
            console.info('[Mock Mode] Remove case:', id);
            handleClose();
          }}
          onReport={(id) => {
            console.info('[Mock Mode] Generate report for case:', id);
            handleClose();
          }}
        />
      </div>
    </DashboardLayout>
  );
}

