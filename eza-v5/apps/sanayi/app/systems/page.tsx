/**
 * AI System Detail View - Non-content
 * 
 * System-level risk & maturity inspection.
 * NO content, NO outputs, NO user data.
 */

'use client';

import { useEffect, useState } from 'react';
import { SanayiLayout } from '@/components/SanayiLayout';
import { apiClient, SanayiSystemsResponse } from '@/lib/api-client';
import { useSanayiAuth } from '@/lib/auth-guard';

export default function SystemsPage() {
  const { isAuthorized, loading } = useSanayiAuth();
  const [systems, setSystems] = useState<SanayiSystemsResponse | null>(null);
  const [loadingSystems, setLoadingSystems] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemTypeFilter, setSystemTypeFilter] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchSystems = async () => {
      try {
        setLoadingSystems(true);
        
        const params = new URLSearchParams();
        if (systemTypeFilter) params.append('system_type', systemTypeFilter);
        params.append('days', days.toString());
        
        const response = await apiClient.get<SanayiSystemsResponse>(
          `/api/proxy/sanayi/systems?${params.toString()}`
        );
        
        if (response.ok) {
          setSystems(response);
        }
      } catch (err) {
        console.error('Error fetching systems:', err);
        setError(err instanceof Error ? err.message : 'Sistemler yüklenirken hata oluştu');
      } finally {
        setLoadingSystems(false);
      }
    };

    fetchSystems();
  }, [isAuthorized, loading, systemTypeFilter, days]);

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
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          AI Sistem Detayları
        </h1>

        {/* Notice */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <p className="text-sm text-blue-900">
            <strong>Bilgilendirme:</strong> Bu ekranda içerik veya çıktı gösterilmez.
            İnceleme yalnızca sistem davranışına yöneliktir.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">AI Sistem Türü</label>
              <select
                value={systemTypeFilter}
                onChange={(e) => setSystemTypeFilter(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Tümü</option>
                <option value="Text Generation">Metin Üretimi</option>
                <option value="Multimodal">Çok Modlu</option>
                <option value="Decision Support">Karar Desteği</option>
                <option value="Recommendation">Öneri</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Zaman Penceresi</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={7}>Son 7 gün</option>
                <option value={30}>Son 30 gün</option>
                <option value={90}>Son 90 gün</option>
              </select>
            </div>
          </div>
        </div>

        {loadingSystems ? (
          <div className="text-center py-12">
            <div className="text-lg">Sistemler yükleniyor...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-800">Hata: {error}</p>
          </div>
        ) : systems && systems.systems.length > 0 ? (
          <div className="space-y-6">
            {systems.systems.map((system) => (
              <div key={system.system_name} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{system.system_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Sistem Türü: {system.system_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Ortalama Etik İndeks</p>
                    <p className="text-2xl font-bold text-gray-900">{system.average_ethical_index.toFixed(1)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Kullanılan Modeller / API'ler</h4>
                    <div className="flex flex-wrap gap-2">
                      {system.models_used.map((model, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Dağılımı</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-red-600">{system.risk_distribution.high}</div>
                        <div className="text-gray-600">Yüksek</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-yellow-600">{system.risk_distribution.medium}</div>
                        <div className="text-gray-600">Orta</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{system.risk_distribution.low}</div>
                        <div className="text-gray-600">Düşük</div>
                      </div>
                    </div>
                  </div>
                </div>

                {Object.keys(system.risk_categories).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Kategorileri</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(system.risk_categories)
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, count]) => (
                          <span key={category} className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                            {category}: {count}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Toplam Olay: </span>
                    <span className="font-semibold">{system.total_events}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fail-Safe Tetiklenme: </span>
                    <span className="font-semibold text-red-600">{system.fail_safe_trigger_count}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Zaman Penceresi: </span>
                    <span className="font-semibold">{systems.time_window_days} gün</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Belirtilen kriterlere uygun sistem bulunamadı.</p>
          </div>
        )}
      </div>
    </SanayiLayout>
  );
}

