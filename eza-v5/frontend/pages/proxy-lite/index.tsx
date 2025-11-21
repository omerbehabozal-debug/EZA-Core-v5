/**
 * Proxy-Lite Page - Audit Panel
 * Hybrid Mock + Live Backend Mode with Optimistic UI
 */

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AuthGuard from '@/components/AuthGuard';
import ProxyLiteLayout from '@/components/proxy-lite/ProxyLiteLayout';
import QuickCheckForm from '@/components/proxy-lite/QuickCheckForm';
import RiskResultCard from '@/components/proxy-lite/RiskResultCard';
import RecommendationCard from '@/components/proxy-lite/RecommendationCard';
import RiskDistributionChart from '@/components/proxy-lite/RiskDistributionChart';
import { analyzeLite } from '@/api/proxy_lite';
import { MOCK_LITE_RESULT } from '@/mock/proxy_lite';

type DataStatus = 'mock' | 'live' | 'loading';

export default function ProxyLitePage() {
  const [inputData, setInputData] = useState<{ message: string; outputText: string } | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>('mock');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // SWR configuration with fallback data
  const { data, error, isLoading: swrLoading } = useSWR(
    inputData ? ['proxy-lite-analyze', inputData.message, inputData.outputText] : null,
    () => analyzeLite(inputData!.message, inputData!.outputText),
    {
      fallbackData: MOCK_LITE_RESULT,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  // Determine status based on SWR state
  useEffect(() => {
    if (!inputData) {
      setDataStatus('mock');
      return;
    }

    if (swrLoading) {
      setDataStatus('loading');
      setIsInitialLoad(false);
      return;
    }

    if (error) {
      // Backend failed, use mock data
      setDataStatus('mock');
      setIsInitialLoad(false);
      return;
    }

    // Check if data is different from mock (live data received)
    // Compare by checking if it's the same reference or has different content
    if (data && data !== MOCK_LITE_RESULT) {
      // Additional check: compare content to ensure it's not just a reference issue
      const isMockData = 
        data.risk_level === MOCK_LITE_RESULT.risk_level &&
        data.risk_category === MOCK_LITE_RESULT.risk_category &&
        data.violated_rule_count === MOCK_LITE_RESULT.violated_rule_count;
      
      if (!isMockData) {
        setDataStatus('live');
        setIsInitialLoad(false);
      } else {
        setDataStatus('mock');
        setIsInitialLoad(false);
      }
    } else {
      setDataStatus('mock');
      setIsInitialLoad(false);
    }
  }, [data, error, swrLoading, inputData]);

  const handleSubmit = (message: string, outputText: string) => {
    setInputData({ message, outputText });
    setDataStatus('loading');
    setIsInitialLoad(true);
  };

  // Always show data (fallback to mock if needed)
  // Show result only when form is submitted (inputData exists)
  const result = inputData ? (data || MOCK_LITE_RESULT) : null;
  const isLoading = dataStatus === 'loading';

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
            {/* Status Badge - Only show when there's input data */}
            {inputData && result && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                {dataStatus === 'live' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Live data loaded
                  </p>
                )}
                {dataStatus === 'mock' && !isInitialLoad && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    Showing preview data (live backend not reachable)
                  </p>
                )}
                {dataStatus === 'loading' && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    Loading live data...
                  </p>
                )}
              </div>
            )}

            {/* Risk Result - Show immediately with mock data when form is submitted */}
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
