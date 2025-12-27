/**
 * Regulator Dashboard
 * 
 * Aggregate metrics only - NO content display
 */

'use client';

import { useEffect, useState } from 'react';
import { RegulatorLayout } from '@/components/RegulatorLayout';
import { InfoTooltip } from '@/components/InfoTooltip';
import { apiClient, AuditLogEntry, CoverageSummary, CountryRiskSummary, CountryRiskTrends, CountryPatterns } from '@/lib/api-client';
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
  const [countryRiskSummary, setCountryRiskSummary] = useState<CountryRiskSummary | null>(null);
  const [countryTrends, setCountryTrends] = useState<CountryRiskTrends | null>(null);
  const [countryPatterns, setCountryPatterns] = useState<CountryPatterns | null>(null);
  const [loadingCountryData, setLoadingCountryData] = useState(true);

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
    
    // Fetch country-level analytics
    const fetchCountryData = async () => {
      try {
        setLoadingCountryData(true);
        
        const [summary, trends, patterns] = await Promise.all([
          apiClient.get<CountryRiskSummary>('/api/proxy/audit/global/country-risk-summary').catch(() => null),
          apiClient.get<CountryRiskTrends>('/api/proxy/audit/global/country-risk-trends?days=30').catch(() => null),
          apiClient.get<CountryPatterns>('/api/proxy/audit/global/country-patterns').catch(() => null),
        ]);
        
        if (summary?.ok) setCountryRiskSummary(summary);
        if (trends?.ok) setCountryTrends(trends);
        if (patterns?.ok) setCountryPatterns(patterns);
      } catch (err) {
        console.error('Error fetching country data:', err);
        // Don't set error - country data is optional
      } finally {
        setLoadingCountryData(false);
      }
    };
    
    fetchCountryData();
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
        {/* Global Context Statement - MANDATORY */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-sm text-blue-900 leading-relaxed">
            <strong>Global Gözetim Katmanı:</strong> Bu panel, EZA altyapısının global davranışsal gözlem katmanını temsil eder.
            Burada gösterilen göstergeler, ülkeler arasında toplulaştırılmış ve anonimleştirilmiş kalıpları yansıtır.
            Ulusal düzenleyiciler, bu global katmanın üzerine inşa edilmiş, kapsam-spesifik özel paneller üzerinde çalışır.
          </p>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 flex items-center" translate="no">
          Global Kontrol Paneli
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

        {/* Global Behavioral Risk Distribution (Country-Level) */}
        {countryRiskSummary && countryRiskSummary.countries.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border-t-2 border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Global Davranışsal Risk Dağılımı (Ülke Bazlı)
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Ülke Kodu</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Ortalama Etik İndeks</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Düşük Risk</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Orta Risk</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Yüksek Risk</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Normalize Analiz Hacmi</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Toplam Analiz</th>
                  </tr>
                </thead>
                <tbody>
                  {countryRiskSummary.countries.map((country) => (
                    <tr key={country.country_code} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-gray-900">{country.country_code}</td>
                      <td className="py-3 px-4 text-right text-gray-900">{country.average_ethical_index.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right text-green-600">{country.risk_distribution.low}</td>
                      <td className="py-3 px-4 text-right text-yellow-600">{country.risk_distribution.medium}</td>
                      <td className="py-3 px-4 text-right text-red-600">{country.risk_distribution.high}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{country.normalized_analysis_volume.toFixed(1)}%</td>
                      <td className="py-3 px-4 text-right text-gray-900">{country.total_analyses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Country vs Time - Risk Trend Analysis */}
        {countryTrends && countryTrends.countries.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border-t-2 border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Davranışsal Risk Trendleri (Ülke Bazlı)
            </h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Son {countryTrends.period_days} gün - Global Ortalama: {countryTrends.global_average.toFixed(1)}
              </p>
            </div>
            
            <div className="space-y-4">
              {countryTrends.countries.map((country) => (
                <div key={country.country_code} className="border border-gray-200 rounded p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 font-mono">
                    {country.country_code}
                  </h3>
                  <div className="flex items-end gap-1 h-32">
                    {country.daily_averages.map((day, idx) => {
                      const height = (day.average_ethical_index / 100) * 100;
                      return (
                        <div
                          key={idx}
                          className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${day.average_ethical_index.toFixed(1)} (${day.sample_count} örnek)`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {country.daily_averages.length} günlük veri noktası
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cross-Country Risk Pattern Comparison */}
        {countryPatterns && countryPatterns.countries.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border-t-2 border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Ülkelere Göre Baskın Risk Kalıpları
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Ülke Kodu</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Baskın Risk Türü</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Trend Yönü</th>
                  </tr>
                </thead>
                <tbody>
                  {countryPatterns.countries.map((country) => {
                    const trendColor = 
                      country.trend_direction === 'Increasing' ? 'text-red-600' :
                      country.trend_direction === 'Decreasing' ? 'text-green-600' :
                      'text-gray-600';
                    
                    return (
                      <tr key={country.country_code} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-gray-900">{country.country_code}</td>
                        <td className="py-3 px-4 text-gray-700">{country.dominant_risk_pattern}</td>
                        <td className={`py-3 px-4 ${trendColor}`}>
                          {country.trend_direction === 'Increasing' ? '↑ Artan' :
                           country.trend_direction === 'Decreasing' ? '↓ Azalan' :
                           country.trend_direction === 'Stable' ? '→ Stabil' :
                           '? Yetersiz Veri'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </RegulatorLayout>
  );
}

