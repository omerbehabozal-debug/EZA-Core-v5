/**
 * Overview Tab - Summary cards and key metrics
 */

'use client';

import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { getRiskLevelColor } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

interface OverviewTabProps {
  data: FullPipelineDebugResponse;
}

export default function OverviewTab({ data }: OverviewTabProps) {
  const ezaScore = data.analysis.eza_score?.final_score || 0;
  const breakdown = data.analysis.eza_score?.breakdown || {};
  const inputRisk = breakdown.input_risk || 0;
  const outputRisk = breakdown.output_risk || 0;
  const alignmentScore = breakdown.alignment_score || 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Risk Level</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`inline-block px-3 py-1 text-sm font-semibold rounded capitalize ${getRiskLevelColor(
                data.flags.risk_level
              )}`}
            >
              {data.flags.risk_level}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">EZA Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{ezaScore.toFixed(0)}</div>
            <div className="text-xs text-gray-500 mt-1">out of 100</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Route / Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-gray-900">{data.flags.route}</div>
            <div className="text-xs text-gray-500 mt-1">{data.flags.safety_level}</div>
          </CardContent>
        </Card>
      </div>

      {/* Request Info */}
      <Card>
        <CardHeader>
          <CardTitle>Request Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Request ID:</span>
            <span className="font-mono text-gray-900">{data.request_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Timestamp:</span>
            <span className="text-gray-900">{formatDate(data.timestamp)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Input Risk</span>
                <span className="font-medium">{(inputRisk * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${inputRisk * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Output Risk</span>
                <span className="font-medium">{(outputRisk * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full"
                  style={{ width: `${outputRisk * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Alignment Score</span>
                <span className="font-medium">{alignmentScore.toFixed(1)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${alignmentScore}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {data.analysis.alignment_result?.label && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              {data.analysis.alignment_result.label}: {data.analysis.alignment_result.verdict}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

