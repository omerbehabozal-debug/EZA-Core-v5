/**
 * Media Organization Monitor
 * 
 * RTÜK-style monitoring of specific media entities.
 * Organization names are VISIBLE (not anonymized).
 */

'use client';

import { useEffect, useState } from 'react';
import { RTUKLayout } from '@/components/RTUKLayout';
import { RTUKReadingGuide } from '@/components/RTUKReadingGuide';
import { apiClient, RTUKOrganizationsResponse, RTUKAuditLogsResponse } from '@/lib/api-client';
import { useRTUKAuth } from '@/lib/auth-guard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Area } from 'recharts';

export default function OrganizationsPage() {
  const { isAuthorized, loading } = useRTUKAuth();
  const [organizations, setOrganizations] = useState<RTUKOrganizationsResponse | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [behaviorTrends, setBehaviorTrends] = useState<Record<string, any[]>>({});
  const [selectedDays, setSelectedDays] = useState(30);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchOrganizations = async () => {
      try {
        setLoadingOrgs(true);
        const response = await apiClient.get<RTUKOrganizationsResponse>('/api/proxy/rtuk/organizations');
        
        if (response.ok) {
          setOrganizations(response);
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
        setError(err instanceof Error ? err.message : 'Organizasyonlar yüklenirken hata oluştu');
      } finally {
        setLoadingOrgs(false);
      }
    };

    fetchOrganizations();
  }, [isAuthorized, loading]);

  // Fetch behavior trends for organizations
  useEffect(() => {
    if (!isAuthorized || loading || !organizations) return;

    const fetchBehaviorTrends = async () => {
      try {
        // Get audit logs for last 30 days
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - selectedDays);
        const toDate = new Date();

        const response = await apiClient.get<RTUKAuditLogsResponse>(
          `/api/proxy/rtuk/audit-logs?from_date=${fromDate.toISOString()}&to_date=${toDate.toISOString()}`
        );

        if (response.ok && response.results) {
          // Aggregate by organization and date
          const trends: Record<string, Record<string, { count: number; high: number; medium: number; low: number; ethicalScores: number[] }>> = {};

          response.results.forEach((log) => {
            const orgName = log.media_organization;
            if (!trends[orgName]) {
              trends[orgName] = {};
            }

            const dateKey = log.timestamp ? new Date(log.timestamp).toISOString().split('T')[0] : '';
            if (!dateKey) return;

            if (!trends[orgName][dateKey]) {
              trends[orgName][dateKey] = {
                count: 0,
                high: 0,
                medium: 0,
                low: 0,
                ethicalScores: []
              };
            }

            trends[orgName][dateKey].count++;
            if (log.risk_level === 'High') trends[orgName][dateKey].high++;
            else if (log.risk_level === 'Medium') trends[orgName][dateKey].medium++;
            else trends[orgName][dateKey].low++;
            
            trends[orgName][dateKey].ethicalScores.push(log.risk_score);
          });

          // Convert to chart data format
          const chartData: Record<string, any[]> = {};
          Object.keys(trends).forEach((orgName) => {
            const dailyData = Object.entries(trends[orgName])
              .map(([date, data]) => ({
                date,
                count: data.count,
                high: data.high,
                medium: data.medium,
                low: data.low,
                avgEthical: data.ethicalScores.length > 0 
                  ? data.ethicalScores.reduce((a, b) => a + b, 0) / data.ethicalScores.length 
                  : 0
              }))
              .sort((a, b) => a.date.localeCompare(b.date));
            
            chartData[orgName] = dailyData;
          });

          setBehaviorTrends(chartData);
        }
      } catch (err) {
        console.error('Error fetching behavior trends:', err);
        // Don't set error - trends are optional
      }
    };

    fetchBehaviorTrends();
  }, [isAuthorized, loading, organizations, selectedDays]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (loadingOrgs) {
    return (
      <RTUKLayout>
        <div className="text-center py-12">
          <div className="text-lg">Organizasyonlar yükleniyor...</div>
        </div>
      </RTUKLayout>
    );
  }

  if (error) {
    return (
      <RTUKLayout>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">Hata: {error}</p>
        </div>
      </RTUKLayout>
    );
  }

  return (
    <RTUKLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          Medya Organizasyonları İzleme
        </h1>

        {/* Reading Guide */}
        <RTUKReadingGuide defaultOpen={false} />

        {organizations && organizations.organizations.length > 0 ? (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Medya Organizasyonu</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Platform Türü</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">AI Kullanım Yoğunluğu</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Ortalama Etik İndeks (30 gün)</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Olay Sayısı</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Trendi</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Son Aktivite</th>
                </tr>
              </thead>
              <tbody>
                {organizations.organizations.map((org) => {
                  const trendColor = 
                    org.risk_trend === 'Increasing' ? 'text-red-600' :
                    org.risk_trend === 'Decreasing' ? 'text-green-600' :
                    'text-gray-600';
                  
                  return (
                    <tr key={org.organization_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{org.organization_name}</td>
                      <td className="py-3 px-4 text-gray-700">{org.platform_type}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          org.ai_usage_intensity === 'High' ? 'bg-red-100 text-red-800' :
                          org.ai_usage_intensity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {org.ai_usage_intensity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">{org.average_ethical_index.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold">{org.high_risk_event_count}</td>
                      <td className={`py-3 px-4 ${trendColor}`}>
                        {org.risk_trend === 'Increasing' ? '↑ Artan' :
                         org.risk_trend === 'Decreasing' ? '↓ Azalan' :
                         '→ Stabil'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {org.last_activity ? new Date(org.last_activity).toLocaleDateString('tr-TR') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Behavior Trend Timelines */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Davranış Eğilimi (Zaman Bazlı)
              </h2>
              <select
                value={selectedDays}
                onChange={(e) => setSelectedDays(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value={7}>Son 7 gün</option>
                <option value={30}>Son 30 gün</option>
              </select>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Bu grafik, ilgili medya kuruluşunun yapay zekâ kullanımındaki
              etik risk dağılımının zamana yayılan genel davranışını gösterir.
              Tekil analizler değil, tekrar eden desenler esas alınır.
            </p>

            {organizations.organizations.map((org) => {
              const trendData = behaviorTrends[org.organization_name] || [];
              
              if (trendData.length === 0) return null;

              return (
                <div key={org.organization_id} className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{org.organization_name}</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="avgEthical"
                        fill="#3b82f6"
                        fillOpacity={0.2}
                        stroke="#3b82f6"
                        name="Ortalama Etik İndeks"
                      />
                      <Bar yAxisId="right" dataKey="count" fill="#94a3b8" name="Günlük Analiz Sayısı" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="font-semibold text-red-600">{trendData.reduce((sum, d) => sum + d.high, 0)}</span>
                      <span className="ml-1">Yüksek Risk</span>
                    </div>
                    <div>
                      <span className="font-semibold text-yellow-600">{trendData.reduce((sum, d) => sum + d.medium, 0)}</span>
                      <span className="ml-1">Orta Risk</span>
                    </div>
                    <div>
                      <span className="font-semibold text-green-600">{trendData.reduce((sum, d) => sum + d.low, 0)}</span>
                      <span className="ml-1">Düşük Risk</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">{trendData.reduce((sum, d) => sum + d.count, 0)}</span>
                      <span className="ml-1">Toplam Analiz</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Henüz medya organizasyonu verisi bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </RTUKLayout>
  );
}

