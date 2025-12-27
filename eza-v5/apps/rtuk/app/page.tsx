/**
 * RTÜK Dashboard
 * 
 * High-level daily operational overview for RTÜK.
 * Media-focused metrics only - NO content display.
 */

'use client';

import { useEffect, useState } from 'react';
import { RTUKLayout } from '@/components/RTUKLayout';
import { apiClient, RTUKDashboardMetrics } from '@/lib/api-client';
import { useRTUKAuth } from '@/lib/auth-guard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function DashboardPage() {
  const { isAuthorized, loading } = useRTUKAuth();
  const [metrics, setMetrics] = useState<RTUKDashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized || loading) return;

    const fetchMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const response = await apiClient.get<RTUKDashboardMetrics>('/api/proxy/rtuk/dashboard?days=7');
        
        if (response.ok) {
          setMetrics(response);
        }
      } catch (err) {
        console.error('Error fetching RTÜK dashboard:', err);
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
      <RTUKLayout>
        <div className="text-center py-12">
          <div className="text-lg">Metrikler yükleniyor...</div>
        </div>
      </RTUKLayout>
    );
  }

  if (error) {
    return (
      <RTUKLayout>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">Hata: {error}</p>
        </div>
      </RTUKLayout>
    );
  }

  if (!metrics || !metrics.metrics) {
    return (
      <RTUKLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Metrik mevcut değil</p>
        </div>
      </RTUKLayout>
    );
  }

  const m = metrics.metrics;

  return (
    <RTUKLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900" translate="no">
          RTÜK Kontrol Paneli
        </h1>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Aktif Medya Organizasyonları</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.active_media_organizations}
            </p>
            <p className="text-xs text-gray-500 mt-1">AI kullanan medya kuruluşları</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">AI Destekli İçerik Hacmi</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.ai_content_volume.total.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Toplam içerik üretimi</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Yüksek Riskli Medya Çıktıları</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {m.high_risk_outputs.count}
            </p>
            <p className="text-xs text-gray-500 mt-1">%{m.high_risk_outputs.percentage}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Kamu Etki Risk İndeksi</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {m.public_impact_risk_index.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 mt-1">0-100 ölçeği</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Tekrarlayan Risk Organizasyonları</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {m.repeated_risk_organizations}
            </p>
            <p className="text-xs text-gray-500 mt-1">3+ yüksek risk olayı</p>
          </div>
        </div>

        {/* Daily AI Media Activity Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Günlük AI Medya Aktivite Trendi
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={m.daily_activity_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#1e3a8a" strokeWidth={2} />
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

        {/* Top Risk Categories */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Baskın Risk Kategorileri
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={Object.entries(m.top_risk_categories).map(([name, value]) => ({ name, value }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1e3a8a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </RTUKLayout>
  );
}

