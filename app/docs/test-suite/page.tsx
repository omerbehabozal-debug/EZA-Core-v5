"use client";

import { useState, useEffect } from "react";
import Section from "@/app/components/Section";
import FadeIn from "@/app/components/FadeIn";
import Icon from "@/app/components/Icon";
import ComplianceMatrix from "@/app/components/ComplianceMatrix";
import { formatImprovement, formatDetails, formatAnyValue } from "@/lib/formatUtils";

// API Response Interface - Backend'den gelen yapı
interface ComprehensiveTestResults {
  overall: {
    total_runs?: number;
    total_tests: number; // snapshot_total_tests
    success_rate: number; // snapshot_success_rate
    success_count?: number;
    failure_count?: number;
    lifetime_total_tests?: number; // Lifetime toplam test sayısı (varsa)
    total_tests_all_time?: number; // Alternatif field adı
  };
  test_suites: TestSuite[];
  last_updated?: string; // Snapshot tarihi
  generated_at?: string; // Alternatif field adı
  period?: string; // "daily", "weekly", "monthly"
}

interface TestSuite {
  name: string;
  total?: number;
  test_count?: number; // Alternatif field adı
  success_rate: number;
  status: "pass" | "warning" | "fail" | "success";
  improvement?: string;
  description?: string; // Test suite açıklaması
}

// Test Suite Veri Yapısı (UI için)
interface UITestSuite {
  id: string;
  name: string;
  testCount: number;
  successRate: number;
  status: "completed" | "pending" | "failed";
  description: string;
  improvement?: string | { from?: number; to?: number; change?: number; percentage?: number };
  details?: string | string[] | Record<string, any>;
  testType: "fake-llm" | "real-llm";
}

// Static data - will be updated manually
// Replace this object with your data when needed
const STATIC_TEST_DATA: ComprehensiveTestResults | null = {
  overall: {
    total_runs: 1,
    total_tests: 636, // snapshot_total_tests
    success_rate: 96.2, // snapshot_success_rate
    success_count: 612,
    failure_count: 24,
    // lifetime_total_tests: 5406, // Uncomment when available
  },
  test_suites: [
    {
      name: "Core",
      total: 50,
      success_rate: 100.0,
      status: "success",
      description: "Temel fonksiyonellik, pipeline ve skor hesaplama testleri",
    },
    {
      name: "Behavioral",
      total: 45,
      success_rate: 91.1,
      status: "warning",
      description: "Davranış testleri ve senaryo bazlı kontroller",
    },
    {
      name: "Behavioral Extended",
      total: 100,
      success_rate: 80.0,
      status: "warning",
      description: "Gelişmiş davranış testleri ve karmaşık senaryolar",
    },
    {
      name: "Adversarial",
      total: 132,
      success_rate: 100.0,
      status: "success",
      description: "Saldırı testleri ve güvenlik senaryoları",
    },
    {
      name: "Policy",
      total: 127,
      success_rate: 100.0,
      status: "success",
      description: "Politika ve kural uyumluluk testleri",
    },
    {
      name: "Multi-Turn",
      total: 100,
      success_rate: 100.0,
      status: "success",
      description: "Çoklu tur konuşma ve bağlam yönetimi testleri",
    },
    {
      name: "Multi-Model",
      total: 30,
      success_rate: 100.0,
      status: "success",
      description: "Çoklu model entegrasyon ve uyumluluk testleri",
    },
    {
      name: "Performance",
      total: 52,
      success_rate: 100.0,
      status: "success",
      description: "Performans ve yanıt süresi testleri",
    },
  ],
  last_updated: new Date().toISOString(),
  period: "daily",
};

// Başarı oranına göre yorum metni üret
function getSuccessRateComment(successRate: number): string {
  if (successRate >= 95) {
    return "Yüksek güven seviyesi.";
  } else if (successRate >= 85) {
    return "Genel olarak güçlü, iyileştirme alanı sınırlı.";
  } else if (successRate >= 70) {
    return "Orta seviye; riskli senaryolarda geliştirme önerilir.";
  } else {
    return "Düşük seviye; öncelikli iyileştirme gerekir.";
  }
}

