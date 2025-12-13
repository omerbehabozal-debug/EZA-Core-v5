/**
 * Safety Analysis Tab
 */

'use client';

import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

interface SafetyAnalysisTabProps {
  data: FullPipelineDebugResponse;
}

export default function SafetyAnalysisTab({ data }: SafetyAnalysisTabProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Input Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Input Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-600">Risk Score:</span>
              <span className="ml-2 font-medium">
                {(data.analysis.input_analysis?.risk_score || 0) * 100}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Risk Level:</span>
              <span className="ml-2 font-medium capitalize">
                {data.analysis.input_analysis?.risk_level || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Intent:</span>
              <span className="ml-2 font-medium">
                {data.analysis.input_analysis?.intent || 'N/A'}
              </span>
            </div>
            {data.analysis.input_analysis?.risk_flags && (
              <div>
                <span className="text-gray-600">Risk Flags:</span>
                <ul className="mt-1 list-disc list-inside">
                  {data.analysis.input_analysis.risk_flags.map((flag: string, idx: number) => (
                    <li key={idx} className="text-gray-700">{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <details className="mt-4">
            <summary className="text-sm text-blue-600 cursor-pointer">View Raw Data</summary>
            <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.analysis.input_analysis, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      {/* Output Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Output Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-600">Risk Score:</span>
              <span className="ml-2 font-medium">
                {(data.analysis.output_analysis?.risk_score || 0) * 100}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Risk Level:</span>
              <span className="ml-2 font-medium capitalize">
                {data.analysis.output_analysis?.risk_level || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Quality Score:</span>
              <span className="ml-2 font-medium">
                {data.analysis.output_analysis?.quality_score || 'N/A'}
              </span>
            </div>
            {data.analysis.output_analysis?.risk_flags && (
              <div>
                <span className="text-gray-600">Risk Flags:</span>
                <ul className="mt-1 list-disc list-inside">
                  {data.analysis.output_analysis.risk_flags.map((flag: string, idx: number) => (
                    <li key={idx} className="text-gray-700">{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <details className="mt-4">
            <summary className="text-sm text-blue-600 cursor-pointer">View Raw Data</summary>
            <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.analysis.output_analysis, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      {/* Alignment Result */}
      <Card>
        <CardHeader>
          <CardTitle>Alignment Result</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-600">Alignment Score:</span>
              <span className="ml-2 font-medium">
                {data.analysis.alignment_result?.alignment_score || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Verdict:</span>
              <span className="ml-2 font-medium capitalize">
                {data.analysis.alignment_result?.verdict || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Label:</span>
              <span className="ml-2 font-medium">
                {data.analysis.alignment_result?.label || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Risk Delta:</span>
              <span className="ml-2 font-medium">
                {data.analysis.alignment_result?.risk_delta?.toFixed(3) || 'N/A'}
              </span>
            </div>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-blue-600 cursor-pointer">View Raw Data</summary>
            <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.analysis.alignment_result, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      {/* EZA Score */}
      <Card>
        <CardHeader>
          <CardTitle>EZA Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-600">Final Score:</span>
              <span className="ml-2 font-medium text-lg">
                {data.analysis.eza_score?.final_score?.toFixed(1) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Safety Level:</span>
              <span className="ml-2 font-medium capitalize">
                {data.analysis.eza_score?.safety_level || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Confidence:</span>
              <span className="ml-2 font-medium">
                {data.analysis.eza_score?.confidence?.toFixed(3) || 'N/A'}
              </span>
            </div>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-blue-600 cursor-pointer">View Raw Data</summary>
            <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.analysis.eza_score, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>

      {/* Deep Analysis Results */}
      {data.analysis.deception && (
        <Card>
          <CardHeader>
            <CardTitle>Deception Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.analysis.deception, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {data.analysis.psychological_pressure && (
        <Card>
          <CardHeader>
            <CardTitle>Psychological Pressure</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.analysis.psychological_pressure, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {data.analysis.legal_risk && (
        <Card>
          <CardHeader>
            <CardTitle>Legal Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.analysis.legal_risk, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

