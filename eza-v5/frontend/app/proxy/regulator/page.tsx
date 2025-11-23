/**
 * Regulator Portal Page - Multi-Tenant
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import CaseTable from './components/CaseTable';
import RiskMatrix from './components/RiskMatrix';
import ScreeningPanel from './components/ScreeningPanel';
import StatusBadge, { StatusType } from '@/components/StatusBadge';
import { useTenantStore } from '@/lib/tenantStore';
import { fetchRegulatorCases, fetchRegulatorRiskMatrix, fetchRegulatorReports } from '@/api/regulator';
import { MOCK_REGULATOR_CASES, MOCK_REGULATOR_RISK_MATRIX, MOCK_REGULATOR_REPORTS } from '@/mock/regulator';
import type { RegulatorCase, RiskMatrixResponse, ReportResponse } from '@/mock/regulator';
import { cn } from '@/lib/utils';
import { getTenantTabClasses } from '@/lib/tenantColors';
import { uploadMultimodalFile, MultimodalAnalysisResult } from '@/api/multimodal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const tabs = [
  { id: 'risk', label: 'Risk Sınıflandırma', module: 'risk_matrix' },
  { id: 'review', label: 'İçerik İnceleme Masası', module: 'case_table' },
  { id: 'reports', label: 'Uygunluk Raporları', module: 'reports' },
];

function getStatusType(isLoading: boolean, error: any, data: any, fallback: any): StatusType {
  if (isLoading) return 'loading';
  if (error || !data || data === fallback) return 'preview';
  return 'live';
}

function RegulatorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTenant, getTenant } = useTenantStore();
  const tenant = getTenant();
  
  useEffect(() => {
    if (!searchParams) return;
    const tenantParam = searchParams.get('tenant');
    if (tenantParam && tenantParam !== tenant.id) {
      setTenant(tenantParam);
    }
  }, [searchParams, tenant.id, setTenant]);

  const tabParam = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'risk');
  const [selectedCase, setSelectedCase] = useState<RegulatorCase | null>(null);
  
  // Multimodal state
  const [videoResult, setVideoResult] = useState<MultimodalAnalysisResult | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchParams) return;
    const tab = searchParams.get('tab');
    if (tab && tabs.find(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data: cases, error: casesError, isLoading: casesLoading } = useSWR(
    ['regulator-cases', tenant.id],
    () => fetchRegulatorCases(),
    {
      fallbackData: MOCK_REGULATOR_CASES,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for cases');
      },
    }
  );

  const { data: riskMatrix, error: riskError, isLoading: riskLoading } = useSWR(
    ['regulator-risk-matrix', tenant.id],
    () => fetchRegulatorRiskMatrix(),
    {
      fallbackData: MOCK_REGULATOR_RISK_MATRIX,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for risk matrix');
      },
    }
  );

  const { data: reports, error: reportsError, isLoading: reportsLoading } = useSWR(
    ['regulator-reports', tenant.id],
    () => fetchRegulatorReports(),
    {
      fallbackData: MOCK_REGULATOR_REPORTS,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for reports');
      },
    }
  );

  const casesStatus = getStatusType(casesLoading, casesError, cases, MOCK_REGULATOR_CASES);
  const riskStatus = getStatusType(riskLoading, riskError, riskMatrix, MOCK_REGULATOR_RISK_MATRIX);
  const reportsStatus = getStatusType(reportsLoading, reportsError, reports, MOCK_REGULATOR_REPORTS);

  const availableTabs = tabs.filter(tab => tenant.enabledModules.includes(tab.module));

  const handleReview = (caseId: string) => {
    const caseItem = cases?.find(c => c.id === caseId);
    setSelectedCase(caseItem || null);
  };

  const handleClose = () => setSelectedCase(null);

  const handleVideoUpload = async (file: File | null) => {
    if (!file) return;
    setVideoError(null);
    setVideoLoading(true);
    try {
      const result = await uploadMultimodalFile('video', file);
      setVideoResult(result);
    } catch (e: any) {
      setVideoError(e?.message || 'Video analysis failed');
      if (e?.message?.includes('503') || e?.message?.includes('disabled')) {
        setVideoError('Multimodal analysis is currently disabled in this environment.');
      }
    } finally {
      setVideoLoading(false);
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      case 'critical': return 'danger';
      default: return 'default';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className={cn('text-3xl font-semibold text-gray-900 mb-2')}>
              {tenant.label}
            </h1>
            <p className="text-gray-600">
              {tenant.description}
            </p>
          </div>
          <StatusBadge status={casesStatus} />
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  const currentTenant = searchParams?.get('tenant') || tenant.id;
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

        {activeTab === 'risk' && tenant.enabledModules.includes('risk_matrix') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RiskMatrix 
              data={riskMatrix || MOCK_REGULATOR_RISK_MATRIX} 
              tenantId={tenant.id} 
            />
            <Card>
              <CardHeader>
                <CardTitle>Risk İstatistikleri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Toplam İçerik</span>
                    <span className="font-semibold">{riskMatrix?.total_cases || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Yüksek Risk</span>
                    <span className="font-semibold text-red-600">
                      {riskMatrix?.summary.high_high || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Orta Risk</span>
                    <span className="font-semibold text-yellow-600">
                      {(riskMatrix?.summary.medium_medium || 0) + (riskMatrix?.summary.medium_high || 0)}
                    </span>
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Uygunluk Raporları</CardTitle>
                  <StatusBadge status={reportsStatus} />
                </div>
              </CardHeader>
              <CardContent>
                {reports ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Özet</h3>
                      <p className="text-gray-600">{reports.content.summary}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Öneriler</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        {reports.content.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">İstatistikler</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-2xl font-bold text-red-600">
                            {reports.metadata.statistics.high_risk_count}
                          </div>
                          <div className="text-sm text-gray-600">Yüksek Risk</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-600">
                            {reports.metadata.statistics.medium_risk_count}
                          </div>
                          <div className="text-sm text-gray-600">Orta Risk</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {reports.metadata.statistics.low_risk_count}
                          </div>
                          <div className="text-sm text-gray-600">Düşük Risk</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">
                    Rapor yükleniyor...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Multimodal Video Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Multimodal / Video Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                    disabled={videoLoading}
                  />
                  <Button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/*';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) handleVideoUpload(file);
                      };
                      input.click();
                    }}
                    disabled={videoLoading}
                    className="w-full"
                  >
                    {videoLoading ? 'Analyzing...' : 'Analyze Video (Multimodal)'}
                  </Button>
                </div>

                {videoError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{videoError}</p>
                  </div>
                )}

                {videoResult && (
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">Global Risk:</span>
                      <Badge variant={getRiskBadgeVariant(videoResult.global_risk_level)}>
                        {videoResult.global_risk_level.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">Overall Score:</span>
                      <span className="text-lg font-semibold">
                        {videoResult.eza_multimodal_score.overall_score.toFixed(1)}
                      </span>
                    </div>
                    {videoResult.recommended_actions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Top 3 Recommended Actions:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                          {videoResult.recommended_actions.slice(0, 3).map((action, idx) => (
                            <li key={idx}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <ScreeningPanel
          caseItem={selectedCase}
          onClose={handleClose}
          onApprove={(id) => {
            console.info('[Preview Mode] Approve case:', id);
            handleClose();
          }}
          onWarning={(id) => {
            console.info('[Preview Mode] Warning case:', id);
            handleClose();
          }}
          onRemove={(id) => {
            console.info('[Preview Mode] Remove case:', id);
            handleClose();
          }}
          onReport={(id) => {
            console.info('[Preview Mode] Generate report for case:', id);
            handleClose();
          }}
        />
      </div>
    </DashboardLayout>
  );
}

export default function RegulatorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegulatorPageContent />
    </Suspense>
  );
}
