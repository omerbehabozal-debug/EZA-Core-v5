/**
 * Analytics & Billing Component
 * Usage charts, billing panel, SLA status
 */

"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/api/config";
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
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsBillingProps {
  orgId: string | null;
}

interface DailyUsage {
  date: string;
  request_count: number;
  risk_avg: number;
  fail_rate: number;
  token_usage: number;
  latency_avg: number;
}

interface BillingInfo {
  plan: string;
  current_usage: number;
  remaining_quota: number;
  estimated_cost: number;
  billing: {
    base_quota: number;
    monthly_price: number;
    overage_price: number;
  };
}

interface SLAStatus {
  uptime: number;
  avg_latency: number;
  error_rate: number;
  fail_safe_triggers: number;
  sla_met: boolean;
  alerts: any[];
}

export default function AnalyticsBilling({ orgId }: AnalyticsBillingProps) {
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [topFlags, setTopFlags] = useState<any[]>([]);
  const [providerUsage, setProviderUsage] = useState<Record<string, number>>({});
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [slaStatus, setSlaStatus] = useState<SLAStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId, selectedPeriod]);

  const loadData = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'X-Api-Key': apiKey || '',
      };

      // Load monthly usage (for daily chart)
      const now = new Date();
      const month = now.toISOString().slice(0, 7);
      const monthlyRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/usage/monthly?month=${month}`, { headers });
      const monthlyData = await monthlyRes.json();
      if (monthlyData.ok) {
        setDailyUsage(monthlyData.days || []);
      }

      // Load top flags
      const flagsRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/usage/top-flags?period=${selectedPeriod}`, { headers });
      const flagsData = await flagsRes.json();
      if (flagsData.ok) {
        setTopFlags(flagsData.flags || []);
      }

      // Load pipeline metrics
      const metricsRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/usage/pipeline-metrics?period=${selectedPeriod}`, { headers });
      const metricsData = await metricsRes.json();
      if (metricsData.ok) {
        setProviderUsage(metricsData.llm_provider_usage || {});
      }

      // Load billing
      const billingRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/billing`, { headers });
      const billingData = await billingRes.json();
      if (billingData.ok) {
        setBilling(billingData);
      }

      // Load SLA status
      const slaRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/sla/status`, { headers });
      const slaData = await slaRes.json();
      if (slaData) {
        setSlaStatus(slaData);
      }
    } catch (err: any) {
      console.error('[Analytics] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanUpgrade = async (newPlan: string) => {
    if (!orgId) return;

    try {
      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/billing/plan/update?plan=${newPlan}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
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
      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/billing/invoice/generate`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
        },
      });

      const data = await res.json();
      if (data.ok) {
        // Generate simple invoice text
        const invoiceText = `
EZA Proxy - Fatura

Fatura ID: ${data.invoice_id}
Organizasyon: ${orgId}
Dönem: ${data.period}

Temel Maliyet: $${data.base_cost.toFixed(2)}
Aşım Maliyeti: $${data.overage_cost.toFixed(2)}
TOPLAM: $${data.total_cost.toFixed(2)}

İstek Sayısı: ${data.request_count}
Oluşturulma: ${new Date(data.generated_at).toLocaleString('tr-TR')}
`;
        
        const blob = new Blob([invoiceText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${data.invoice_id}.txt`;
        a.click();
      }
    } catch (err: any) {
      console.error('[Billing] Invoice error:', err);
    }
  };

  // Chart data
  const dailyRequestChart = {
    labels: dailyUsage.map(d => new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })),
    datasets: [{
      label: 'Günlük İstek Sayısı',
      data: dailyUsage.map(d => d.request_count),
      borderColor: '#007AFF',
      backgroundColor: '#007AFF20',
      tension: 0.4,
    }],
  };

  const riskAvgChart = {
    labels: dailyUsage.map(d => new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })),
    datasets: [{
      label: 'Risk Ortalaması',
      data: dailyUsage.map(d => d.risk_avg),
      borderColor: '#E84343',
      backgroundColor: '#E8434320',
      tension: 0.4,
    }],
  };

  const failRateChart = {
    labels: dailyUsage.map(d => new Date(d.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })),
    datasets: [{
      label: 'Başarısızlık Oranı (%)',
      data: dailyUsage.map(d => d.fail_rate),
      backgroundColor: '#FF9500',
    }],
  };

  const providerChart = {
    labels: Object.keys(providerUsage),
    datasets: [{
      data: Object.values(providerUsage),
      backgroundColor: ['#007AFF', '#22BF55', '#FF9500'],
    }],
  };

  const getSlaColor = (slaMet: boolean) => {
    return slaMet ? '#22BF55' : '#E84343';
  };

  const getStatusColor = (value: number, threshold: number, reverse: boolean = false) => {
    const isGood = reverse ? value <= threshold : value >= threshold;
    return isGood ? '#22BF55' : value > threshold * 0.8 ? '#FFB800' : '#E84343';
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-opacity ${
              selectedPeriod === period ? 'opacity-100' : 'opacity-50'
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
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Günlük İstek Sayısı
          </h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
            </div>
          ) : (
            <Line data={dailyRequestChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#E5E5EA' } } }, scales: { x: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } }, y: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } } } }} />
          )}
        </div>

        {/* Risk Average */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Risk Ortalaması
          </h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
            </div>
          ) : (
            <Line data={riskAvgChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#E5E5EA' } } }, scales: { x: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } }, y: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } } } }} />
          )}
        </div>

        {/* Fail Rate */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Başarısızlık Oranı
          </h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
            </div>
          ) : (
            <Bar data={failRateChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#E5E5EA' } } }, scales: { x: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } }, y: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } } } }} />
          )}
        </div>

        {/* Provider Usage */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            LLM Sağlayıcı Kullanımı
          </h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
            </div>
          ) : (
            <Doughnut data={providerChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#E5E5EA' }, position: 'bottom' } } }} />
          )}
        </div>
      </div>

      {/* Top Flags */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
          En Çok Tespit Edilen Risk Bayrakları
        </h3>
        <div className="flex flex-wrap gap-2">
          {topFlags.map((flag) => (
            <div
              key={flag.flag}
              className="px-4 py-2 rounded-lg"
              style={{
                backgroundColor: flag.avg_severity >= 0.7 ? '#E8434320' : flag.avg_severity >= 0.4 ? '#FF950020' : '#22BF5520',
                border: `1px solid ${flag.avg_severity >= 0.7 ? '#E84343' : flag.avg_severity >= 0.4 ? '#FF9500' : '#22BF55'}`,
              }}
            >
              <span className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
                {flag.flag}
              </span>
              <span className="text-xs ml-2" style={{ color: '#8E8E93' }}>
                ({flag.count}x, {Math.round(flag.avg_severity * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Billing Panel */}
      {billing && (
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Faturalandırma
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Mevcut Plan</p>
              <p className="text-lg font-bold" style={{ color: '#E5E5EA' }}>
                {billing.plan.toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Kullanım</p>
              <p className="text-lg font-bold" style={{ color: '#E5E5EA' }}>
                {billing.current_usage} / {billing.billing.base_quota}
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Tahmini Maliyet</p>
              <p className="text-lg font-bold" style={{ color: '#007AFF' }}>
                ${billing.estimated_cost.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Kalan Kota</p>
              <p className="text-lg font-bold" style={{ color: getStatusColor(billing.remaining_quota, billing.billing.base_quota * 0.2) }}>
                {billing.remaining_quota}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handlePlanUpgrade('pro')}
              disabled={billing.plan === 'pro'}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: billing.plan === 'pro' ? '#2C2C2E' : '#007AFF',
                color: '#FFFFFF',
              }}
            >
              Pro'ya Yükselt
            </button>
            <button
              type="button"
              onClick={() => handlePlanUpgrade('enterprise')}
              disabled={billing.plan === 'enterprise'}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: billing.plan === 'enterprise' ? '#2C2C2E' : '#007AFF',
                color: '#FFFFFF',
              }}
            >
              Enterprise'a Yükselt
            </button>
            <button
              type="button"
              onClick={handleDownloadInvoice}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: '#2C2C2E',
                color: '#E5E5EA',
              }}
            >
              Fatura PDF İndir
            </button>
          </div>
        </div>
      )}

      {/* SLA Status */}
      {slaStatus && (
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            SLA Durumu
          </h3>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Uptime</p>
              <p
                className="text-2xl font-bold"
                style={{ color: getSlaColor(slaStatus.sla_met) }}
              >
                {slaStatus.uptime.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Ortalama Latency</p>
              <p
                className="text-2xl font-bold"
                style={{ color: getStatusColor(slaStatus.avg_latency, 500, true) }}
              >
                {slaStatus.avg_latency.toFixed(0)}ms
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Error Rate</p>
              <p
                className="text-2xl font-bold"
                style={{ color: getStatusColor(slaStatus.error_rate, 5, true) }}
              >
                {slaStatus.error_rate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Fail-Safe</p>
              <p
                className="text-2xl font-bold"
                style={{ color: slaStatus.fail_safe_triggers === 0 ? '#22BF55' : '#E84343' }}
              >
                {slaStatus.fail_safe_triggers}
              </p>
            </div>
          </div>

          {/* SLA Badge */}
          <div className="mb-4">
            <span
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: `${getSlaColor(slaStatus.sla_met)}20`,
                color: getSlaColor(slaStatus.sla_met),
                border: `1px solid ${getSlaColor(slaStatus.sla_met)}`,
              }}
            >
              {slaStatus.sla_met ? '✓ SLA Uyumlu' : '⚠ SLA İhlali'}
            </span>
          </div>

          {/* Recent Alerts */}
          {slaStatus.alerts && slaStatus.alerts.length > 0 && (
            <div>
              <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>Son Uyarılar</p>
              <div className="space-y-2">
                {slaStatus.alerts.slice(0, 5).map((alert: any) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg"
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

