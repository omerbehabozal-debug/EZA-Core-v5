/**
 * Context Graph Timeline / Stage Filter
 * Horizontal filter bar for pipeline stages
 */

'use client';

interface ContextGraphTimelineProps {
  nodes: any[];
  activeStage: string | null;
  onStageChange: (stage: string | null) => void;
}

// Extract stage from node
function extractStage(node: any): string {
  return (
    node?.stage ||
    node?.pipeline_stage ||
    node?.step ||
    node?.context_stage ||
    'analysis'
  );
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

export default function ContextGraphTimeline({
  nodes,
  activeStage,
  onStageChange,
}: ContextGraphTimelineProps) {
  // Extract unique stages
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const stages = new Set<string>();
  
  safeNodes.forEach((node) => {
    const stage = extractStage(node);
    if (stage) {
      stages.add(stage);
    }
  });

  const uniqueStages = Array.from(stages).sort();

  // If only one stage, don't render timeline
  if (uniqueStages.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {/* "All" pill */}
      <button
        onClick={() => onStageChange(null)}
        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
          activeStage === null
            ? 'bg-blue-50 border-blue-500 text-blue-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        All
      </button>

      {/* Stage pills */}
      {uniqueStages.map((stage) => (
        <button
          key={stage}
          onClick={() => onStageChange(stage)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
            activeStage === stage
              ? 'bg-blue-50 border-blue-500 text-blue-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {prettifyStage(stage)}
        </button>
      ))}
    </div>
  );
}

