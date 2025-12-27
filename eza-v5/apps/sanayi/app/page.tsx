/**
 * Sanayi Bakanlığı Dashboard
 * 
 * High-level overview of the national AI ecosystem.
 * Ecosystem-focused metrics - NO content display.
 */

'use client';

import { useEffect, useState } from 'react';
import { SanayiLayout } from '@/components/SanayiLayout';
import { apiClient, SanayiDashboardMetrics } from '@/lib/api-client';
import { useSanayiAuth } from '@/lib/auth-guard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function DashboardPage() {
  const { isAuthorized, loading } = useSanayiAuth();
  const [metrics, setMetrics] = useState<SanayiDashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const response = await apiClient.get<SanayiDashboardMetrics>('/api/proxy/sanayi/dashboard?days=7');
        
        if (response.ok) {
          setMetrics(response);
        }
      } catch (err) {
        console.error('Error fetching Sanayi dashboard:', err);
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
      <SanayiLayout>
        <div className="text-center py-12">
          <div className="text-lg">Metrikler yükleniyor...</div>
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

  if (!metrics || !metrics.metrics) {
    return (
      <SanayiLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Metrik mevcut değil</p>
        </div>
      </SanayiLayout>
    );
  }

  const m = metrics.metrics;

  // Model dependency pie chart data
  const modelDependencyData = Object.entries(m.model_dependency_breakdown).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#065f46', '#059669', '#10b981', '#34d399', '#6ee7b7'];

  return (
    <SanayiLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          Bakanlık Kontrol Paneli
        </h1>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Aktif AI Şirketleri</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.active_ai_companies}
            </p>
            <p className="text-xs text-gray-500 mt-1">Gözlemlenen şirketler</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Gözlemlenen AI Sistemleri</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.observed_ai_systems}
            </p>
            <p className="text-xs text-gray-500 mt-1">Farklı sistem türleri</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Günlük AI Aktivite Hacmi</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.daily_ai_activity_volume.total.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Toplam aktivite</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Ortalama Etik Olgunluk İndeksi</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.average_ethical_maturity_index.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">0-100 ölçeği</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Yüksek Riskli AI Sistem Oranı</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {m.high_risk_ai_system_ratio.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Risk oranı</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Harici Model Bağımlılık Oranı</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {m.external_model_dependency_rate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Harici sağlayıcı</p>
          </div>
        </div>

        {/* Daily / Monthly AI Usage Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Günlük / Aylık AI Kullanım Trendi
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={m.daily_activity_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#065f46" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Distribution Across AI Systems */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            AI Sistemleri Arasında Risk Dağılımı
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

        {/* Ethical Index Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Etik İndeks Trendi (Ekosistem Ortalaması)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={m.ethical_index_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="average_ethical_index" stroke="#059669" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Model Dependency Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Model Bağımlılık Dağılımı
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={modelDependencyData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {modelDependencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {Object.entries(m.model_dependency_breakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([provider, count]) => (
                  <div key={provider} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">{provider}</span>
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 italic">
            Bu veriler bilgilendirme amaçlıdır, değerlendirme amaçlı değildir.
          </p>
        </div>
      </div>
    </SanayiLayout>
  );
}