// API verisini UI formatına dönüştür
function transformApiDataToUI(apiData: ComprehensiveTestResults): {
  suites: UITestSuite[];
  snapshotTotalTests: number;
  snapshotSuccessRate: number;
  lifetimeTotalTests: number | null;
  suiteCount: number;
  lastUpdated: string | null;
  period: string | null;
} {
  const suites: UITestSuite[] = apiData.test_suites.map((suite) => {
    // Status mapping: success_rate >= 90 → success
    let uiStatus: "completed" | "pending" | "failed" = "completed";
    if (suite.status === "fail" || suite.success_rate < 80) {
      uiStatus = "failed";
    } else if (suite.status === "warning" || (suite.success_rate >= 80 && suite.success_rate < 90)) {
      uiStatus = "pending";
    } else if (suite.status === "success" || suite.success_rate >= 90) {
      uiStatus = "completed";
    }

    // Test type tahmini (name'e göre)
    const testType: "fake-llm" | "real-llm" = 
      suite.name.toLowerCase().includes("performance") || suite.name.toLowerCase().includes("core")
        ? "fake-llm"
        : "real-llm";

    const testCount = suite.total || suite.test_count || 0;

    return {
      id: suite.name.toLowerCase().replace(/\s+/g, "-"),
      name: suite.name,
      testCount: testCount,
      successRate: suite.success_rate,
      status: uiStatus,
      description: suite.description || `${suite.name} test suite`,
      improvement: suite.improvement,
      testType: testType,
    };
  });

  // Lifetime toplam test kontrolü
  const lifetimeTotalTests = apiData.overall.lifetime_total_tests || apiData.overall.total_tests_all_time || null;
  const lastUpdated = apiData.last_updated || apiData.generated_at || null;
  const period = apiData.period || null;

  return {
    suites,
    snapshotTotalTests: apiData.overall.total_tests,
    snapshotSuccessRate: apiData.overall.success_rate,
    lifetimeTotalTests,
    suiteCount: suites.length,
    lastUpdated,
    period,
  };
}

