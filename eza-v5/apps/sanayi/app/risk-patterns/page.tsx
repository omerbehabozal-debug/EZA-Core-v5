/**
 * Ecosystem Risk Patterns
 * 
 * Detects systemic AI risks, not individual failures.
 */

'use client';

import { useEffect, useState } from 'react';
import { SanayiLayout } from '@/components/SanayiLayout';
import { apiClient, SanayiRiskPatternsResponse } from '@/lib/api-client';
import { useSanayiAuth } from '@/lib/auth-guard';

export default function RiskPatternsPage() {
  const { isAuthorized, loading } = useSanayiAuth();
  const [patterns, setPatterns] = useState<SanayiRiskPatternsResponse | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchPatterns = async () => {
      try {
        setLoadingPatterns(true);
        const response = await apiClient.get<SanayiRiskPatternsResponse>(
          `/api/proxy/sanayi/risk-patterns?days=${days}`
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
    <SanayiLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900" translate="no">
            Ekosistem Risk Kalıpları
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
            {/* Ecosystem Risk Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Ekosistem Risk Trendi
              </h2>
              <div className="flex items-center space-x-4">
                <span className={`px-4 py-2 rounded font-semibold ${
                  patterns.ecosystem_risk_trend === 'Increasing' ? 'bg-red-100 text-red-800' :
                  patterns.ecosystem_risk_trend === 'Decreasing' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {patterns.ecosystem_risk_trend === 'Increasing' ? '↑ Artan Risk' :
                   patterns.ecosystem_risk_trend === 'Decreasing' ? '↓ Azalan Risk' :
                   '→ Stabil Risk'}
                </span>
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
                    Tekrarlayan Yüksek Riskli Sistemler
                  </h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Sistem Adı</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Sistem Türü</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Model Sağlayıcı</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Sayısı</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Toplam Olay</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.repeated_high_risk_systems.map((system, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{system.system_name}</td>
                        <td className="py-3 px-4 text-gray-700">{system.system_type}</td>
                        <td className="py-3 px-4 text-gray-700">{system.model_provider}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">{system.high_risk_count}</td>
                        <td className="py-3 px-4 text-right text-gray-900">{system.total_events}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-semibold">{system.high_risk_ratio}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Model Clustering */}
            {patterns.model_clustering && Object.keys(patterns.model_clustering).length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Model Türüne Göre Risk Kümelenmesi
                </h2>
                <div className="space-y-3">
                  {Object.entries(patterns.model_clustering).map(([provider, data]) => (
                    <div key={provider} className="border border-gray-200 rounded p-4">
                      <h3 className="font-medium text-gray-900 mb-2">{provider}</h3>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Toplam Sistemler: </span>
                          <span className="font-semibold">{data.total_systems}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Yüksek Risk Sistemler: </span>
                          <span className="font-semibold text-red-600">{data.high_risk_systems}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Toplam Olaylar: </span>
                          <span className="font-semibold">{data.total_events}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Yüksek Risk Olaylar: </span>
                          <span className="font-semibold text-red-600">{data.high_risk_events}</span>
                        </div>
                      </div>
                      {data.total_systems > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Yüksek risk oranı: {((data.high_risk_systems / data.total_systems) * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Type Clustering */}
            {patterns.system_type_clustering && Object.keys(patterns.system_type_clustering).length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Sistem Türüne Göre Risk Kümelenmesi
                </h2>
                <div className="space-y-3">
                  {Object.entries(patterns.system_type_clustering).map(([sysType, data]) => (
                    <div key={sysType} className="border border-gray-200 rounded p-4">
                      <h3 className="font-medium text-gray-900 mb-2">{sysType}</h3>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Toplam Sistemler: </span>
                          <span className="font-semibold">{data.total_systems}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Yüksek Risk Sistemler: </span>
                          <span className="font-semibold text-red-600">{data.high_risk_systems}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Toplam Olaylar: </span>
                          <span className="font-semibold">{data.total_events}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Yüksek Risk Olaylar: </span>
                          <span className="font-semibold text-red-600">{data.high_risk_events}</span>
                        </div>
                      </div>
                      {data.total_systems > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Yüksek risk oranı: {((data.high_risk_systems / data.total_systems) * 100).toFixed(1)}%
                        </p>
                      )}
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
    </SanayiLayout>
  );
}

