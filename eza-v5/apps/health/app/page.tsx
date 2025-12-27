/**
 * Health Dashboard
 * 
 * High-level overview of clinical AI ecosystem.
 * Health-focused metrics - NO medical content display.
 */

'use client';

import { useEffect, useState } from 'react';
import { HealthLayout } from '@/components/HealthLayout';
import { apiClient, HealthDashboardMetrics } from '@/lib/api-client';
import { useHealthAuth } from '@/lib/auth-guard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function DashboardPage() {
  const { isAuthorized, loading } = useHealthAuth();
  const [metrics, setMetrics] = useState<HealthDashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const response = await apiClient.get<HealthDashboardMetrics>('/api/proxy/health/dashboard?days=7');
        
        if (response.ok) {
          setMetrics(response);
        }
      } catch (err) {
        console.error('Error fetching Health dashboard:', err);
        setError(err instanceof Error ? err.message : 'Metrikler yüklenirken hata oluştu');
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchMetrics();
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
      <HealthLayout>
        <div className="text-center py-12">
          <div className="text-lg">Metrikler yükleniyor...</div>
        </div>
      </HealthLayout>
    );
  }

  if (error) {
    return (
      <HealthLayout>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">Hata: {error}</p>
        </div>
      </HealthLayout>
    );
  }

  if (!metrics || !metrics.metrics) {
    return (
      <HealthLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Metrik mevcut değil</p>
        </div>
      </HealthLayout>
    );
  }

  const m = metrics.metrics;

  return (
    <HealthLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          Sağlık Kontrol Paneli
        </h1>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Aktif Sağlık Kurumları</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.active_health_institutions}
            </p>
            <p className="text-xs text-gray-500 mt-1">AI kullanan sağlık kurumları</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Gözlemlenen Klinik AI Sistemleri</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.clinical_ai_systems_observed}
            </p>
            <p className="text-xs text-gray-500 mt-1">Farklı sistem türleri</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Fail-Safe Tetiklenme Sayısı</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {m.fail_safe_trigger_count}
            </p>
            <p className="text-xs text-gray-500 mt-1">Güvenlik mekanizması</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Yüksek Riskli Klinik Olaylar</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {m.high_risk_clinical_events}
            </p>
            <p className="text-xs text-gray-500 mt-1">Risk olayları</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Ortalama Etik İndeks (Sağlık)</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.average_ethical_index_health.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">0-100 ölçeği</p>
          </div>
        </div>

        {/* Fail-Safe Frequency Over Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Fail-Safe Tetiklenme Sıklığı (Zaman İçinde)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={m.fail_safe_frequency}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Risk Dağılımı
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {m.risk_distribution.high}
              </div>
              <div className="text-sm text-gray-600 mt-1">Yüksek Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {m.risk_distribution.medium}
              </div>
              <div className="text-sm text-gray-600 mt-1">Orta Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {m.risk_distribution.low}
              </div>
              <div className="text-sm text-gray-600 mt-1">Düşük Risk</div>
            </div>
          </div>
        </div>

        {/* Clinical Risk Categories */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Klinik Risk Kategorileri
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={Object.entries(m.clinical_risk_categories).map(([name, value]) => ({ name, value }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#065f46" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </HealthLayout>
  );
}

