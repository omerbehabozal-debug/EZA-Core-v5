/**
 * Audit Logs Page
 * 
 * Read-only audit log viewer.
 * NEVER displays content, prompts, images, audio, transcripts, or rewritten text.
 */

'use client';

import { useEffect, useState } from 'react';
import { RegulatorLayout } from '@/components/RegulatorLayout';
import { InfoTooltip } from '@/components/InfoTooltip';
import { apiClient, AuditLogEntry, AuditLogSearchParams } from '@/lib/api-client';
import { maskOrganizationId } from '@/lib/organization-mask';
import { useRegulatorAuth } from '@/lib/auth-guard';

export default function AuditLogsPage() {
  const { isAuthorized, loading } = useRegulatorAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogSearchParams>({
    from_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    to_date: new Date().toISOString(),
  });

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchLogs = async () => {
      try {
        setLoadingLogs(true);
        setError(null);

        const params = new URLSearchParams();
        if (filters.from_date) params.append('from_date', filters.from_date);
        if (filters.to_date) params.append('to_date', filters.to_date);
        if (filters.risk_level) params.append('risk_level', filters.risk_level);
        if (filters.flag) params.append('flag', filters.flag);

        const response = await apiClient.get<{
          ok: boolean;
          count: number;
          results: AuditLogEntry[];
        }>(`/api/proxy/audit/search?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Denetim kayıtları alınamadı');
        }

        setLogs(response.results || []);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [isAuthorized, loading, filters]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  const getRiskLevel = (score: number | undefined): string => {
    if (!score) return 'Bilinmiyor';
    if (score < 50) return 'Yüksek';
    if (score < 80) return 'Orta';
    return 'Düşük';
  };

  const getRiskColor = (score: number | undefined): string => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score < 50) return 'bg-red-100 text-red-800';
    if (score < 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <RegulatorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center" translate="no">
          Denetim Kayıtları
          <InfoTooltip text="Bu kayıtlar analiz süreçlerine ait meta verileri gösterir. İçerik, prompt veya çıktı yer almaz." />
        </h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={filters.from_date?.split('T')[0] || ''}
                onChange={(e) =>
                  setFilters({ ...filters, from_date: e.target.value + 'T00:00:00Z' })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={filters.to_date?.split('T')[0] || ''}
                onChange={(e) =>
                  setFilters({ ...filters, to_date: e.target.value + 'T23:59:59Z' })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk Seviyesi
              </label>
              <select
                value={filters.risk_level || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    risk_level: e.target.value as 'low' | 'medium' | 'high' | undefined,
                  })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Tümü</option>
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bayrak Türü
              </label>
              <input
                type="text"
                value={filters.flag || ''}
                onChange={(e) => setFilters({ ...filters, flag: e.target.value })}
                placeholder="Bayrağa göre filtrele"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-800">Hata: {error}</p>
          </div>
        )}

        {/* Loading */}
        {loadingLogs && (
          <div className="text-center py-12">
            <div className="text-lg">Denetim kayıtları yükleniyor...</div>
          </div>
        )}

        {/* Table */}
        {!loadingLogs && !error && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zaman Damgası
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center">
                        Organizasyon
                        <InfoTooltip text="Organizasyon kimlikleri gizlilik amacıyla maskelenmiştir." />
                      </span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İçerik Türü
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Politika Seti
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center">
                        Risk Puanı
                        <InfoTooltip text="Politika setlerine göre hesaplanan etik risk göstergesidir." />
                      </span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bayraklar
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Denetim kaydı bulunamadı
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const ethicalScore = log.risk_scores?.ethical_index || 0;
                      const flags = log.flags
                        ? Array.isArray(log.flags)
                          ? log.flags
                          : log.flags.flags || []
                        : [];

                      return (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {maskOrganizationId(log.organization_id)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.type === 'IntentLog' ? 'Metin' : 'Etki Olayı'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.sector || 'Belirtilmemiş'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(
                                ethicalScore
                              )}`}
                            >
                              {getRiskLevel(ethicalScore)} ({ethicalScore})
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {flags.length > 0
                              ? flags
                                  .slice(0, 3)
                                  .map((f: any) => f.flag || f.type || 'bilinmiyor')
                                  .join(', ')
                              : 'Yok'}
                            {flags.length > 3 && ` (+${flags.length - 3})`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm text-blue-800">
            <strong>Not:</strong> Bu tablo içerik, prompt, görüntü, ses, transkript veya yeniden yazılmış metin göstermez. Yalnızca meta veriler ve risk göstergeleri gösterilir.
          </p>
        </div>
      </div>
    </RegulatorLayout>
  );
}

