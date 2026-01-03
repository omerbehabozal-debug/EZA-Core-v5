"use client";

import { useState } from "react";
import Section from "@/app/components/Section";
import FadeIn from "@/app/components/FadeIn";
import Icon from "@/app/components/Icon";
import { formatImprovement, formatDetails } from "@/lib/formatUtils";

// API Response Interface - Snapshot-based public API
interface TestResultsResponse {
  overall: {
    total_runs: number;
    total_tests: number;
    success_rate: number;
    success_count?: number;
    failure_count?: number;
  };
  test_suites: TestSuite[];
  latest_runs?: LatestRun[];
  improvements?: Record<string, any>;
  generated_at: string; // Snapshot generation timestamp
  period?: string; // e.g., "daily"
}

interface TestSuite {
  name: string;
  description?: string;
  success_rate: number;
  status: "pass" | "warning" | "fail" | "success";
  improvement?: string | {
    from?: number;
    to?: number;
    change?: number;
    percentage?: number;
  };
  details?: string | string[] | Record<string, any>;
}

interface LatestRun {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  success_rate: number;
}

// Format date safely
function formatDate(dateString: string | undefined): string {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return new Intl.DateTimeFormat('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

// Static data - will be updated manually
// Replace this object with your data when needed
const STATIC_TEST_DATA: TestResultsResponse | null = {
  overall: {
    total_runs: 1,
    total_tests: 636,
    success_rate: 96.2,
    success_count: 612,
    failure_count: 24,
  },
  test_suites: [
    {
      name: "Core",
      description: "Temel fonksiyonellik, pipeline ve skor hesaplama testleri",
      success_rate: 100.0,
      status: "success",
      details: "50 test, tümü başarılı",
    },
    {
      name: "Behavioral",
      description: "Davranış testleri ve senaryo bazlı kontroller",
      success_rate: 91.1,
      status: "warning",
      details: "45 test, 41 başarılı, 4 başarısız",
    },
    {
      name: "Behavioral Extended",
      description: "Gelişmiş davranış testleri ve karmaşık senaryolar",
      success_rate: 80.0,
      status: "warning",
      details: "100 test, 80 başarılı, 20 başarısız",
    },
    {
      name: "Adversarial",
      description: "Saldırı testleri ve güvenlik senaryoları",
      success_rate: 100.0,
      status: "success",
      details: "132 test, tümü başarılı",
    },
    {
      name: "Policy",
      description: "Politika ve kural uyumluluk testleri",
      success_rate: 100.0,
      status: "success",
      details: "127 test, tümü başarılı",
    },
    {
      name: "Multi-Turn",
      description: "Çoklu tur konuşma ve bağlam yönetimi testleri",
      success_rate: 100.0,
      status: "success",
      details: "100 test, tümü başarılı",
    },
    {
      name: "Multi-Model",
      description: "Çoklu model entegrasyon ve uyumluluk testleri",
      success_rate: 100.0,
      status: "success",
      details: "30 test, tümü başarılı",
    },
    {
      name: "Performance",
      description: "Performans ve yanıt süresi testleri",
      success_rate: 100.0,
      status: "success",
      details: "52 test, tümü başarılı",
    },
  ],
  latest_runs: [
    {
      timestamp: new Date().toISOString(),
      total: 636,
      passed: 612,
      failed: 24,
      success_rate: 96.2,
    },
  ],
  generated_at: new Date().toISOString(),
  period: "daily",
};

export default function TestSafetyBenchmarksPage() {
  // Use static data - update STATIC_TEST_DATA constant above with your data
  const [data] = useState<TestResultsResponse | null>(STATIC_TEST_DATA);
  const isLoading = false;
  const hasError = !data;

  // En son çalıştırma verilerini kullan (eğer varsa)
  const latestRun = data?.latest_runs?.[0];
  const overall = latestRun ? {
    total_runs: data.overall?.total_runs || 0,
    total_tests: latestRun.total,
    success_rate: latestRun.success_rate,
    success_count: latestRun.passed,
    failure_count: latestRun.failed,
  } : data?.overall;
  
  const testSuites = data?.test_suites || [];
  const latestRuns = data?.latest_runs || [];
  const generatedAt = latestRun?.timestamp || data?.generated_at;

  return (
    <>
      {/* Hero Section */}
      <div 
        className="py-24 md:py-32"
        style={{
          background: "linear-gradient(135deg, #f7faff 0%, #eef4ff 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-eza-text mb-6 leading-tight">
                Test ve Güvenlik Karşılaştırmaları
              </h1>
              <p className="text-xl md:text-2xl text-eza-text-secondary max-w-4xl mx-auto leading-relaxed mb-4">
                EZA'nın etik zekası sürekli olarak test edilir, ölçülür ve doğrulanır.
              </p>
              <p className="text-base text-eza-text-secondary/80 max-w-3xl mx-auto italic">
                Bu veriler periyodik olarak yayınlanır, anlık değildir.
              </p>
            </div>
          </FadeIn>

          {/* Overview Metrics */}
          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                  <div className="h-10 bg-gray-200 rounded w-32"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              <FadeIn delay={100}>
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <p className="text-sm font-medium text-eza-text-secondary mb-2">Toplam Test</p>
                  <p className="text-3xl font-bold text-eza-text">
                    {overall && typeof overall.total_tests === 'number' 
                      ? overall.total_tests.toLocaleString() 
                      : '—'}
                  </p>
                </div>
              </FadeIn>
              
              <FadeIn delay={200}>
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <p className="text-sm font-medium text-eza-text-secondary mb-2">Genel Başarı Oranı</p>
                  <p className="text-3xl font-bold text-eza-text">
                    {overall && typeof overall.success_rate === 'number' 
                      ? `${overall.success_rate.toFixed(1)}%` 
                      : '—'}
                  </p>
                </div>
              </FadeIn>
              
              <FadeIn delay={300}>
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <p className="text-sm font-medium text-eza-text-secondary mb-2">Test Suite Sayısı</p>
                  <p className="text-3xl font-bold text-eza-text">
                    {Array.isArray(testSuites) && testSuites.length > 0 
                      ? testSuites.length.toLocaleString() 
                      : '—'}
                  </p>
                </div>
              </FadeIn>
            </div>
          )}
          
          {/* Error message - only show if no data at all and not loading */}
          {!isLoading && hasError && !data && (
            <div className="text-center py-8 mt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 max-w-2xl mx-auto">
                <Icon name="Info" className="text-blue-600 mx-auto mb-4" size={32} />
                <p className="text-blue-800 font-semibold mb-2">Veriler güncelleniyor</p>
                <p className="text-sm text-blue-700">Lütfen daha sonra tekrar deneyin.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Suite Grid */}
      {data && testSuites.length > 0 && (
        <Section className="bg-white">
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4">
                  Test Paketleri
                </h2>
                {generatedAt && (
                  <p className="text-sm text-eza-text-secondary/70 italic">
                    Veri oluşturulma zamanı: {formatDate(generatedAt)}
                  </p>
                )}
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testSuites.map((suite, index) => {
                // Safe value extraction with fallbacks
                const suiteSuccessRate = typeof suite?.success_rate === 'number' ? suite.success_rate : 0;
                const suiteName = typeof suite?.name === 'string' ? suite.name : `Suite ${index + 1}`;
                const suiteStatus = typeof suite?.status === 'string' ? suite.status : 'unknown';
                
                const improvementText = suite?.improvement ? formatImprovement(suite.improvement) : null;
                const detailsText = suite?.details ? formatDetails(suite.details) : null;
                
                const statusColor = suiteSuccessRate >= 90 
                  ? { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" }
                  : suiteSuccessRate >= 80
                  ? { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" }
                  : { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" };

                return (
                  <FadeIn key={suiteName || index} delay={index * 50}>
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all h-full flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-eza-text mb-2">
                            {suiteName}
                          </h3>
                          <div className={`inline-flex items-center gap-2 px-3 py-1 ${statusColor.bg} ${statusColor.text} text-xs font-semibold rounded-full border ${statusColor.border}`}>
                            <Icon 
                              name={suiteSuccessRate >= 90 ? "CheckCircle" : suiteSuccessRate >= 80 ? "AlertTriangle" : "XCircle"} 
                              size={14} 
                            />
                            {suiteStatus.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {typeof suite?.description === 'string' && suite.description && (
                        <p className="text-sm text-eza-text-secondary mb-4 flex-1">
                          {suite.description}
                        </p>
                      )}

                      {detailsText && (
                        <div className="mb-4">
                          <p className="text-xs text-eza-text-secondary mb-1">Detaylar</p>
                          <p className="text-sm text-eza-text-secondary">{detailsText}</p>
                        </div>
                      )}

                      <div className="mt-auto">
                        <div className="mb-4">
                          <p className="text-xs text-eza-text-secondary mb-1">Başarı Oranı</p>
                          <p className={`text-2xl font-bold ${statusColor.text}`}>
                            {suiteSuccessRate > 0 ? `${suiteSuccessRate.toFixed(1)}%` : '—'}
                          </p>
                        </div>

                        {improvementText && (
                          <div className="bg-eza-gray rounded-lg p-3 border border-gray-200">
                            <p className="text-xs text-eza-text-secondary mb-1">İyileşme</p>
                            <p className="text-sm font-semibold text-eza-text">{improvementText}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* Latest Runs Section */}
      {data && latestRuns.length > 0 && (
        <Section className="bg-eza-gray">
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4">
                  Son Test Çalıştırmaları
                </h2>
                <p className="text-sm text-eza-text-secondary/70 italic">
                  Bu veriler snapshot bazlıdır ve periyodik olarak güncellenir.
                </p>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              {latestRuns.slice(0, 3).map((run, index) => {
                // Safe value extraction with fallbacks
                const runTotal = typeof run?.total === 'number' ? run.total : 0;
                const runPassed = typeof run?.passed === 'number' ? run.passed : 0;
                const runFailed = typeof run?.failed === 'number' ? run.failed : 0;
                const runSuccessRate = typeof run?.success_rate === 'number' ? run.success_rate : 0;
                const runTimestamp = run?.timestamp || '';
                
                return (
                  <FadeIn key={runTimestamp || index} delay={index * 100}>
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <p className="text-xs text-eza-text-secondary mb-4">
                        {formatDate(runTimestamp)}
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-eza-text-secondary">Toplam</span>
                          <span className="text-sm font-semibold text-eza-text">
                            {runTotal > 0 ? runTotal : '—'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-sm text-eza-text-secondary">Başarılı</span>
                          <span className="text-sm font-semibold text-green-600">
                            {runPassed > 0 ? runPassed : '—'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-sm text-eza-text-secondary">Başarısız</span>
                          <span className="text-sm font-semibold text-red-600">
                            {runFailed > 0 ? runFailed : '—'}
                          </span>
                        </div>
                        
                        <div className="pt-3 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-eza-text">Başarı Oranı</span>
                            <span className="text-lg font-bold text-eza-text">
                              {runSuccessRate > 0 ? `${runSuccessRate.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </Section>
      )}
    </>
  );
}

