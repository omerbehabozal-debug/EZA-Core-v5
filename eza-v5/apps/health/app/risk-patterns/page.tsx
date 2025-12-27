/**
 * Clinical Risk Patterns
 * 
 * Detects systemic clinical risks, not individual failures.
 */

'use client';

import { useEffect, useState } from 'react';
import { HealthLayout } from '@/components/HealthLayout';
import { apiClient, HealthRiskPatternsResponse } from '@/lib/api-client';
import { useHealthAuth } from '@/lib/auth-guard';

export default function RiskPatternsPage() {
  const { isAuthorized, loading } = useHealthAuth();
  const [patterns, setPatterns] = useState<HealthRiskPatternsResponse | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchPatterns = async () => {
      try {
        setLoadingPatterns(true);
        const response = await apiClient.get<HealthRiskPatternsResponse>(
          `/api/proxy/health/risk-patterns?days=${days}`
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
    <HealthLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900" translate="no">
            Klinik Risk Kalıpları
          </h1>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value={7}>Son 7 gün</option>
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
        ) : patterns ? (
          <>
            {/* Repeated Unsafe Guidance */}
            {patterns.repeated_unsafe_guidance.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Tekrarlayan Güvensiz Yönlendirme
                  </h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Sistem Adı</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Sistem Türü</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Güvensiz Yönlendirme Sayısı</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Toplam Olay</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Güvensiz Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.repeated_unsafe_guidance.map((system, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{system.system_name}</td>
                        <td className="py-3 px-4 text-gray-700">{system.system_type}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">{system.unsafe_guidance_count}</td>
                        <td className="py-3 px-4 text-right text-gray-900">{system.total_events}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">{system.unsafe_ratio}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Fail-Safe Delays */}
            {patterns.fail_safe_delays.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Fail-Safe Aktivasyonunda Gecikme
                </h2>
                <div className="space-y-3">
                  {patterns.fail_safe_delays.map((delay, idx) => (
                    <div key={idx} className="border border-red-200 rounded p-4 bg-red-50">
                      <h3 className="font-medium text-gray-900 mb-2">{delay.organization_name}</h3>
                      <p className="text-sm text-gray-600">
                        Gecikme sayısı: <span className="font-semibold text-red-600">{delay.delay_count}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rising Risk Institutions */}
            {patterns.rising_risk_institutions.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Artan Risk Kurumları
                </h2>
                <div className="space-y-3">
                  {patterns.rising_risk_institutions.map((institution, idx) => (
                    <div key={idx} className="border border-orange-200 rounded p-4 bg-orange-50">
                      <h3 className="font-medium text-gray-900 mb-2">{institution.organization_name}</h3>
                      <p className="text-sm text-gray-600">
                        Yüksek risk olay sayısı: <span className="font-semibold text-orange-600">{institution.high_risk_event_count}</span>
                      </p>
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
    </HealthLayout>
  );
}

