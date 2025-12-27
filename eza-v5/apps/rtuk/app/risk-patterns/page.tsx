/**
 * Systematic Risk Patterns
 * 
 * Detects behavioral escalation, not individual incidents.
 */

'use client';

import { useEffect, useState } from 'react';
import { RTUKLayout } from '@/components/RTUKLayout';
import { RTUKReadingGuide } from '@/components/RTUKReadingGuide';
import { apiClient, RTUKRiskPatternsResponse } from '@/lib/api-client';
import { useRTUKAuth } from '@/lib/auth-guard';

export default function RiskPatternsPage() {
  const { isAuthorized, loading } = useRTUKAuth();
  const [patterns, setPatterns] = useState<RTUKRiskPatternsResponse | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchPatterns = async () => {
      try {
        setLoadingPatterns(true);
        const response = await apiClient.get<RTUKRiskPatternsResponse>(
          `/api/proxy/rtuk/risk-patterns?days=${days}`
        );
        
        if (response.ok) {
          setPatterns(response);
        }
      } catch (err) {
        console.error('Error fetching risk patterns:', err);
        setError(err instanceof Error ? err.message : 'Risk kalıpları yüklenirken hata oluştu');
      } finally {
        setLoadingPatterns(false);
      }
    };

    fetchPatterns();
  }, [isAuthorized, loading, days]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <RTUKLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900" translate="no">
            Sistematik Risk Kalıpları
          </h1>
        </div>

        {/* Reading Guide */}
        <RTUKReadingGuide defaultOpen={false} />

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value={7}>Son 7 gün</option>
            <option value={14}>Son 14 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
          </select>
        </div>

        {loadingPatterns ? (
          <div className="text-center py-12">
            <div className="text-lg">Risk kalıpları yükleniyor...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-800">Hata: {error}</p>
          </div>
        ) : patterns && patterns.organizations.length > 0 ? (
          <>
            {/* Organizations with Risk Patterns */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                  {patterns.organizations.length} organizasyon risk kalıbı tespit edildi
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Organizasyon</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Platform Türü</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Sayısı</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Son {days} Gün</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Trendi</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.organizations.map((org, idx) => {
                    const trendColor = 
                      org.risk_trend === 'Increasing' ? 'text-red-600' :
                      org.risk_trend === 'Decreasing' ? 'text-green-600' :
                      'text-gray-600';
                    
                    return (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{org.organization_name}</td>
                        <td className="py-3 px-4 text-gray-700">{org.platform_type}</td>
                        <td className="py-3 px-4 text-right text-gray-900">{org.high_risk_count}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">{org.recent_high_risk_count}</td>
                        <td className={`py-3 px-4 ${trendColor}`}>
                          {org.risk_trend === 'Increasing' ? '↑ Artan' :
                           org.risk_trend === 'Decreasing' ? '↓ Azalan' :
                           '→ Stabil'}
                        </td>
                        <td className="py-3 px-4">
                          {org.repeated_high_risk ? (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                              Tekrarlayan Yüksek Risk
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Platform-Level Clustering */}
            {patterns.platform_clustering && Object.keys(patterns.platform_clustering).length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Platform Seviyesi Risk Kümelenmesi
                </h2>
                <div className="space-y-3">
                  {Object.entries(patterns.platform_clustering).map(([platform, data]) => (
                    <div key={platform} className="border border-gray-200 rounded p-4">
                      <h3 className="font-medium text-gray-900 mb-2">{platform}</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Toplam Organizasyonlar: </span>
                          <span className="font-semibold">{data.total_orgs}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Yüksek Risk Organizasyonlar: </span>
                          <span className="font-semibold text-red-600">{data.high_risk_orgs}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Yüksek Risk Oranı: </span>
                          <span className="font-semibold">
                            {data.total_orgs > 0 ? ((data.high_risk_orgs / data.total_orgs) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Belirtilen zaman aralığında risk kalıbı tespit edilmedi.</p>
          </div>
        )}
      </div>
    </RTUKLayout>
  );
}

