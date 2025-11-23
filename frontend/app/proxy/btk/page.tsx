/**
 * BTK Portal Page
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import StatusBadge, { StatusType } from '@/components/StatusBadge';
import { useTenantStore } from '@/lib/tenantStore';
import { fetchTrafficRisk, fetchBTKAuditLog } from '@/api/btk';
import { MOCK_TRAFFIC_RISK, MOCK_BTK_AUDIT_LOG } from '@/mock/btk';
import type { TrafficRiskResponse, BTKAuditLogResponse } from '@/mock/btk';
import { cn } from '@/lib/utils';

function getStatusType(isLoading: boolean, error: any, data: any, fallback: any): StatusType {
  if (isLoading) return 'loading';
  if (error || !data || data === fallback) return 'preview';
  return 'live';
}

export default function BTKPage() {
  const searchParams = useSearchParams();
  const { setTenant, getTenant } = useTenantStore();
  const tenant = getTenant();
  
  useEffect(() => {
    const tenantParam = searchParams.get('tenant');
    if (tenantParam && tenantParam !== tenant.id) {
      setTenant(tenantParam);
    }
  }, [searchParams, tenant.id, setTenant]);

  const [trafficText, setTrafficText] = useState('');
  const [lastRiskResult, setLastRiskResult] = useState<TrafficRiskResponse | null>(null);

  const { data: auditLogs, error: auditError, isLoading: auditLoading } = useSWR(
    ['btk-audit-log', tenant.id],
    () => fetchBTKAuditLog(),
    {
      fallbackData: MOCK_BTK_AUDIT_LOG,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for audit log');
      },
    }
  );

  const auditStatus = getStatusType(auditLoading, auditError, auditLogs, MOCK_BTK_AUDIT_LOG);

  const handleEvaluateTraffic = async () => {
    if (!trafficText.trim()) return;
    try {
      const result = await fetchTrafficRisk(trafficText);
      setLastRiskResult(result);
    } catch (error) {
      console.info('[Preview Mode] Traffic risk evaluation failed, using mock');
      setLastRiskResult(MOCK_TRAFFIC_RISK);
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
          <StatusBadge status={auditStatus} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Trafik Risk Değerlendirmesi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <textarea
                  value={trafficText}
                  onChange={(e) => setTrafficText(e.target.value)}
                  placeholder="Trafik açıklaması veya içeriği girin..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                  rows={5}
                />
                <button
                  onClick={handleEvaluateTraffic}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Değerlendir
                </button>
                {lastRiskResult && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Risk Skoru</span>
                      <span className={cn(
                        'px-2 py-1 rounded text-sm font-medium',
                        lastRiskResult.risk_score >= 0.7 ? 'bg-red-100 text-red-800' :
                        lastRiskResult.risk_score >= 0.4 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      )}>
                        {(lastRiskResult.risk_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Kategori: <span className="font-medium">{lastRiskResult.traffic_category}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Seviye: <span className="font-medium">{lastRiskResult.risk_level}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Audit Log</CardTitle>
                <StatusBadge status={auditStatus} />
              </div>
            </CardHeader>
            <CardContent>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-900">{log.endpoint}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{log.method}</p>
                      {log.meta && (
                        <p className="text-sm text-gray-700 mt-1">
                          {JSON.stringify(log.meta)}
                        </p>
                      )}
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
        </div>
      </div>
    </DashboardLayout>
  );
}