// Format date safely
function formatDate(dateString: string | undefined | null): string {
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

// Özet Kartları Component
function TestSummaryCards({ 
  snapshotTotalTests,
  snapshotSuccessRate, 
  suiteCount,
  isLoading,
  hasError
}: { 
  snapshotTotalTests: number;
  snapshotSuccessRate: number; 
  suiteCount: number;
  isLoading: boolean;
  hasError: boolean;
}) {
  const cards = [
    {
      label: "Genel Başarı Oranı (Bu Snapshot)",
      value: isLoading ? "..." : (hasError ? "—" : `%${snapshotSuccessRate.toFixed(1)}`),
      icon: "TrendingUp",
      bgColor: "bg-eza-green/10",
      textColor: "text-eza-green",
    },
    {
      label: "Bu Snapshot'ta Toplam Test Sayısı",
      value: isLoading ? "..." : (hasError ? "—" : snapshotTotalTests.toLocaleString()),
      icon: "CheckCircle",
      bgColor: "bg-eza-blue/10",
      textColor: "text-eza-blue",
    },
    {
      label: "Test Paketi Sayısı",
      value: isLoading ? "..." : (hasError ? "—" : suiteCount.toString()),
      icon: "Layers",
      bgColor: "bg-eza-blue/10",
      textColor: "text-eza-blue",
    },
  ];

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {cards.map((card, index) => (
          <FadeIn key={card.label} delay={index * 100}>
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <Icon name={card.icon} className={card.textColor} size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-eza-text-secondary mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-eza-text">{card.value}</p>
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </>
  );
}

// Snapshot Bilgisi Component
function SnapshotInfo({ 
  lastUpdated, 
  period 
}: { 
  lastUpdated: string | null; 
  period: string | null;
}) {
  if (!lastUpdated) return null;

  const periodLabel = period === "daily" ? "Günlük Snapshot" 
    : period === "weekly" ? "Haftalık Snapshot"
    : period === "monthly" ? "Aylık Snapshot"
    : "Snapshot";

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 text-sm text-blue-800">
        <Icon name="Info" size={16} />
        <span>
          <strong>Yayın (snapshot) tarihi:</strong> {formatDate(lastUpdated)} • <strong>Yayın tipi:</strong> {periodLabel}
        </span>
      </div>
    </div>
  );
}

// Test Suite Kartı Component
function TestSuiteCard({ suite, index }: { suite: UITestSuite; index: number }) {
  // Başarı oranına göre renk belirleme: success_rate >= 90 → success
  const getStatusColor = (rate: number) => {
    if (rate >= 90) {
      return {
        bg: "bg-green-100",
        text: "text-green-700",
        border: "border-green-200",
        icon: "CheckCircle",
        label: "Başarılı",
      };
    } else if (rate >= 80) {
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        border: "border-yellow-200",
        icon: "AlertTriangle",
        label: "Uyarı",
      };
    } else {
      return {
        bg: "bg-red-100",
        text: "text-red-700",
        border: "border-red-200",
        icon: "XCircle",
        label: "İyileştirme Gerekli",
      };
    }
  };

  const statusColor = getStatusColor(suite.successRate);

  return (
    <FadeIn delay={index * 50}>
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-xl hover:border-eza-blue/30 transition-all duration-300 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-eza-text mb-2">{suite.name}</h3>
            <div className={`inline-flex items-center gap-2 px-3 py-1 ${statusColor.bg} ${statusColor.text} text-xs font-semibold rounded-full border ${statusColor.border}`}>
              <Icon name={statusColor.icon} size={14} />
              {statusColor.label}
            </div>
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-eza-text-secondary mb-1">Başarı Oranı</p>
            <p className={`text-2xl font-bold ${statusColor.text}`}>%{suite.successRate.toFixed(1)}</p>
          </div>
          {suite.testCount > 0 && (
            <div>
              <p className="text-xs text-eza-text-secondary mb-1">Kapsam</p>
              <p className="text-2xl font-bold text-eza-text">{suite.testCount} test</p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full h-2 bg-eza-gray rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                suite.successRate >= 90
                  ? "bg-gradient-to-r from-green-500 to-green-600"
                  : suite.successRate >= 80
                  ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                  : "bg-gradient-to-r from-red-500 to-red-600"
              }`}
              style={{ width: `${suite.successRate}%` }}
            />
          </div>
        </div>

        {/* Açıklama */}
        <p className="text-sm text-eza-text-secondary leading-relaxed mb-4 flex-1">
          {suite.description}
        </p>

        {/* Yorum (Anlam) */}
        <div className="mb-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-eza-text-secondary/80 italic">
            {getSuccessRateComment(suite.successRate)}
          </p>
        </div>

        {/* İyileştirme - Safe rendering */}
        {(() => {
          const improvementText = formatImprovement(suite.improvement);
          return improvementText ? (
            <div className="mt-4 p-3 bg-eza-blue/5 rounded-lg border border-eza-blue/10">
              <p className="text-xs font-semibold text-eza-blue mb-1">İyileştirme</p>
              <p className="text-sm text-eza-text">{improvementText}</p>
            </div>
          ) : null;
        })()}

        {(() => {
          const detailsText = formatDetails(suite.details);
          return detailsText ? (
            <div className="mt-4 p-3 bg-eza-gray/50 rounded-lg">
              <p className="text-xs font-semibold text-eza-text-secondary mb-1">Detaylar</p>
              <p className="text-sm text-eza-text">{detailsText}</p>
            </div>
          ) : null;
        })()}

        {/* Test Tipi Badge */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-eza-text-secondary">
            {suite.testType === "real-llm" ? "Gerçek LLM" : "Fake LLM"}
          </span>
        </div>
      </div>
    </FadeIn>
  );
}

// Test Suite Grid Component
function TestSuiteGrid({ suites, isLoading, hasError }: { suites: UITestSuite[]; isLoading: boolean; hasError: boolean }) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-eza-text-secondary">Test verileri yükleniyor...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 max-w-2xl mx-auto">
          <Icon name="AlertCircle" className="text-yellow-600 mx-auto mb-4" size={32} />
          <p className="text-yellow-800 font-semibold mb-2">Veri yüklenemedi</p>
          <p className="text-sm text-yellow-700">Lütfen daha sonra tekrar deneyin.</p>
        </div>
      </div>
    );
  }

  if (suites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-eza-text-secondary">Henüz test verisi bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {suites.map((suite, index) => (
        <TestSuiteCard key={suite.id} suite={suite} index={index} />
      ))}
    </div>
  );
}

// Önemli Başarılar Component
function HighlightAchievements() {
  const achievements = [
    {
      title: "Adversarial Tests",
      description: "%30.3 → %100 iyileştirme (132/132)",
      icon: "Shield",
      bgColor: "bg-eza-blue/10",
      textColor: "text-eza-blue",
    },
    {
      title: "Multi-Model Consistency",
      description: "Yeni paket, %100 başarı (30/30)",
      icon: "Layers",
      bgColor: "bg-eza-green/10",
      textColor: "text-eza-green",
    },
    {
      title: "Performance Suite",
      description: "Yeniden yapılandırıldı, 52 testte %100 başarı",
      icon: "Zap",
      bgColor: "bg-eza-blue/10",
      textColor: "text-eza-blue",
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {achievements.map((achievement, index) => (
        <FadeIn key={achievement.title} delay={index * 100}>
          <div className="bg-gradient-to-br from-white to-eza-gray/30 rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
            <div className={`w-12 h-12 rounded-lg ${achievement.bgColor} flex items-center justify-center mb-4`}>
              <Icon name={achievement.icon} className={achievement.textColor} size={24} />
            </div>
            <h3 className="text-lg font-bold text-eza-text mb-2">{achievement.title}</h3>
            <p className="text-sm text-eza-text-secondary">{achievement.description}</p>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}

// 6 Aylık Toplam Bölümü Component
function LifetimeSummary({ 
  lifetimeTotalTests,
  isLoading,
  hasError
}: { 
  lifetimeTotalTests: number | null;
  isLoading: boolean;
  hasError: boolean;
}) {
  return (
    <Section className="bg-eza-gray">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
              6 Aylık Toplam Test Kapsamı
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
            </h2>
            <p className="text-lg text-eza-text-secondary max-w-2xl mx-auto">
              Son 6 ayda çalıştırılan toplam test sayısı ve kapsamlı performans özeti
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="bg-white rounded-2xl p-8 md:p-12 border border-gray-200 shadow-sm">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-eza-text-secondary">Veriler yükleniyor...</p>
              </div>
            ) : hasError ? (
              <div className="text-center py-8">
                <p className="text-eza-text-secondary">Veriler şu anda güncelleniyor.</p>
              </div>
            ) : lifetimeTotalTests !== null ? (
              <div className="text-center">
                <div className="mb-6">
                  <p className="text-sm font-medium text-eza-text-secondary mb-2">Toplam Test Kapsamı (6 Ay)</p>
                  <p className="text-5xl font-bold text-eza-text mb-4">
                    {lifetimeTotalTests.toLocaleString()}
                  </p>
                </div>
                <div className="bg-eza-blue/5 rounded-lg p-4 border border-eza-blue/10">
                  <p className="text-sm text-eza-text-secondary">
                    Bu sayı, son 6 ayda çalıştırılan tüm testlerin toplamını temsil eder.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mb-4">
                  <Icon name="Info" className="text-eza-blue mx-auto mb-4" size={48} />
                  <p className="text-3xl font-bold text-eza-text mb-2">—</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-xl mx-auto">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    Lifetime kapsam yakında ayrı bir özet olarak yayınlanacaktır.
                  </p>
                  <p className="text-xs text-blue-700">
                    6 aylık toplam test verileri hazırlandığında bu bölümde görüntülenecektir.
                  </p>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

// Metodoloji ve Şeffaflık Component
function MethodologyTransparency() {
  return (
    <Section className="bg-white">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
              Metodoloji ve Şeffaflık
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
            </h2>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="bg-gradient-to-br from-eza-gray to-white rounded-2xl p-8 md:p-12 border border-gray-200 shadow-sm">
            <div className="space-y-6 text-eza-text-secondary leading-relaxed">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-eza-blue/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Icon name="CheckCircle" className="text-eza-blue" size={16} />
                </div>
                <p>
                  <strong className="text-eza-text">Testler günlük/haftalık/aylık periyotlarda arka planda çalışır.</strong>
                </p>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-eza-blue/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Icon name="CheckCircle" className="text-eza-blue" size={16} />
                </div>
                <p>
                  <strong className="text-eza-text">Sonuçlar snapshot olarak yayınlanır ve yayınlandıktan sonra değişmez.</strong>
                </p>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-eza-blue/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Icon name="CheckCircle" className="text-eza-blue" size={16} />
                </div>
                <p>
                  <strong className="text-eza-text">Bu sayfa, anlık hesaplama tetiklemez; yayınlanmış snapshot verisini gösterir.</strong>
                </p>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-eza-blue/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Icon name="CheckCircle" className="text-eza-blue" size={16} />
                </div>
                <p>
                  <strong className="text-eza-text">Amaç: güvenlik ve etik performansının izlenebilir ve denetlenebilir olması.</strong>
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

// Güvenlik Notu Component
function SecurityNote() {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Icon name="AlertTriangle" className="text-amber-600" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-amber-900 mb-2">Güvenlik Notu</h3>
          <p className="text-sm text-amber-800 leading-relaxed">
            Not: Güvenlik ve kötüye kullanım riskleri nedeniyle test senaryolarının tam içeriği kamuya açık değildir. 
            Regülasyon otoriteleri ve kurumsal denetimler için detaylı raporlar, denetimli ve kontrollü erişim modeliyle paylaşılabilir.
          </p>
        </div>
      </div>
    </div>
  );
}

// Kurumsal Açıklama Component
function WhyTestsMatter() {
  return (
    <Section className="bg-white">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
              Neden Bu Testler Önemli?
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
            </h2>
          </div>
          <div className="space-y-4 text-eza-text-secondary leading-relaxed text-lg">
            <p>
              Yapay zekâ sistemleri; metin üretimi, karar destek, medya analizi ve otonom süreçlerde kritik roller üstlenmektedir.
            </p>
            <p>
              EZA'nın test mimarisi; davranışsal tutarlılık, model güvenliği, saldırı dayanıklılığı, politik ihlal tespiti ve çoklu model tutarlılığı gibi dünyanın en güncel güvenlik gereksinimlerine göre tasarlanmıştır.
            </p>
            <p>
              Bu testler, <strong className="text-eza-text">AB Yapay Zekâ Yasası</strong>, <strong className="text-eza-text">NIST AI RMF</strong> ve <strong className="text-eza-text">ISO/IEC 23053</strong> ile tam uyumludur.
            </p>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

// Regülasyon Uyumluluk Haritası Component
function RegulationCompliance() {
  const regulations = [
    {
      name: "AB AI Act",
      description: "Risk Yönetimi / Güvenli Yanıt Üretimi",
      icon: "Shield",
    },
    {
      name: "NIST AI Risk Framework",
      description: "Alignment + Mitigation",
      icon: "CheckCircle",
    },
    {
      name: "ISO/IEC 23053",
      description: "AI Governance",
      icon: "FileText",
    },
    {
      name: "ISO/IEC 42001",
      description: "AI Management Systems",
      icon: "Settings",
    },
    {
      name: "OECD AI Principles",
      description: "Fairness, Accountability",
      icon: "Globe",
    },
    {
      name: "RTÜK / BTK",
      description: "Ulusal içerik ve dijital güvenlik regülasyonları",
      icon: "Flag",
    },
  ];

  return (
    <Section className="bg-eza-gray">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
              Regülasyon Uyumluluğu
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
            </h2>
            <p className="text-lg text-eza-text-secondary max-w-2xl mx-auto">
              EZA, dünya çapında kabul görmüş yapay zekâ güvenlik standartlarıyla tam uyumludur.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regulations.map((regulation, index) => (
            <FadeIn key={regulation.name} delay={index * 100}>
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-[0_4px_30px_rgba(0,0,0,0.04)] hover:shadow-lg hover:scale-105 transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center mb-4">
                  <Icon name={regulation.icon} className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-bold text-eza-text mb-2">{regulation.name}</h3>
                <p className="text-sm text-eza-text-secondary">{regulation.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

// Test Ekosistemi Mimarisi Component
function TestEcosystemArchitecture() {
  return (
    <Section className="bg-white">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
              EZA Test Ekosistemi Mimarisi
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
            </h2>
            <p className="text-lg text-eza-text-secondary max-w-2xl mx-auto">
              EZA'nın test altyapısının mimari akışı
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="bg-[#f8f9fb] rounded-xl p-8 md:p-12 border border-gray-200 shadow-[0_4px_30px_rgba(0,0,0,0.04)] font-mono">
            <div className="space-y-4 text-eza-text text-center">
              <div className="text-lg font-semibold">User Input</div>
              <div className="text-eza-blue">↓</div>
              <div className="text-lg font-semibold">Input Analyzer</div>
              <div className="text-eza-blue">↓</div>
              <div className="text-lg font-semibold">Model Router → LLM1 / LLM2 / LLM3</div>
              <div className="text-eza-blue">↓</div>
              <div className="text-lg font-semibold">Output Analyzer</div>
              <div className="text-eza-blue">↓</div>
              <div className="text-lg font-semibold">Policy Engine (F1-F3, Z1-Z3)</div>
              <div className="text-eza-blue">↓</div>
              <div className="text-lg font-semibold">Behavioral Engine</div>
              <div className="text-eza-blue">↓</div>
              <div className="text-lg font-semibold text-eza-green">Safe & Aligned Answer</div>
            </div>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

// Test Frekansı Takvimi Component
function TestFrequencyCalendar() {
  const frequencies = [
    {
      period: "Daily Tests",
      icon: "Calendar",
      tests: [
        { name: "Core Safety", description: "Temel güvenlik kontrolleri" },
        { name: "Performance", description: "Performans metrikleri" },
      ],
    },
    {
      period: "Weekly Tests",
      icon: "Clock",
      tests: [
        { name: "Policy", description: "Politika uyumluluk testleri" },
        { name: "Behavioral", description: "Davranışsal analiz testleri" },
        { name: "Multi-turn", description: "Çoklu tur senaryoları" },
      ],
    },
    {
      period: "Monthly Tests",
      icon: "Calendar",
      tests: [
        { name: "Adversarial", description: "Saldırı dayanıklılık testleri" },
        { name: "Multi-Model", description: "Çoklu model tutarlılık testleri" },
      ],
    },
  ];

  return (
    <Section className="bg-[#f5f9ff]">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
              Profesyonel Test Periyotları
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
            </h2>
            <p className="text-lg text-eza-text-secondary max-w-2xl mx-auto">
              EZA test ekosistemi, farklı periyotlarda çalışan kapsamlı test süitlerinden oluşur.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-8">
          {frequencies.map((frequency, index) => (
            <FadeIn key={frequency.period} delay={index * 100}>
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                    <Icon name={frequency.icon} className="text-eza-blue" size={24} />
                  </div>
                  <h3 className="text-2xl font-bold text-eza-text">{frequency.period}</h3>
                </div>
                <div className="space-y-4">
                  {frequency.tests.map((test) => (
                    <div key={test.name} className="pb-4 border-b border-gray-100 last:border-0">
                      <h4 className="font-semibold text-eza-text mb-1">{test.name}</h4>
                      <p className="text-sm text-eza-text-secondary">{test.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

// Ana Sayfa Component (Client Component)
export default function TestSuitePage() {
  const [data, setData] = useState<{
    suites: UITestSuite[];
    snapshotTotalTests: number;
    snapshotSuccessRate: number;
    lifetimeTotalTests: number | null;
    suiteCount: number;
    lastUpdated: string | null;
    period: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Use static data - update STATIC_TEST_DATA constant above with your data
  useEffect(() => {
    if (STATIC_TEST_DATA && STATIC_TEST_DATA.overall && STATIC_TEST_DATA.test_suites) {
      try {
        const transformed = transformApiDataToUI(STATIC_TEST_DATA);
        setData(transformed);
        setHasError(false);
      } catch (transformError) {
        // Controlled error logging - no console.error for invalid data structure
        if (transformError instanceof Error && !transformError.message.includes("invalid data structure")) {
          console.error("Error transforming static data:", transformError);
        }
        setHasError(true);
      }
    } else {
      setHasError(true);
    }
    setIsLoading(false);
  }, []);

  const suites = data?.suites || [];
  const snapshotTotalTests = data?.snapshotTotalTests || 0;
  const snapshotSuccessRate = data?.snapshotSuccessRate || 0;
  const suiteCount = data?.suiteCount || 0;
  const lifetimeTotalTests = data?.lifetimeTotalTests ?? null;
  const lastUpdated = data?.lastUpdated || null;
  const period = data?.period || null;

  return (
    <>
      {/* Premium Hero Section */}
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
                EZA'nın etik zekası periyodik olarak test edilir, ölçülür ve doğrulanır.
              </p>
              <p className="text-base text-eza-text-secondary/80 max-w-3xl mx-auto italic">
                Bu sayfadaki veriler anlık değildir; periyodik olarak yayınlanan snapshot sonuçlarıdır.
              </p>
            </div>
          </FadeIn>

          {/* Hata Banner */}
          {!isLoading && hasError && (
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 max-w-2xl mx-auto">
                <div className="flex items-center gap-3">
                  <Icon name="Info" className="text-blue-600" size={24} />
                  <div>
                    <p className="text-blue-800 font-semibold mb-1">Veriler şu anda güncelleniyor</p>
                    <p className="text-sm text-blue-700">Lütfen daha sonra tekrar deneyin.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Özet Kartları */}
          <TestSummaryCards 
            snapshotTotalTests={snapshotTotalTests}
            snapshotSuccessRate={snapshotSuccessRate} 
            suiteCount={suiteCount}
            isLoading={isLoading}
            hasError={hasError}
          />

          {/* Snapshot Bilgisi */}
          <SnapshotInfo lastUpdated={lastUpdated} period={period} />
        </div>
      </div>

      {/* Kurumsal Açıklama */}
      <WhyTestsMatter />

      {/* Test Suite Özeti */}
      <Section className="bg-eza-gray">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
                Test Suite Özeti
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
              </h2>
              <p className="text-lg text-eza-text-secondary max-w-2xl mx-auto">
                {suiteCount > 0 ? `${suiteCount} farklı test paketi ile EZA'nın güvenilirliği ve performansı kapsamlı şekilde değerlendirilmektedir.` : "EZA'nın güvenilirliği ve performansı kapsamlı şekilde değerlendirilmektedir."}
              </p>
            </div>
          </FadeIn>

          <TestSuiteGrid suites={suites} isLoading={isLoading} hasError={hasError} />
        </div>
      </Section>

      {/* Regülasyon Uyumluluk Haritası */}
      <RegulationCompliance />

      {/* Test Ekosistemi Mimarisi */}
      <TestEcosystemArchitecture />

      {/* Regülasyon Uyum Matrisi */}
      <ComplianceMatrix />

      {/* Test Frekansı Takvimi */}
      <TestFrequencyCalendar />

      {/* Önemli Başarılar */}
      <Section className="bg-white">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
                Önemli Başarılar
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-eza-blue to-transparent"></span>
              </h2>
              <p className="text-lg text-eza-text-secondary max-w-2xl mx-auto">
                EZA'nın test süitlerindeki öne çıkan başarıları ve iyileştirmeler.
              </p>
            </div>
          </FadeIn>

          <HighlightAchievements />
        </div>
      </Section>

      {/* Test Frekansı ve Regülasyon */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="bg-gradient-to-br from-eza-blue/5 via-white to-eza-blue/5 rounded-2xl p-8 md:p-12 border border-eza-blue/10 shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Clock" className="text-eza-blue" size={24} />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-eza-text">
                  Test Frekansı ve Regülasyon
                </h2>
              </div>
              
              <div className="space-y-4 text-eza-text-secondary leading-relaxed">
                <p>
                  Testler belirli aralıklarla (örneğin haftalık) ve kritik güncellemelerde otomatik olarak çalıştırılır. 
                  Test sonuçları, regülasyon kurumları ve kurumsal müşteriler için şeffaflık ve güven sağlamayı amaçlar.
                </p>
                <p>
                  Bu test yapısı, <strong className="text-eza-text">AB AI Act</strong>, <strong className="text-eza-text">NIST AI RMF</strong>, 
                  <strong className="text-eza-text"> ISO/IEC 23053</strong> gibi yapay zeka güvenlik standartlarıyla uyumlu denetim süreçlerine 
                  entegre edilebilecek bir altyapı sunar.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* 6 Aylık Toplam Test Kapsamı */}
      <LifetimeSummary 
        lifetimeTotalTests={lifetimeTotalTests}
        isLoading={isLoading}
        hasError={hasError}
      />

      {/* Metodoloji ve Şeffaflık */}
      <MethodologyTransparency />

      {/* Güvenlik Notu */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <SecurityNote />
          </FadeIn>
        </div>
      </Section>
    </>
  );
}
