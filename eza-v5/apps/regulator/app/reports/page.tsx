/**
 * Reports Page
 * 
 * Aggregate views of audit data.
 * NO backend endpoint created - uses existing audit/search endpoint.
 */

'use client';

import { useEffect, useState } from 'react';
import { RegulatorLayout } from '@/components/RegulatorLayout';
import { InfoTooltip } from '@/components/InfoTooltip';
import { apiClient, AuditLogEntry } from '@/lib/api-client';
import { useRegulatorAuth } from '@/lib/auth-guard';

export default function ReportsPage() {
  const { isAuthorized, loading } = useRegulatorAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchData = async () => {
      try {
        setLoadingData(true);
        const toDate = new Date().toISOString();
        const fromDate = new Date(
          Date.now() - dateRange * 24 * 60 * 60 * 1000
        ).toISOString();

        const response = await apiClient.get<{
          ok: boolean;
          count: number;
          results: AuditLogEntry[];
        }>(`/api/proxy/audit/search?from_date=${fromDate}&to_date=${toDate}`);

        if (!response.ok) {
          throw new Error('Veri alınamadı');
        }

        setLogs(response.results || []);
      } catch (err) {
        console.error('Error fetching reports data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [isAuthorized, loading, dateRange]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  // Calculate trends client-side
  const riskTrends = logs.reduce(
    (acc, log) => {
      const score = log.risk_scores?.ethical_index || 50;
      if (score < 50) acc.high++;
      else if (score < 80) acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

    const policyDistribution = logs.reduce((acc, log) => {
      const policy = log.sector || 'Belirtilmemiş';
      acc[policy] = (acc[policy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const flagFrequency = logs.reduce((acc, log) => {
    const flags = log.flags
      ? Array.isArray(log.flags)
        ? log.flags
        : log.flags.flags || []
      : [];
    flags.forEach((f: any) => {
      const flagName = f.flag || f.type || 'bilinmiyor';
      acc[flagName] = (acc[flagName] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  return (
    <RegulatorLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center" translate="no">
            Raporlar
            <InfoTooltip text="Bu raporlar sistemin zaman içindeki risk davranışını özetler. Tekil içerik veya aktör detayları sunmaz." />
          </h1>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
          </select>
        </div>

        {loadingData ? (
          <div className="text-center py-12">
            <div className="text-lg">Raporlar yükleniyor...</div>
          </div>
        ) : (
          <>
            {/* Risk Trends */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Zaman İçinde Risk Trendleri
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {riskTrends.high}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Yüksek Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {riskTrends.medium}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Orta Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {riskTrends.low}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Düşük Risk</div>
                </div>
              </div>
            </div>

            {/* Policy Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Politika Bazlı Risk Dağılımı
              </h2>
              <div className="space-y-2">
                {Object.entries(policyDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([policy, count]) => (
                    <div key={policy} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{policy}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Flag Frequency */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Bayrak Sıklığı Desenleri
              </h2>
              <div className="space-y-2">
                {Object.entries(flagFrequency)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([flag, count]) => (
                    <div key={flag} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{flag}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Helper text */}
            <div className="mt-6">
              <p className="text-xs text-gray-400 text-center">
                Bu veriler örneklenmiş denetim kayıtlarından türetilmiştir.
              </p>
            </div>
          </>
        )}
      </div>
    </RegulatorLayout>
  );
}

