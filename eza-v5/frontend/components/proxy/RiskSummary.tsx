/**
 * RiskSummary Component - Three-card risk overview
 */

import { AlertTriangle, Shield, Brain } from 'lucide-react';

interface RiskSummaryProps {
  inputAnalysis?: any;
  outputAnalysis?: any;
  alignment?: any;
  scoreBreakdown?: any;
}

export default function RiskSummary({ inputAnalysis, outputAnalysis, alignment, scoreBreakdown }: RiskSummaryProps) {
  if (!inputAnalysis && !outputAnalysis) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500 text-center py-4">Risk analizi sonuçları burada görünecek.</p>
        </div>
      </div>
    );
  }

  const inputRisk = inputAnalysis?.risk_level || 'low';
  const outputRisk = outputAnalysis?.risk_level || 'low';
  const alignmentLabel = alignment?.label || 'Safe';
  const finalScore = scoreBreakdown?.final_score || 0;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getGrade = (score: number) => {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    return 'D';
  };

  return (
    <div className="space-y-4">
      {/* Input Risk */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">Input Risk</h3>
            <p className="text-xs text-gray-500">
              Intent: {inputAnalysis?.intent || 'N/A'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(inputRisk)}`}>
            {inputRisk.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Output Risk */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">Output Risk</h3>
            <p className="text-xs text-gray-500">
              Flags: {outputAnalysis?.risk_flags?.length || 0}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(outputRisk)}`}>
            {outputRisk.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Final Decision */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">Final Decision</h3>
            <p className="text-xs text-gray-500">
              Alignment: {alignmentLabel}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(alignmentLabel.toLowerCase())}`}>
              {alignmentLabel}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
              {getGrade(finalScore)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

