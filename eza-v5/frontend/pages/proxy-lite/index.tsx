/**
 * Proxy-Lite Page - Audit Panel
 */

import { useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import ProxyLiteLayout from '@/components/proxy-lite/ProxyLiteLayout';
import QuickCheckForm from '@/components/proxy-lite/QuickCheckForm';
import RiskResultCard from '@/components/proxy-lite/RiskResultCard';
import RecommendationCard from '@/components/proxy-lite/RecommendationCard';
import RiskDistributionChart from '@/components/proxy-lite/RiskDistributionChart';
import apiClient from '@/lib/api';

export default function ProxyLitePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (message: string, outputText: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.post('/api/proxy-lite/report', {
        message,
        output_text: outputText,
      });

      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Teknik bir sorun oluştu, lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard allowedRoles={['institution_auditor', 'admin']}>
      <ProxyLiteLayout>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Form */}
          <div>
            <QuickCheckForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Risk Result */}
            {result && (
              <>
                <RiskResultCard
                  riskLevel={result.risk_level}
                  riskCategory={result.risk_category}
                  violatedRuleCount={result.violated_rule_count}
                  summary={result.summary}
                />

                <RecommendationCard recommendation={result.recommendation} />
              </>
            )}

            {/* Risk Distribution Chart */}
            <RiskDistributionChart />
          </div>
        </div>
      </ProxyLiteLayout>
    </AuthGuard>
  );
}
