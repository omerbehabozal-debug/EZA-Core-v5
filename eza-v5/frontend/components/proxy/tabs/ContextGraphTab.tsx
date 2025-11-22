/**
 * Context Graph Tab
 */

'use client';

import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

interface ContextGraphTabProps {
  data: FullPipelineDebugResponse;
}

export default function ContextGraphTab({ data }: ContextGraphTabProps) {
  const graph = data.analysis.context_graph;

  if (!graph) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-gray-500">No context graph data available</p>
        </CardContent>
      </Card>
    );
  }

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  return (
    <div className="space-y-6">
      {/* Nodes */}
      <Card>
        <CardHeader>
          <CardTitle>Nodes ({nodes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {nodes.length === 0 ? (
              <p className="text-sm text-gray-500">No nodes</p>
            ) : (
              nodes.map((node: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {node.id || `Node ${idx + 1}`}
                      </div>
                      {node.label && (
                        <div className="text-gray-600 mt-1">{node.label}</div>
                      )}
                      {node.type && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          {node.type}
                        </span>
                      )}
                      {node.risk !== undefined && (
                        <span className="ml-2 inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                          Risk: {node.risk}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edges */}
      <Card>
        <CardHeader>
          <CardTitle>Edges ({edges.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {edges.length === 0 ? (
              <p className="text-sm text-gray-500">No edges</p>
            ) : (
              edges.map((edge: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{edge.source || 'N/A'}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-gray-900">{edge.target || 'N/A'}</span>
                    {edge.relation && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                        {edge.relation}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Raw Graph Data */}
      <Card>
        <CardHeader>
          <CardTitle>Raw Graph Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto border border-gray-200">
            {JSON.stringify(graph, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

