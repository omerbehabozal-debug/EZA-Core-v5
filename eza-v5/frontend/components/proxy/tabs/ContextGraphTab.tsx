/**
 * Context Graph Tab
 * Professional graph visualization with Cytoscape.js
 * Context Graph 2.0: Explainability + Timeline + Drift
 */

'use client';

import { useState } from 'react';
import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import ContextGraphVisual from '@/components/proxy/graph/ContextGraphVisual';
import ContextGraphExplainPanel from '@/components/proxy/graph/ContextGraphExplainPanel';
import ContextGraphTimeline from '@/components/proxy/graph/ContextGraphTimeline';

interface ContextGraphTabProps {
  data: FullPipelineDebugResponse;
}

export default function ContextGraphTab({ data }: ContextGraphTabProps) {
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [activeStage, setActiveStage] = useState<string | null>(null);

  // Get graph from multiple possible locations
  const graph = data?.analysis?.context_graph || data?.context_graph || data?.graph;
  const nodes = graph?.nodes;
  const edges = graph?.edges;

  // Güçlü koruma: nodes ve edges array değilse hata vermesin
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];

  // Selected node ID
  const selectedNodeId = selectedNode?.id ?? selectedNode?._id ?? null;

  // Early return if no graph data
  if (safeNodes.length === 0 && safeEdges.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">
          Bu session için context graph üretilmedi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Timeline */}
      <div>
        <ContextGraphTimeline
          nodes={safeNodes}
          activeStage={activeStage}
          onStageChange={(stage) => {
            setActiveStage(stage);
            setSelectedNode(null); // Clear selection when changing stage
          }}
        />
      </div>

      {/* Graph + Explain Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2">
          <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm h-[420px]">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Graph Diagram</h2>
            <ContextGraphVisual
              nodes={safeNodes}
              edges={safeEdges}
              filterStage={activeStage}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNode}
            />
            <p className="mt-2 text-xs text-gray-400">
              Zoom: Scroll wheel &nbsp; | &nbsp; Pan: Click and drag &nbsp; | &nbsp;
              Node: Click for details
            </p>
          </div>
        </div>

        <div className="lg:col-span-1">
          <ContextGraphExplainPanel selectedNode={selectedNode} />
        </div>
      </div>

      {/* Raw nodes/edges (existing implementation) */}
      <div className="space-y-4">
        {/* Nodes (Raw) */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Nodes (Raw) ({safeNodes.length})</h2>
          {safeNodes.length === 0 ? (
            <p className="text-sm text-gray-500">No nodes</p>
          ) : (
            <div className="space-y-2">
              {safeNodes.map((node: any, idx: number) => (
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
                      {(node.risk !== undefined || node.risk_level) && (
                        <span className="ml-2 inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                          Risk: {node.risk_level || node.risk}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edges (Raw) */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Edges (Raw) ({safeEdges.length})</h2>
          {safeEdges.length === 0 ? (
            <p className="text-sm text-gray-500">No edges</p>
          ) : (
            <div className="space-y-2">
              {safeEdges.map((edge: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{edge.source || `Edge ${idx + 1}`}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-gray-900">{edge.target || 'N/A'}</span>
                    {edge.relation && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                        {edge.relation}
                      </span>
                    )}
                    {edge.label && (
                      <span className="ml-2 text-xs text-gray-600 italic">
                        ({edge.label})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

      {/* Nodes (Raw) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Nodes (Raw) ({safeNodes.length})</h2>
        {safeNodes.length === 0 ? (
          <p className="text-sm text-gray-500">No nodes</p>
        ) : (
          <div className="space-y-2">
            {safeNodes.map((node: any, idx: number) => (
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
                    {(node.risk !== undefined || node.risk_level) && (
                      <span className="ml-2 inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                        Risk: {node.risk_level || node.risk}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edges (Raw) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Edges (Raw) ({safeEdges.length})</h2>
        {safeEdges.length === 0 ? (
          <p className="text-sm text-gray-500">No edges</p>
        ) : (
          <div className="space-y-2">
            {safeEdges.map((edge: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{edge.source || `Edge ${idx + 1}`}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-900">{edge.target || 'N/A'}</span>
                  {edge.relation && (
                    <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                      {edge.relation}
                    </span>
                  )}
                  {edge.label && (
                    <span className="ml-2 text-xs text-gray-600 italic">
                      ({edge.label})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

