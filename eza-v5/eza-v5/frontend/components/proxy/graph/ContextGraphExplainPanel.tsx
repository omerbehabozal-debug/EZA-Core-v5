/**
 * Context Graph Explain Panel
 * Shows detailed information about selected node
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Badge } from '@/components/ui/badge';

interface ContextGraphExplainPanelProps {
  selectedNode: any | null;
}

// Risk level color mapping (same as graph)
const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
  safe: 'bg-gray-100 text-gray-800',
  none: 'bg-gray-100 text-gray-800',
};

// Get risk badge variant
function getRiskBadgeVariant(riskLevel: string | undefined | null): string {
  if (!riskLevel) return RISK_COLORS.safe;
  const normalized = riskLevel.toLowerCase();
  return RISK_COLORS[normalized] || RISK_COLORS.safe;
}

// Get safe field value with fallbacks
function getSafeField(node: any, ...fields: string[]): string | null {
  if (!node) return null;
  for (const field of fields) {
    if (node[field] !== undefined && node[field] !== null) {
      return String(node[field]);
    }
  }
  return null;
}

// Get risk level with multiple fallbacks
function getRiskLevel(node: any): string {
  return getSafeField(node, 'risk_level', 'risk', 'level', 'severity') || 'safe';
}

// Prettify stage name
function prettifyStage(stage: string): string {
  const stageMap: Record<string, string> = {
    input: 'Input',
    routing: 'Routing',
    models: 'Models',
    alignment: 'Alignment',
    safety: 'Safety',
    score: 'Score',
    analysis: 'Analysis',
  };
  return stageMap[stage.toLowerCase()] || stage.charAt(0).toUpperCase() + stage.slice(1);
}

export default function ContextGraphExplainPanel({ selectedNode }: ContextGraphExplainPanelProps) {
  if (!selectedNode) {
    return (
      <div className="h-full">
        <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm h-full flex flex-col">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Node Explanation</h2>
          <p className="text-sm text-gray-500">
            Grafikten bir node seçtiğinizde detaylar burada görünecek.
          </p>
        </div>
      </div>
    );
  }

  const label = getSafeField(selectedNode, 'label', 'name', 'id') || 'Node';
  const type = getSafeField(selectedNode, 'type', 'node_type', 'category', 'kind') || 'unknown';
  const riskLevel = getRiskLevel(selectedNode);
  const stage = getSafeField(selectedNode, 'stage', 'pipeline_stage', 'step', 'context_stage') || 'analysis';
  const sourceEngine = getSafeField(selectedNode, 'source_engine', 'engine', 'module', 'origin');

  // Drift detection
  const driftScore = selectedNode?.drift_score;
  const riskBefore = getSafeField(selectedNode, 'risk_before', 'previous_risk');
  const riskAfter = getSafeField(selectedNode, 'risk_after', 'current_risk');
  const hasChanged = selectedNode?.changed === true || selectedNode?.has_changed === true;
  const hasDrift = 
    (typeof driftScore === 'number' && driftScore > 0) ||
    hasChanged ||
    (riskBefore && riskAfter && riskBefore !== riskAfter);

  return (
    <div className="h-full">
      <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm h-full flex flex-col">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Node Explanation</h2>
        
        <div className="space-y-3 text-sm text-gray-700 flex-1 overflow-y-auto">
          {/* Label */}
          <div>
            <span className="text-xs text-gray-500 font-medium">Label</span>
            <p className="mt-1 font-semibold text-gray-900">{label}</p>
          </div>

          {/* Type */}
          <div>
            <span className="text-xs text-gray-500 font-medium">Type</span>
            <p className="mt-1">{type}</p>
          </div>

          {/* Risk Level */}
          <div>
            <span className="text-xs text-gray-500 font-medium">Risk Level</span>
            <div className="mt-1">
              <Badge className={getRiskBadgeVariant(riskLevel)}>
                {riskLevel.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Stage */}
          <div>
            <span className="text-xs text-gray-500 font-medium">Stage</span>
            <p className="mt-1">{prettifyStage(stage)}</p>
          </div>

          {/* Source Engine */}
          {sourceEngine && (
            <div>
              <span className="text-xs text-gray-500 font-medium">Source Engine</span>
              <p className="mt-1">{sourceEngine}</p>
            </div>
          )}

          {/* Drift Info */}
          {hasDrift && (
            <div className="border-t border-gray-200 pt-3 mt-3">
              <span className="text-xs text-gray-500 font-medium">Drift / Change Detection</span>
              <div className="mt-2 space-y-2">
                {typeof driftScore === 'number' && (
                  <div>
                    <span className="text-xs text-gray-600">Drift Score: </span>
                    <span className="font-semibold">{driftScore.toFixed(2)}</span>
                  </div>
                )}
                {riskBefore && riskAfter && riskBefore !== riskAfter && (
                  <div>
                    <span className="text-xs text-gray-600">Risk Change: </span>
                    <span className="font-semibold">
                      {riskBefore} → {riskAfter}
                    </span>
                  </div>
                )}
                {hasChanged && (
                  <div>
                    <Badge variant="warning" className="text-xs">
                      Changed
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw JSON (Collapsible) */}
          <details className="border-t border-gray-200 pt-3 mt-3">
            <summary className="text-xs text-gray-500 font-medium cursor-pointer hover:text-gray-700">
              Raw JSON Data
            </summary>
            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto border border-gray-200 max-h-64 overflow-y-auto">
              {JSON.stringify(selectedNode, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

