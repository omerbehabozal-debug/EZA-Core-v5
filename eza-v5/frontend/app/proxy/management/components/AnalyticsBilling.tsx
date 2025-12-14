/**
 * Enterprise Analytics & Billing Dashboard
 * Usage charts, billing panel, SLA status with growth simulation
 */

"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/apiUrl";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { simulateGrowth, calculateDaysActive } from "@/lib/simulation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_USAGE === 'true';

interface AnalyticsBillingProps {
  orgId: string | null;
  userRole?: string;
}

interface DailyUsage {
  date: string;
  request_count: number;
  risk_avg: number;
  fail_rate: number;
  token_usage: number;
  latency_avg: number;
  simulated?: boolean;
}

interface BillingInfo {
  ok: boolean;
  plan: string;
  base_currency: string; // "TRY" | "USD"
  quota: number;
  request_count: number;
  overage_count: number;
  remaining_quota: number;
  monthly_cost: {
    TRY: number;
    USD: number;
  };
  price_table: {
    TRY: {
      plan_price: number;
      overage_price: number;
    };
    USD: {
      plan_price: number;
      overage_price: number;
    };
  };
}

interface SLAStatus {
  uptime: number;
  avg_latency: number;
  error_rate: number;
  fail_safe_triggers: number;
  sla_met: boolean;
  plan: string;
  alerts: any[];
}

