/**
 * AI Company Monitor
 * 
 * Firm-level AI governance visibility.
 * Company names are VISIBLE (not anonymized).
 */

'use client';

import { useEffect, useState } from 'react';
import { SanayiLayout } from '@/components/SanayiLayout';
import { apiClient, SanayiCompaniesResponse } from '@/lib/api-client';
import { useSanayiAuth } from '@/lib/auth-guard';

export default function CompaniesPage() {
  const { isAuthorized, loading } = useSanayiAuth();
  const [companies, setCompanies] = useState<SanayiCompaniesResponse | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const response = await apiClient.get<SanayiCompaniesResponse>('/api/proxy/sanayi/companies');
        
        if (response.ok) {
          setCompanies(response);
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
        setError(err instanceof Error ? err.message : 'Şirketler yüklenirken hata oluştu');
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, [isAuthorized, loading]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (loadingCompanies) {
    return (
      <SanayiLayout>
        <div className="text-center py-12">
          <div className="text-lg">Şirketler yükleniyor...</div>
        </div>
      </SanayiLayout>
    );
  }

  if (error) {
    return (
      <SanayiLayout>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">Hata: {error}</p>
        </div>
      </SanayiLayout>
    );
  }

  return (
    <SanayiLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          AI Şirketleri İzleme
        </h1>

        {companies && companies.companies.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">AI Şirketi</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Birincil AI Sistem Türü</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Kullanılan AI Modelleri</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Günlük / Aylık AI Trafiği</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Ortalama Etik İndeks (30 gün)</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk Olay Oranı</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Trendi</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Son Gözlemlenen Aktivite</th>
                </tr>
              </thead>
              <tbody>
                {companies.companies.map((company) => {
                  const trendColor = 
                    company.risk_trend === 'Deteriorating' ? 'text-red-600' :
                    company.risk_trend === 'Improving' ? 'text-green-600' :
                    'text-gray-600';
                  
                  return (
                    <tr key={company.organization_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{company.organization_name}</td>
                      <td className="py-3 px-4 text-gray-700">{company.primary_ai_system_type}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {company.ai_models_used.map((model, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {model}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">{company.daily_ai_traffic}</td>
                      <td className="py-3 px-4 text-right text-gray-900">{company.average_ethical_index.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold">{company.high_risk_event_ratio.toFixed(1)}%</td>
                      <td className={`py-3 px-4 ${trendColor}`}>
                        {company.risk_trend === 'Deteriorating' ? '↓ Kötüleşen' :
                         company.risk_trend === 'Improving' ? '↑ İyileşen' :
                         '→ Stabil'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {company.last_observed_activity ? new Date(company.last_observed_activity).toLocaleDateString('tr-TR') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Henüz AI şirketi verisi bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </SanayiLayout>
  );
}

