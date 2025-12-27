/**
 * Media Organization Monitor
 * 
 * RTÜK-style monitoring of specific media entities.
 * Organization names are VISIBLE (not anonymized).
 */

'use client';

import { useEffect, useState } from 'react';
import { RTUKLayout } from '@/components/RTUKLayout';
import { apiClient, RTUKOrganizationsResponse } from '@/lib/api-client';
import { useRTUKAuth } from '@/lib/auth-guard';

export default function OrganizationsPage() {
  const { isAuthorized, loading } = useRTUKAuth();
  const [organizations, setOrganizations] = useState<RTUKOrganizationsResponse | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        {organizations && organizations.organizations.length > 0 ? (
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
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Henüz medya organizasyonu verisi bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </RTUKLayout>
  );
}

