/**
 * Regulator Dashboard
 * 
 * Aggregate metrics only - NO content display
 */

'use client';

import { useEffect, useState } from 'react';
import { RegulatorLayout } from '@/components/RegulatorLayout';
import { InfoTooltip } from '@/components/InfoTooltip';
import { apiClient, AuditLogEntry } from '@/lib/api-client';
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

export default function DashboardPage() {
  const { isAuthorized, loading } = useRegulatorAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error('Failed to fetch audit logs');
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
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchMetrics();
  }, [isAuthorized, loading]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (loadingMetrics) {
    return (
      <RegulatorLayout>
        <div className="text-center py-12">
          <div className="text-lg">Loading metrics...</div>
        </div>
      </RegulatorLayout>
    );
  }

  if (error) {
    return (
      <RegulatorLayout>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">
            Error loading metrics: {error}
          </p>
          <p className="text-sm text-red-600 mt-2">
            If this metric is not exposed by the backend, it will not be available.
          </p>
        </div>
      </RegulatorLayout>
    );
  }

  if (!metrics) {
    return (
      <RegulatorLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">No metrics available</p>
        </div>
      </RegulatorLayout>
    );
  }

  return (
    <RegulatorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          Kontrol Paneli
          <InfoTooltip text="Bu ekran, sistem genelindeki analiz hacmini ve risk dağılımını özetler. İçerik veya bireysel analiz detayları gösterilmez." />
        </h1>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Analyses</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics.totalAnalyses.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
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
            <h3 className="text-sm font-medium text-gray-500">Active Policy Sets</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics.activePolicySets}
            </p>
            <p className="text-xs text-gray-500 mt-1">Unique policy sets</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">System Flags</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics.systemFlags}
            </p>
            <p className="text-xs text-gray-500 mt-1">Unique flag types</p>
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
              <div className="text-sm text-gray-600 mt-1">High Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {metrics.riskDistribution.medium}
              </div>
              <div className="text-sm text-gray-600 mt-1">Medium Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics.riskDistribution.low}
              </div>
              <div className="text-sm text-gray-600 mt-1">Low Risk</div>
            </div>
          </div>
        </div>
      </div>
    </RegulatorLayout>
  );
}

