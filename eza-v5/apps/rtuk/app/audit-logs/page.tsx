/**
 * Media Audit Logs - RTÜK-scoped
 * 
 * Event-level inspection only for media-related activity.
 * NO content preview, NO text snippets, NO images, NO audio.
 */

'use client';

import { useEffect, useState } from 'react';
import { RTUKLayout } from '@/components/RTUKLayout';
import { apiClient, RTUKAuditLogsResponse } from '@/lib/api-client';
import { useRTUKAuth } from '@/lib/auth-guard';

export default function AuditLogsPage() {
  const { isAuthorized, loading } = useRTUKAuth();
  const [auditLogs, setAuditLogs] = useState<RTUKAuditLogsResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [riskCategory, setRiskCategory] = useState('');

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchAuditLogs = async () => {
      try {
        setLoadingLogs(true);
        
        const params = new URLSearchParams();
        if (fromDate) params.append('from_date', fromDate);
        if (toDate) params.append('to_date', toDate);
        if (riskLevel) params.append('risk_level', riskLevel);
        if (riskCategory) params.append('risk_category', riskCategory);
        
        const response = await apiClient.get<RTUKAuditLogsResponse>(
          `/api/proxy/rtuk/audit-logs?${params.toString()}`
        );
        
        if (response.ok) {
          setAuditLogs(response);
        }
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setError(err instanceof Error ? err.message : 'Denetim kayıtları yüklenirken hata oluştu');
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchAuditLogs();
  }, [isAuthorized, loading, fromDate, toDate, riskLevel, riskCategory]);

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
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          Medya Denetim Kayıtları
        </h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Risk Seviyesi</label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Tümü</option>
                <option value="high">Yüksek</option>
                <option value="medium">Orta</option>
                <option value="low">Düşük</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Risk Kategorisi</label>
              <select
                value={riskCategory}
                onChange={(e) => setRiskCategory(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Tümü</option>
                <option value="manipulation">Manipülasyon</option>
                <option value="misinformation">Yanlış Bilgi</option>
                <option value="harmful">Zararlı</option>
                <option value="distortion">Çarpıtma</option>
              </select>
            </div>
          </div>
        </div>

        {loadingLogs ? (
          <div className="text-center py-12">
            <div className="text-lg">Denetim kayıtları yükleniyor...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-800">Hata: {error}</p>
          </div>
        ) : auditLogs && auditLogs.results.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                Toplam {auditLogs.count} kayıt bulundu
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Zaman Damgası</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Medya Organizasyonu</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Platform Türü</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Politika Kategorisi</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Seviyesi</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Risk Skoru</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Sistem Bayrakları</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.results.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600 text-xs">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '-'}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{log.media_organization}</td>
                    <td className="py-3 px-4 text-gray-700">{log.platform_type}</td>
                    <td className="py-3 px-4 text-gray-700">{log.policy_category}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.risk_level === 'High' ? 'bg-red-100 text-red-800' :
                        log.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {log.risk_level}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900">{log.risk_score.toFixed(1)}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {log.system_flags.slice(0, 3).map((flag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {flag}
                          </span>
                        ))}
                        {log.system_flags.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                            +{log.system_flags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Henüz denetim kaydı bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </RTUKLayout>
  );
}

