/**
 * Models & Outputs Tab
 */

'use client';

import { useState } from 'react';
import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

interface ModelsOutputsTabProps {
  data: FullPipelineDebugResponse;
}

export default function ModelsOutputsTab({ data }: ModelsOutputsTabProps) {
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  const toggleModel = (model: string) => {
    const newExpanded = new Set(expandedModels);
    if (newExpanded.has(model)) {
      newExpanded.delete(model);
    } else {
      newExpanded.add(model);
    }
    setExpandedModels(newExpanded);
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-600">Used Models</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.models.used_models?.map((model, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded"
            >
              {model}
            </span>
          ))}
        </div>
      </div>

      {Object.entries(data.models.model_outputs || {}).map(([modelName, output]) => (
        <Card key={modelName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{modelName}</CardTitle>
              <button
                onClick={() => toggleModel(modelName)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {expandedModels.has(modelName) ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </CardHeader>
          {expandedModels.has(modelName) && (
            <CardContent>
              <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto border border-gray-200 whitespace-pre-wrap">
                {output}
              </pre>
            </CardContent>
          )}
        </Card>
      ))}

      {Object.keys(data.models.model_outputs || {}).length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500">No model outputs available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

