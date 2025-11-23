/**
 * Input & Routing Tab
 */

'use client';

import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

interface InputRoutingTabProps {
  data: FullPipelineDebugResponse;
}

export default function InputRoutingTab({ data }: InputRoutingTabProps) {
  return (
    <div className="space-y-6">
      {/* Raw Input */}
      <Card>
        <CardHeader>
          <CardTitle>Raw Input</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto border border-gray-200">
            {data.input.raw_text}
          </pre>
        </CardContent>
      </Card>

      {/* Normalized Input */}
      <Card>
        <CardHeader>
          <CardTitle>Normalized Input</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto border border-gray-200">
            {data.input.normalized_text}
          </pre>
        </CardContent>
      </Card>

      {/* Input Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Input Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Language:</span>
              <span className="font-medium">{data.input.language || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tokens:</span>
              <span className="font-medium">{data.input.tokens || 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Router Decision */}
      <Card>
        <CardHeader>
          <CardTitle>Router Decision</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-600">Selected Provider:</span>
              <span className="ml-2 text-sm text-gray-900">
                {data.models.router_decision?.selected_provider || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Selected Model:</span>
              <span className="ml-2 text-sm text-gray-900">
                {data.models.router_decision?.selected_model || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Reason:</span>
              <span className="ml-2 text-sm text-gray-900">
                {data.models.router_decision?.reason || 'N/A'}
              </span>
            </div>
            <div className="mt-4">
              <span className="text-sm font-medium text-gray-600">Used Models:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.models.used_models?.map((model, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Router Decision Details */}
      {data.models.router_decision && (
        <Card>
          <CardHeader>
            <CardTitle>Router Decision (Raw)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto border border-gray-200">
              {JSON.stringify(data.models.router_decision, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

