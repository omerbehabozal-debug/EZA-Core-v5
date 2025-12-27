/**
 * Clinical Audit Logs - Health regulator view
 * 
 * Event-level inspection only for health-related activity.
 * NO medical content, NO diagnoses, NO treatment recommendations.
 */

'use client';

import { useEffect, useState } from 'react';
import { HealthLayout } from '@/components/HealthLayout';
import { apiClient, HealthAuditLogsResponse } from '@/lib/api-client';
import { useHealthAuth } from '@/lib/auth-guard';

export default function AuditLogsPage() {
  const { isAuthorized, loading } = useHealthAuth();
  const [auditLogs, setAuditLogs] = useState<HealthAuditLogsResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [riskCategory, setRiskCategory] = useState('');
  const [riskLevel, setRiskLevel] = useState('');

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchAuditLogs = async () => {
      try {
        setLoadingLogs(true);
        
        const params = new URLSearchParams();
        if (fromDate) params.append('from_date', fromDate);
        if (toDate) params.append('to_date', toDate);
        if (institutionId) params.append('institution_id', institutionId);
        if (riskCategory) params.append('risk_category', riskCategory);
        if (riskLevel) params.append('risk_level', riskLevel);
        
        const response = await apiClient.get<HealthAuditLogsResponse>(
          `/api/proxy/health/audit-logs?${params.toString()}`
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
  }, [isAuthorized, loading, fromDate, toDate, institutionId, riskCategory, riskLevel]);

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
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          Klinik Denetim Kayıtları
        </h1>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Kurum</label>
              <input
                type="text"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                placeholder="Kurum ID"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Risk Kategorisi</label>
              <select
                value={riskCategory}
                onChange={(e) => setRiskCategory(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Tümü</option>
                <option value="PATIENT_SAFETY">Hasta Güvenliği</option>
                <option value="MISGUIDANCE">Yanlış Yönlendirme</option>
              </select>
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
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Kurum</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">AI Sistem Türü</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Kategorisi</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Seviyesi</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Risk Skoru</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Fail-Safe Tetiklendi</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.results.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600 text-xs">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '-'}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{log.institution}</td>
                    <td className="py-3 px-4 text-gray-700">{log.ai_system_type}</td>
                    <td className="py-3 px-4 text-gray-700">{log.risk_category}</td>
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
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.fail_safe_triggered === 'Yes' ? 'bg-red-100 text-red-800 font-semibold' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {log.fail_safe_triggered}
                      </span>
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
    </HealthLayout>
  );
}

