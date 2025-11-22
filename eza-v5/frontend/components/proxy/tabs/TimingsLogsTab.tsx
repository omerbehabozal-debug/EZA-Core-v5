/**
 * Timings & Logs Tab
 */

'use client';

import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

interface TimingsLogsTabProps {
  data: FullPipelineDebugResponse;
}

export default function TimingsLogsTab({ data }: TimingsLogsTabProps) {
  const timings = data.timings || {};
  const logs = data.raw?.all_logs || [];

  return (
    <div className="space-y-6">
      {/* Total Time */}
      <Card>
        <CardHeader>
          <CardTitle>Total Execution Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">
            {timings.total_ms?.toFixed(2) || 'N/A'} ms
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {(timings.total_ms ? timings.total_ms / 1000 : 0).toFixed(3)} seconds
          </div>
        </CardContent>
      </Card>

      {/* Model Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Model Call Timings</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(timings.model_calls || {}).length === 0 ? (
            <p className="text-sm text-gray-500">No model calls</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(timings.model_calls || {}).map(([model, time]) => (
                <div key={model} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-900">{model}</span>
                  <span className="text-sm text-gray-600">{time} ms</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Timings */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Timings</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(timings.analysis_ms || {}).length === 0 ? (
            <p className="text-sm text-gray-500">No analysis timings</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(timings.analysis_ms || {}).map(([analysis, time]) => (
                <div key={analysis} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-900">{analysis}</span>
                  <span className="text-sm text-gray-600">{time} ms</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">No logs available</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs font-mono"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{log.step || 'Unknown'}</span>
                      {log.ms !== undefined && (
                        <span className="ml-2 text-gray-600">{log.ms} ms</span>
                      )}
                      {log.error && (
                        <span className="ml-2 text-red-600">Error: {log.error}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

