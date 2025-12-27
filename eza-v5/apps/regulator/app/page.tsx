/**
 * Regulator Dashboard
 * 
 * Aggregate metrics only - NO content display
 */

'use client';

import { useEffect, useState } from 'react';
import { RegulatorLayout } from '@/components/RegulatorLayout';
import { InfoTooltip } from '@/components/InfoTooltip';
import { apiClient, AuditLogEntry, CoverageSummary } from '@/lib/api-client';
import { maskOrganizationId } from '@/lib/organization-mask';
import { useRegulatorAuth } from '@/lib/auth-guard';

interface DashboardMetrics {
  totalAnalyses: number;
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  activePolicySets: number;
  systemFlags: number;
  averageEthicalScore: number;
}

interface CoverageData {
  independentSources: number;
  organizations: number;
  aiSystemTypes: number;
  aiModalities: Record<string, number>;
  dataOrigins: Record<string, number>;
}

export default function DashboardPage() {
  const { isAuthorized, loading } = useRegulatorAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverageData, setCoverageData] = useState<CoverageData | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(true);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    // Fetch audit logs and calculate metrics client-side
    const fetchMetrics = async () => {
      try {
        setLoadingMetrics(true);
        
        // Get audit logs (last 30 days)
        const toDate = new Date().toISOString();
        const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        const response = await apiClient.get<{
          ok: boolean;
          count: number;
          results: AuditLogEntry[];
        }>(`/api/proxy/audit/search?from_date=${fromDate}&to_date=${toDate}`);

        if (!response.ok) {
          throw new Error('Denetim kayıtları alınamadı');
        }

        // Calculate metrics client-side
        const results = response.results || [];
        const totalAnalyses = results.length;
        
        const riskDistribution = {
          high: 0,
          medium: 0,
          low: 0,
        };

        let totalEthicalScore = 0;
        let scoreCount = 0;
        const policySets = new Set<string>();
        const flags = new Set<string>();

        results.forEach((entry) => {
          const ethicalScore = entry.risk_scores?.ethical_index || 50;
          
          if (ethicalScore < 50) {
            riskDistribution.high++;
          } else if (ethicalScore < 80) {
            riskDistribution.medium++;
          } else {
            riskDistribution.low++;
          }

          totalEthicalScore += ethicalScore;
          scoreCount++;

          // Extract policy set info if available
          if (entry.sector) {
            policySets.add(entry.sector);
          }

          // Extract flags
          if (entry.flags) {
            const flagList = Array.isArray(entry.flags) 
              ? entry.flags 
              : entry.flags.flags || [];
            flagList.forEach((f: any) => {
              flags.add(f.flag || f.type || 'unknown');
            });
          }
        });

        const averageEthicalScore = scoreCount > 0 
          ? Math.round((totalEthicalScore / scoreCount) * 10) / 10 
          : 0;

        setMetrics({
          totalAnalyses,
          riskDistribution,
          activePolicySets: policySets.size,
          systemFlags: flags.size,
          averageEthicalScore,
        });
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchMetrics();
    
    // Fetch coverage summary
    const fetchCoverage = async () => {
      try {
        setLoadingCoverage(true);
        const response = await apiClient.get<CoverageSummary>('/api/proxy/audit/coverage-summary');
        
        if (response.ok) {
          setCoverageData({
            independentSources: response.independent_sources,
            organizations: response.organizations,
            aiSystemTypes: response.ai_system_types,
            aiModalities: response.ai_modalities,
            dataOrigins: response.data_origins,
          });
        }
      } catch (err) {
        console.error('Error fetching coverage summary:', err);
        // Don't set error - coverage is optional
      } finally {
        setLoadingCoverage(false);
      }
    };
    
    fetchCoverage();
  }, [isAuthorized, loading]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (loadingMetrics) {
    return (
      <RegulatorLayout>
        <div className="text-center py-12">
          <div className="text-lg">Metrikler yükleniyor...</div>
        </div>
      </RegulatorLayout>
    );
  }

  if (error) {
    return (
      <RegulatorLayout>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">
            Metrikler yüklenirken hata: {error}
          </p>
          <p className="text-sm text-red-600 mt-2">
            Bu metrik backend tarafından açığa çıkarılmamışsa, kullanılamaz.
          </p>
        </div>
      </RegulatorLayout>
    );
  }

  if (!metrics) {
    return (
      <RegulatorLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Metrik mevcut değil</p>
        </div>
      </RegulatorLayout>
    );
  }

  return (
    <RegulatorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center" translate="no">
          Kontrol Paneli
          <InfoTooltip text="Bu ekran, sistem genelindeki analiz hacmini ve risk dağılımını özetler. İçerik veya bireysel analiz detayları gösterilmez." />
        </h1>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Toplam Analiz</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics.totalAnalyses.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Son 30 gün</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 flex items-center">
              Ortalama Etik Puanı
              <InfoTooltip text="Seçilen zaman aralığında ölçülen ortalama risk skorudur." />
            </h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics.averageEthicalScore.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">0-100 ölçeği</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Aktif Politika Setleri</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics.activePolicySets}
            </p>
            <p className="text-xs text-gray-500 mt-1">Benzersiz politika setleri</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Sistem Bayrakları</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics.systemFlags}
            </p>
            <p className="text-xs text-gray-500 mt-1">Benzersiz bayrak türleri</p>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            Risk Dağılımı
            <InfoTooltip text="Analizlerin risk seviyelerine göre sınıflandırılmış özetidir." />
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {metrics.riskDistribution.high}
              </div>
              <div className="text-sm text-gray-600 mt-1">Yüksek Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {metrics.riskDistribution.medium}
              </div>
              <div className="text-sm text-gray-600 mt-1">Orta Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics.riskDistribution.low}
              </div>
              <div className="text-sm text-gray-600 mt-1">Düşük Risk</div>
            </div>
          </div>
        </div>

        {/* Coverage & Data Sources */}
        {coverageData && (
          <div className="bg-white rounded-lg shadow p-6 border-t-2 border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Kapsam & Veri Kaynakları
            </h2>
            
            {/* Coverage Summary */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Kapsam Özeti</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-1 flex items-center">
                    Entegre Sistem Kaynakları
                    <InfoTooltip text="Sisteme veri sağlayan farklı sistem kaynaklarının sayısıdır. Her kaynak, içerik analizi yapan bağımsız bir entegrasyonu temsil eder." />
                  </div>
                  <div className="text-xl font-semibold text-gray-900">
                    {coverageData.independentSources}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-1 flex items-center">
                    Aktif Organizasyonlar (Anonim)
                    <InfoTooltip text="Sisteme analiz verisi sağlayan organizasyonların sayısıdır. Organizasyon kimlikleri gizlilik amacıyla maskelenmiştir ve bu sayıda gösterilmez." />
                  </div>
                  <div className="text-xl font-semibold text-gray-900">
                    {coverageData.organizations}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-1 flex items-center">
                    Gözlemlenen AI Sistem Türleri
                    <InfoTooltip text="Sistemde gözlemlenen farklı AI sistem kategorilerinin sayısıdır. Metin üretimi, konuşma AI, görüntü üretimi gibi kategorileri içerir." />
                  </div>
                  <div className="text-xl font-semibold text-gray-900">
                    {coverageData.aiSystemTypes}
                  </div>
                </div>
              </div>
            </div>

            {/* AI System Type Distribution */}
            {Object.keys(coverageData.aiModalities).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">AI Sistem Türü Dağılımı</h3>
                <div className="space-y-2">
                  {Object.entries(coverageData.aiModalities)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-700">{type}</span>
                        <span className="text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Data Origin Types */}
            {Object.keys(coverageData.dataOrigins).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Veri Köken Türleri</h3>
                <div className="space-y-2">
                  {Object.entries(coverageData.dataOrigins)
                    .sort((a, b) => b[1] - a[1])
                    .map(([origin, count]) => (
                      <div key={origin} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-700">{origin}</span>
                        <span className="text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Processing & Privacy Statement */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 leading-relaxed">
                Bu panelde gösterilen tüm veriler anonimleştirilmiş, toplulaştırılmış analiz kayıtlarından türetilmiştir.
                Kaynak kimlikleri, içerik ve sistem özel detaylar kasıtlı olarak hariç tutulmuştur.
                Panel kapsam alanını yansıtır, pazar temsili veya satıcı atfı değildir.
              </p>
            </div>
          </div>
        )}
      </div>
    </RegulatorLayout>
  );
}

