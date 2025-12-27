/**
 * Systemic Financial Risk Patterns
 * 
 * Detects systemic financial risks, not individual failures.
 */

'use client';

import { useEffect, useState } from 'react';
import { FinanceLayout } from '@/components/FinanceLayout';
import { apiClient, FinanceRiskPatternsResponse } from '@/lib/api-client';
import { useFinanceAuth } from '@/lib/auth-guard';

export default function RiskPatternsPage() {
  const { isAuthorized, loading } = useFinanceAuth();
  const [patterns, setPatterns] = useState<FinanceRiskPatternsResponse | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchPatterns = async () => {
      try {
        setLoadingPatterns(true);
        const response = await apiClient.get<FinanceRiskPatternsResponse>(
          `/api/proxy/finance/risk-patterns?days=${days}`
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
    <FinanceLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900" translate="no">
            Sistematik Finansal Risk Kalıpları
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
            {/* Sector-wide Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Sektör Geneli Trend
              </h2>
              <div className="flex items-center space-x-4">
                <span className={`px-4 py-2 rounded font-semibold ${
                  patterns.sector_wide_trend === 'Increasing' ? 'bg-red-100 text-red-800' :
                  patterns.sector_wide_trend === 'Decreasing' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {patterns.sector_wide_trend === 'Increasing' ? '↑ Artan Risk' :
                   patterns.sector_wide_trend === 'Decreasing' ? '↓ Azalan Risk' :
                   '→ Stabil Risk'}
                </span>
                {patterns.escalating_advisory_risk && (
                  <span className="px-4 py-2 bg-red-100 text-red-800 rounded font-semibold">
                    ⚠ Danışmanlık Riskinde Artış
                  </span>
                )}
                <span className="text-sm text-gray-600">
                  Son {patterns.time_window_days} günlük analiz
                </span>
              </div>
            </div>

            {/* Repeated High-Risk Systems */}
            {patterns.repeated_high_risk_systems.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Tekrarlayan Yüksek Riskli AI Sistemleri
                  </h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Sistem Adı</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Sistem Türü</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Sayısı</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Toplam Olay</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Kurum Sayısı</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.repeated_high_risk_systems.map((system, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{system.system_name}</td>
                        <td className="py-3 px-4 text-gray-700">{system.system_type}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">{system.high_risk_count}</td>
                        <td className="py-3 px-4 text-right text-gray-900">{system.total_events}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{system.institutions_count}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">{system.high_risk_ratio}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Concentration Risks */}
            {patterns.concentration_risks.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Konsantrasyon Riski (Aynı Modelin Yaygın Kullanımı)
                </h2>
                <div className="space-y-3">
                  {patterns.concentration_risks.map((risk, idx) => (
                    <div key={idx} className="border border-orange-200 rounded p-4 bg-orange-50">
                      <h3 className="font-medium text-gray-900 mb-2">{risk.system_name}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Sistem Türü: </span>
                          <span className="font-semibold">{risk.system_type}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Kullanan Kurum Sayısı: </span>
                          <span className="font-semibold text-orange-600">{risk.institutions_using_count}</span>
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
    </FinanceLayout>
  );
}

