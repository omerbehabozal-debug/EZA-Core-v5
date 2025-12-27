/**
 * Financial Institution Monitor
 * 
 * Firm-level AI governance visibility.
 * Institution names are VISIBLE (not anonymized).
 */

'use client';

import { useEffect, useState } from 'react';
import { FinanceLayout } from '@/components/FinanceLayout';
import { apiClient, FinanceInstitutionsResponse } from '@/lib/api-client';
import { useFinanceAuth } from '@/lib/auth-guard';

export default function InstitutionsPage() {
  const { isAuthorized, loading } = useFinanceAuth();
  const [institutions, setInstitutions] = useState<FinanceInstitutionsResponse | null>(null);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchInstitutions = async () => {
      try {
        setLoadingInstitutions(true);
        const response = await apiClient.get<FinanceInstitutionsResponse>('/api/proxy/finance/institutions');
        
        if (response.ok) {
          setInstitutions(response);
        }
      } catch (err) {
        console.error('Error fetching institutions:', err);
        setError(err instanceof Error ? err.message : 'Kurumlar yüklenirken hata oluştu');
      } finally {
        setLoadingInstitutions(false);
      }
    };

    fetchInstitutions();
  }, [isAuthorized, loading]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (loadingInstitutions) {
    return (
      <FinanceLayout>
        <div className="text-center py-12">
          <div className="text-lg">Kurumlar yükleniyor...</div>
        </div>
      </FinanceLayout>
    );
  }

  if (error) {
    return (
      <FinanceLayout>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">Hata: {error}</p>
        </div>
      </FinanceLayout>
    );
  }

  return (
    <FinanceLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          Finansal Kurumlar İzleme
        </h1>

        {institutions && institutions.institutions.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Kurum Adı</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Kurum Türü</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">AI Sistem Türü</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">AI Kullanım Yoğunluğu</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Ortalama Etik İndeks (30 gün)</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Sıklığı</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Trendi</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Son Aktivite</th>
                </tr>
              </thead>
              <tbody>
                {institutions.institutions.map((institution) => {
                  const trendColor = 
                    institution.risk_trend === 'Deteriorating' ? 'text-red-600' :
                    institution.risk_trend === 'Improving' ? 'text-green-600' :
                    'text-gray-600';
                  
                  return (
                    <tr key={institution.organization_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{institution.institution_name}</td>
                      <td className="py-3 px-4 text-gray-700">{institution.institution_type}</td>
                      <td className="py-3 px-4 text-gray-700">{institution.ai_system_type}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          institution.ai_usage_intensity === 'High' ? 'bg-red-100 text-red-800' :
                          institution.ai_usage_intensity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {institution.ai_usage_intensity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">{institution.average_ethical_index.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold">{institution.high_risk_frequency.toFixed(1)}%</td>
                      <td className={`py-3 px-4 ${trendColor}`}>
                        {institution.risk_trend === 'Deteriorating' ? '↓ Kötüleşen' :
                         institution.risk_trend === 'Improving' ? '↑ İyileşen' :
                         '→ Stabil'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {institution.last_activity ? new Date(institution.last_activity).toLocaleDateString('tr-TR') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Henüz finansal kurum verisi bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </FinanceLayout>
  );
}

