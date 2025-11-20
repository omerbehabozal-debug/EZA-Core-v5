/**
 * Proxy Lab Page - EZA AR-GE Panel
 */

import { useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import ProxyLayout from '@/components/proxy/ProxyLayout';
import RequestPanel from '@/components/proxy/RequestPanel';
import OutputCompare from '@/components/proxy/OutputCompare';
import RiskSummary from '@/components/proxy/RiskSummary';
import ScoreCards from '@/components/proxy/ScoreCards';
import RiskHeatmap from '@/components/proxy/RiskHeatmap';
import AlignmentGraph from '@/components/proxy/AlignmentGraph';
import EngineTabs from '@/components/proxy/EngineTabs';
import apiClient from '@/lib/api';

export default function ProxyPage() {
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (message: string, model: string, depth: 'fast' | 'deep') => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await apiClient.post('/api/proxy/eval', {
        message,
        model,
        depth,
      });

      if (res.data.ok === false) {
        setError(res.data.error?.message || 'Bir hata oluştu');
      } else {
        setResponse(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Teknik bir sorun oluştu, lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard allowedRoles={['eza_internal', 'admin']}>
      <ProxyLayout mode={mode} onModeChange={setMode}>
        {/* Request Panel */}
        <RequestPanel onSubmit={handleSubmit} isLoading={isLoading} mode={mode} />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {response && (
          <div className="space-y-6">
            {/* Output Compare - Full Width */}
            <OutputCompare
              rawOutput={response.raw_model_output}
              safeOutput={response.safe_output}
            />

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <RiskSummary
                  inputAnalysis={response.input_analysis}
                  outputAnalysis={response.output_analysis}
                  alignment={response.alignment}
                  scoreBreakdown={response.score_breakdown}
                />
                <ScoreCards
                  scoreBreakdown={response.score_breakdown}
                  alignment={response.alignment}
                  deception={response.deception}
                  psychPressure={response.psych_pressure}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <RiskHeatmap
                  inputAnalysis={response.input_analysis}
                  outputAnalysis={response.output_analysis}
                  deception={response.deception}
                  psychPressure={response.psych_pressure}
                  legalRisk={response.legal_risk}
                />
                <AlignmentGraph
                  alignment={response.alignment}
                  scoreBreakdown={response.score_breakdown}
                  deception={response.deception}
                />
              </div>
            </div>

            {/* Engine Tabs - Full Width */}
            {mode === 'deep' && (
              <EngineTabs
                deception={response.deception}
                psychPressure={response.psych_pressure}
                legalRisk={response.legal_risk}
                rawResponse={response}
              />
            )}
          </div>
        )}
      </ProxyLayout>
    </AuthGuard>
  );
}