export default function AnalyticsBilling({ orgId, userRole }: AnalyticsBillingProps) {
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [topFlags, setTopFlags] = useState<any[]>([]);
  const [providerUsage, setProviderUsage] = useState<Record<string, number>>({});
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [slaStatus, setSlaStatus] = useState<SLAStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [accessDenied, setAccessDenied] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<'TRY' | 'USD'>('TRY');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Check admin access
  useEffect(() => {
    if (userRole && userRole !== 'admin') {
      setAccessDenied(true);
    }
  }, [userRole]);

  useEffect(() => {
    if (orgId && !accessDenied) {
      loadData();
    }
  }, [orgId, selectedPeriod, accessDenied]);

  const loadData = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const API_BASE_URL = getApiUrl();
      if (!API_BASE_URL || API_BASE_URL.trim() === '') {
        console.error('[Analytics] API_BASE_URL is not configured');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token || ''}`,
        'X-Api-Key': apiKey || '',
        'x-org-id': orgId,
      };

      // Load monthly usage (for daily chart)
      const now = new Date();
      const month = now.toISOString().slice(0, 7);
      const monthlyRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/usage/monthly?month=${month}`, { headers });
      
      if (!monthlyRes.ok) {
        if (monthlyRes.status === 403) {
          console.warn('[Analytics] Access denied (403) - Admin role required');
          setAccessDenied(true);
          return;
        }
        throw new Error(`HTTP ${monthlyRes.status}: ${monthlyRes.statusText}`);
      }
      
      const monthlyData = await monthlyRes.json();
      
      if (DEBUG_MODE) {
        console.log('[Analytics] Monthly usage response:', monthlyData);
      }

      if (monthlyData.ok) {
        const realData = monthlyData.days || [];
        try {
          const daysActive = calculateDaysActive(realData);
          const simulatedData = simulateGrowth(realData, daysActive);
          
          if (DEBUG_MODE) {
            console.log('[Analytics] Real data:', realData.length, 'samples');
            console.log('[Analytics] Days active:', daysActive);
            console.log('[Analytics] Simulated data:', simulatedData);
          }
          
          setDailyUsage(simulatedData);
        } catch (simError: any) {
          console.error('[Analytics] Simulation error:', simError);
          // Fallback: use real data without simulation
          setDailyUsage(realData.map((d: DailyUsage) => ({ ...d, simulated: false })));
        }
      }

      // Load top flags
      const flagsRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/usage/top-flags?period=${selectedPeriod}`, { headers });
      if (!flagsRes.ok) {
        if (flagsRes.status === 403) {
          console.warn('[Analytics] Access denied (403) for top-flags');
          return;
        }
        throw new Error(`HTTP ${flagsRes.status}: ${flagsRes.statusText}`);
      }
      const flagsData = await flagsRes.json();
      
      if (DEBUG_MODE) {
        console.log('[Analytics] Top flags response:', flagsData);
      }
      
      if (flagsData.ok) {
        setTopFlags(flagsData.flags || []);
      }

      // Load pipeline metrics
      const metricsRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/usage/pipeline-metrics?period=${selectedPeriod}`, { headers });
      if (!metricsRes.ok) {
        if (metricsRes.status === 403) {
          console.warn('[Analytics] Access denied (403) for pipeline-metrics');
          return;
        }
        throw new Error(`HTTP ${metricsRes.status}: ${metricsRes.statusText}`);
      }
      const metricsData = await metricsRes.json();
      
      if (DEBUG_MODE) {
        console.log('[Analytics] Pipeline metrics response:', metricsData);
      }
      
      if (metricsData.ok) {
        setProviderUsage(metricsData.llm_provider_usage || {});
      }

      // Load billing
      const billingRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/billing`, { headers });
      if (!billingRes.ok) {
        if (billingRes.status === 403) {
          console.warn('[Analytics] Access denied (403) for billing');
          return;
        }
        throw new Error(`HTTP ${billingRes.status}: ${billingRes.statusText}`);
      }
      const billingData = await billingRes.json();
      
      if (DEBUG_MODE) {
        console.log('[Analytics] Billing response:', billingData);
      }
      
      if (billingData.ok) {
        setBilling(billingData);
        // Set display currency based on base_currency
        if (billingData.base_currency) {
          setDisplayCurrency(billingData.base_currency);
        }
      }

      // Load SLA status
      const slaRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/sla/status`, { headers });
      if (!slaRes.ok) {
        if (slaRes.status === 403) {
          console.warn('[Analytics] Access denied (403) for SLA status');
          return;
        }
        throw new Error(`HTTP ${slaRes.status}: ${slaRes.statusText}`);
      }
      const slaData = await slaRes.json();
      
      if (DEBUG_MODE) {
        console.log('[Analytics] SLA status response:', slaData);
      }
      
      if (slaData) {
        setSlaStatus(slaData);
      }
    } catch (err: any) {
      console.error('[Analytics] Load error:', err);
      
      // Check if token expired or access denied
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      } else if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        setAccessDenied(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlanUpgrade = async (newPlan: string) => {
    if (!orgId) return;

    try {
      const API_BASE_URL = getApiUrl();
      if (!API_BASE_URL || API_BASE_URL.trim() === '') {
        console.error('[Billing] API_BASE_URL is not configured');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/billing/plan/update?plan=${newPlan}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
        },
      });

      const data = await res.json();
      if (data.ok) {
        loadData();
        alert(`Plan ${newPlan} olarak güncellendi`);
      }
    } catch (err: any) {
      console.error('[Billing] Plan update error:', err);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!orgId) return;

    try {
      const API_BASE_URL = getApiUrl();
      if (!API_BASE_URL || API_BASE_URL.trim() === '') {
        console.error('[Billing] API_BASE_URL is not configured');
        alert('Backend URL yapılandırılmamış.');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/billing/invoice/generate`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
        },
      });

      const data = await res.json();
      
      if (DEBUG_MODE) {
        console.log('[Billing] Invoice response:', data);
      }
      
      if (data.ok) {
        // Redirect to download URL
        if (data.download_url) {
          window.open(data.download_url, '_blank');
        } else {
          // Fallback: generate text invoice
          const currencySymbol = data.currency === 'TRY' ? '₺' : '$';
          const invoiceText = `
EZA Proxy - Fatura

Fatura ID: ${data.invoice_id}
Organizasyon: ${orgId}
Dönem: ${data.period}
Para Birimi: ${data.currency}

TOPLAM: ${currencySymbol}${(data?.amount ?? 0).toFixed(2)}

Oluşturulma: ${new Date(data.generated_at).toLocaleString('tr-TR')}
`;
          
          const blob = new Blob([invoiceText], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice_${data.invoice_id}.txt`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (err: any) {
      console.error('[Billing] Invoice error:', err);
      alert('Fatura oluşturulamadı, lütfen tekrar deneyin.');
    }
  };

  // Access denied modal
  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div
          className="rounded-xl p-8 max-w-md text-center"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-xl font-bold mb-2" style={{ color: '#E5E5EA' }}>
            Erişim Reddedildi
          </h3>
          <p className="text-sm mb-6" style={{ color: '#8E8E93' }}>
            Bu alan yöneticiler içindir.
          </p>
          <button
            type="button"
            onClick={() => window.location.href = '/proxy'}
            className="px-6 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  // Chart options with dark theme
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const,
    },
    plugins: {
      legend: {
        labels: {
          color: '#E5E5EA',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#1C1C1E',
        titleColor: '#E5E5EA',
        bodyColor: '#E5E5EA',
        borderColor: '#2C2C2E',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#8E8E93',
        },
        grid: {
          color: '#2C2C2E',
        },
      },
      y: {
        ticks: {
          color: '#8E8E93',
        },
        grid: {
          color: '#2C2C2E',
        },
      },
    },
  };

  // Chart data (with null safety)
  const safeDailyUsage = dailyUsage || [];
  const dailyRequestChart = {
    labels: safeDailyUsage.map(d => {
      try {
        return new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      } catch {
        return d.date || '';
      }
    }),
    datasets: [{
      label: 'Günlük İstek Sayısı',
      data: safeDailyUsage.map(d => d.request_count || 0),
      borderColor: '#3B7CFF',
      backgroundColor: '#3B7CFF20',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
    }],
  };

  const riskAvgChart = {
    labels: safeDailyUsage.map(d => {
      try {
        return new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      } catch {
        return d.date || '';
      }
    }),
    datasets: [{
      label: 'Risk Ortalaması',
      data: safeDailyUsage.map(d => d.risk_avg || 0),
      borderColor: '#E84343',
      backgroundColor: '#E8434320',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
    }],
  };

  const failRateChart = {
    labels: safeDailyUsage.map(d => {
      try {
        return new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      } catch {
        return d.date || '';
      }
    }),
    datasets: [{
      label: 'Başarısızlık Oranı (%)',
      data: safeDailyUsage.map(d => d.fail_rate || 0),
      backgroundColor: '#FFB800',
      borderRadius: 4,
    }],
  };

  const providerChart = {
    labels: Object.keys(providerUsage).length > 0 ? Object.keys(providerUsage) : ['OpenAI'],
    datasets: [{
      data: Object.values(providerUsage).length > 0 ? Object.values(providerUsage) : [100],
      backgroundColor: ['#3B7CFF', '#22BF55', '#FF9500', '#E84343'],
    }],
  };

  const getSlaComplianceIndicator = (sla: SLAStatus | null) => {
    if (!sla) return null;
    
    const threshold = sla.plan === 'enterprise' ? { uptime: 99.9, latency: 500 } : { uptime: 99.5, latency: 800 };
    const uptimeOk = sla.uptime >= threshold.uptime;
    const latencyOk = sla.avg_latency <= threshold.latency;
    
    if (uptimeOk && latencyOk && sla.error_rate < 5) {
      return { icon: '✓', text: 'SLA Uyumlu', color: '#22BF55' };
    } else if (uptimeOk || latencyOk) {
      return { icon: '⚠', text: 'Kısmi Uyum', color: '#FFB800' };
    } else {
      return { icon: '✖', text: 'SLA İhlali', color: '#E84343' };
    }
  };

  const slaIndicator = getSlaComplianceIndicator(slaStatus);

  const getStatusColor = (value: number, threshold: number, reverse: boolean = false) => {
    const isGood = reverse ? value <= threshold : value >= threshold;
    return isGood ? '#22BF55' : value > threshold * 0.8 ? '#FFB800' : '#E84343';
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="h-48 flex items-center justify-center">
      <div className="animate-pulse space-y-2 w-full">
        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        <div className="h-32 bg-gray-700 rounded"></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{
            color: '#E5E5EA',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Kullanım İstatistikleri
        </h2>
        <p className="text-sm" style={{ color: '#8E8E93' }}>
          Gerçek zamanlı kullanım verileri ve analitik metrikler
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPeriod === period ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-75'
            }`}
            style={{
              backgroundColor: selectedPeriod === period ? '#007AFF' : '#2C2C2E',
              color: '#FFFFFF',
            }}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Usage Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Request Count */}
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3
            className="text-lg font-bold mb-4"
            style={{
              color: '#E5E5EA',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Günlük İstek Sayısı
          </h3>
          {loading ? (
            <LoadingSkeleton />
          ) : dailyUsage.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#8E8E93' }}>Veri bulunamadı</p>
            </div>
          ) : (
            <div style={{ height: '200px' }}>
              <Line data={dailyRequestChart} options={chartOptions} />
            </div>
          )}
        </div>

        {/* Risk Average */}
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3
            className="text-lg font-bold mb-4"
            style={{
              color: '#E5E5EA',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Risk Ortalaması
          </h3>
          {loading ? (
            <LoadingSkeleton />
          ) : dailyUsage.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#8E8E93' }}>Veri bulunamadı</p>
            </div>
          ) : (
            <div style={{ height: '200px' }}>
              <Line data={riskAvgChart} options={chartOptions} />
            </div>
          )}
        </div>

        {/* Fail Rate */}
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3
            className="text-lg font-bold mb-4"
            style={{
              color: '#E5E5EA',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Başarısızlık Oranı
          </h3>
          {loading ? (
            <LoadingSkeleton />
          ) : dailyUsage.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#8E8E93' }}>Veri bulunamadı</p>
            </div>
          ) : (
            <div style={{ height: '200px' }}>
              <Bar data={failRateChart} options={chartOptions} />
            </div>
          )}
        </div>

        {/* Provider Usage */}
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3
            className="text-lg font-bold mb-4"
            style={{
              color: '#E5E5EA',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            LLM Sağlayıcı Kullanımı
          </h3>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <div style={{ height: '200px' }}>
              <Doughnut
                data={providerChart}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      ...chartOptions.plugins.legend,
                      position: 'bottom' as const,
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Top Flags */}
      <div
        className="rounded-xl p-6 transition-all hover:shadow-lg"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3
          className="text-lg font-bold mb-4"
          style={{
            color: '#E5E5EA',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          En Çok Tespit Edilen Risk Bayrakları
        </h3>
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-24 bg-gray-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : topFlags.length === 0 ? (
          <p className="text-sm" style={{ color: '#8E8E93' }}>Risk bayrağı bulunamadı</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topFlags.map((flag) => {
              const severityColor = flag.avg_severity >= 0.7 ? '#E84343' : flag.avg_severity >= 0.4 ? '#FFB800' : '#3B7CFF';
              return (
                <div
                  key={flag.flag}
                  className="px-4 py-2 rounded-lg transition-transform hover:scale-105"
                  style={{
                    backgroundColor: `${severityColor}20`,
                    border: `1px solid ${severityColor}`,
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
                    {flag.flag}
                  </span>
                  <span className="text-xs ml-2" style={{ color: '#8E8E93' }}>
                    ({flag.count}x, {Math.round(flag.avg_severity * 100)}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Billing & Plan */}
      {billing && (
        <div className="space-y-6">
          {/* Section Header with Currency Toggle */}
          <div className="flex justify-between items-center">
            <h3
              className="text-lg font-bold"
              style={{
                color: '#E5E5EA',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Faturalandırma & Plan
            </h3>
            
            {/* Currency Toggle */}
            <div className="flex gap-2 bg-[#2C2C2E] rounded-lg p-1">
              <button
                type="button"
                onClick={() => setDisplayCurrency('TRY')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  displayCurrency === 'TRY' ? 'opacity-100' : 'opacity-50'
                }`}
                style={{
                  backgroundColor: displayCurrency === 'TRY' ? '#007AFF' : 'transparent',
                  color: '#FFFFFF',
                }}
              >
                TL
              </button>
              <button
                type="button"
                onClick={() => setDisplayCurrency('USD')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  displayCurrency === 'USD' ? 'opacity-100' : 'opacity-50'
                }`}
                style={{
                  backgroundColor: displayCurrency === 'USD' ? '#007AFF' : 'transparent',
                  color: '#FFFFFF',
                }}
              >
                USD
              </button>
            </div>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['free', 'pro', 'enterprise'] as const).map((planKey) => {
              const isCurrentPlan = billing?.plan === planKey;
              const priceTable = billing?.price_table?.[displayCurrency];
              const planPrice = priceTable?.plan_price ?? 0;
              const overagePrice = priceTable?.overage_price ?? 0;
              const quota = billing?.quota ?? 0;
              const currencySymbol = displayCurrency === 'TRY' ? '₺' : '$';
              
              return (
                <div
                  key={planKey}
                  className={`rounded-xl p-6 transition-all ${
                    isCurrentPlan ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: '#1C1C1E',
                    border: `1px solid ${isCurrentPlan ? '#007AFF' : '#2C2C2E'}`,
                  }}
                >
                  {isCurrentPlan && (
                    <div className="mb-2">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: '#007AFF20',
                          color: '#007AFF',
                        }}
                      >
                        CURRENT PLAN
                      </span>
                    </div>
                  )}
                  
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#E5E5EA' }}>
                    {planKey.charAt(0).toUpperCase() + planKey.slice(1)}
                  </h4>
                  
                  <div className="mb-4">
                    <p className="text-3xl font-bold mb-1" style={{ color: '#E5E5EA' }}>
                      {planPrice === 0 ? (
                        <span>{currencySymbol}0</span>
                      ) : (
                        <span>{currencySymbol}{planPrice.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      )}
                    </p>
                    <p className="text-sm" style={{ color: '#8E8E93' }}>
                      {displayCurrency === 'TRY' ? '/ ay' : '/ month'}
                    </p>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm" style={{ color: '#8E8E93' }}>
                      <span style={{ color: '#E5E5EA' }}>{quota.toLocaleString('tr-TR')}</span> istek/ay
                    </p>
                    <p className="text-sm" style={{ color: '#8E8E93' }}>
                      Overage: <span style={{ color: '#E5E5EA' }}>{currencySymbol}{(overagePrice ?? 0).toFixed(displayCurrency === 'TRY' ? 2 : 4)}</span> / istek
                    </p>
                  </div>
                  
                  {userRole === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (planKey === 'enterprise') {
                          alert('Enterprise plan için lütfen satış ekibimizle iletişime geçin.');
                        } else {
                          setSelectedPlan(planKey);
                          setShowPlanModal(true);
                        }
                      }}
                      disabled={isCurrentPlan}
                      className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                      style={{
                        background: isCurrentPlan ? '#2C2C2E' : 'linear-gradient(135deg, #007AFF 0%, #3B7CFF 100%)',
                        color: '#FFFFFF',
                      }}
                    >
                      {isCurrentPlan ? 'Mevcut Plan' : planKey === 'enterprise' ? 'Contact Sales' : `Upgrade to ${planKey.charAt(0).toUpperCase() + planKey.slice(1)}`}
                    </button>
                  ) : (
                    <div className="text-center">
                      <span
                        className="px-3 py-1 rounded text-xs"
                        style={{
                          backgroundColor: '#FFB80020',
                          color: '#FFB800',
                        }}
                      >
                        Bu alan yalnızca yöneticilere özeldir.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Usage & Quota Bar */}
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: '#1C1C1E',
              border: '1px solid #2C2C2E',
            }}
          >
            <h4 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
              Kullanım Özeti
            </h4>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2" style={{ color: '#8E8E93' }}>
                <span>Kullanım</span>
                <span>{(billing?.request_count || 0).toLocaleString('tr-TR')} / {(billing?.quota || 0).toLocaleString('tr-TR')}</span>
              </div>
              
              {/* Quota Progress Bar */}
              <div
                className="h-3 rounded-full overflow-hidden mb-2"
                style={{ backgroundColor: '#2C2C2E' }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, ((billing?.request_count || 0) / (billing?.quota || 1)) * 100)}%`,
                    backgroundColor: (() => {
                      const usagePercent = ((billing?.request_count || 0) / (billing?.quota || 1)) * 100;
                      if (usagePercent < 70) return '#22BF55';
                      if (usagePercent < 90) return '#FFB800';
                      return '#E84343';
                    })(),
                  }}
                />
              </div>
              
              {/* Quota Warnings */}
              {(() => {
                const usagePercent = ((billing?.request_count || 0) / (billing?.quota || 1)) * 100;
                if (usagePercent >= 90) {
                  return (
                    <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: '#E8434320', border: '1px solid #E84343' }}>
                      <span className="text-lg">⚠️</span>
                      <p className="text-sm" style={{ color: '#E5E5EA' }}>
                        Kota kullanımınız %90'ın üzerinde. Overage maliyetleri artıyor.
                      </p>
                    </div>
                  );
                } else if (usagePercent >= 70) {
                  return (
                    <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: '#FFB80020', border: '1px solid #FFB800' }}>
                      <span className="text-lg">⚠️</span>
                      <p className="text-sm" style={{ color: '#E5E5EA' }}>
                        Kota kullanımınız %70'i geçti. Yakında overage ücreti uygulanacak.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            
            {/* Overage Breakdown */}
            {(billing?.overage_count || 0) > 0 && (
              <div className="mt-4 p-4 rounded" style={{ backgroundColor: '#2C2C2E' }}>
                <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>
                  Bu ay <span style={{ color: '#E5E5EA', fontWeight: 'bold' }}>{(billing?.request_count || 0).toLocaleString('tr-TR')}</span> istek yaptınız.
                </p>
                <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>
                  Plan kotanız: <span style={{ color: '#E5E5EA' }}>{(billing?.quota || 0).toLocaleString('tr-TR')}</span>
                </p>
                <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>
                  Overage: <span style={{ color: '#E5E5EA', fontWeight: 'bold' }}>{(billing?.overage_count || 0).toLocaleString('tr-TR')}</span> istek
                </p>
                <p className="text-sm font-bold" style={{ color: '#E5E5EA' }}>
                  Tahmini maliyet: {displayCurrency === 'TRY' ? '₺' : '$'}{(billing?.price_table?.[displayCurrency]?.plan_price || 0).toFixed(2)} plan + {displayCurrency === 'TRY' ? '₺' : '$'}{((billing?.overage_count || 0) * (billing?.price_table?.[displayCurrency]?.overage_price || 0)).toFixed(2)} overage = {displayCurrency === 'TRY' ? '₺' : '$'}{(billing?.monthly_cost?.[displayCurrency] || 0).toFixed(2)} / ay
                </p>
              </div>
            )}
            
            {/* Download Invoice Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleDownloadInvoice}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: '#2C2C2E',
                  color: '#E5E5EA',
                }}
              >
                📄 Fatura PDF İndir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Upgrade Modal */}
      {showPlanModal && selectedPlan && billing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setShowPlanModal(false)}
        >
          <div
            className="rounded-xl p-6 max-w-md w-full mx-4"
            style={{
              backgroundColor: '#1C1C1E',
              border: '1px solid #2C2C2E',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
              Planı Güncelle
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Eski Plan</p>
                <p className="text-lg font-bold" style={{ color: '#E5E5EA' }}>
                  {billing.plan.toUpperCase()}
                </p>
              </div>
              
              <div>
                <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Yeni Plan</p>
                <p className="text-lg font-bold" style={{ color: '#007AFF' }}>
                  {selectedPlan.toUpperCase()}
                </p>
              </div>
              
              <div>
                <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Para Birimi</p>
                <p className="text-lg font-bold" style={{ color: '#E5E5EA' }}>
                  {displayCurrency}
                </p>
              </div>
              
              <div>
                <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Tahmini Yeni Aylık Maliyet</p>
                <p className="text-lg font-bold" style={{ color: '#22BF55' }}>
                  {displayCurrency === 'TRY' ? '₺' : '$'}{(billing?.price_table?.[displayCurrency]?.plan_price || 0).toFixed(2)} / ay
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: '#2C2C2E',
                  color: '#E5E5EA',
                }}
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedPlan) {
                    handlePlanUpgrade(selectedPlan);
                    setShowPlanModal(false);
                  }
                }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #3B7CFF 100%)',
                  color: '#FFFFFF',
                }}
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLA Status */}
      {slaStatus && (
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3
            className="text-lg font-bold mb-4"
            style={{
              color: '#E5E5EA',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            SLA Durumu
          </h3>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Uptime</p>
              <p
                className="text-2xl font-bold"
                style={{ color: getStatusColor(slaStatus?.uptime || 0, 99.5) }}
              >
                {(slaStatus?.uptime || 0).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Ortalama Latency</p>
              <p
                className="text-2xl font-bold"
                style={{ color: getStatusColor(slaStatus?.avg_latency || 0, 500, true) }}
              >
                {(slaStatus?.avg_latency || 0).toFixed(0)}ms
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Error Rate</p>
              <p
                className="text-2xl font-bold"
                style={{ color: getStatusColor(slaStatus?.error_rate || 0, 5, true) }}
              >
                {(slaStatus?.error_rate || 0).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Fail-Safe</p>
              <p
                className="text-2xl font-bold"
                style={{ color: (slaStatus?.fail_safe_triggers || 0) === 0 ? '#22BF55' : '#E84343' }}
              >
                {slaStatus?.fail_safe_triggers || 0}
              </p>
            </div>
          </div>

          {/* SLA Compliance Indicator */}
          {slaIndicator && (
            <div className="mb-4">
              <span
                className="px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                style={{
                  backgroundColor: `${slaIndicator.color}20`,
                  color: slaIndicator.color,
                  border: `1px solid ${slaIndicator.color}`,
                }}
              >
                <span className="text-lg">{slaIndicator.icon}</span>
                <span>{slaIndicator.text}</span>
              </span>
            </div>
          )}

          {/* Recent Alerts */}
          {slaStatus?.alerts && slaStatus.alerts.length > 0 && (
            <div>
              <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>Son Uyarılar</p>
              <div className="space-y-2">
                {slaStatus.alerts.slice(0, 5).map((alert: any) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: alert.severity === 'error' ? '#E8434320' : '#FFB80020',
                      border: `1px solid ${alert.severity === 'error' ? '#E84343' : '#FFB800'}`,
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
                      {alert.message}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#8E8E93' }}>
                      {new Date(alert.created_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
