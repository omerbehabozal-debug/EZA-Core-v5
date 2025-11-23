/**
 * Workflow Builder Component
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { WorkflowNode } from '@/lib/types';
import { ArrowRight, Shield, User, Archive } from 'lucide-react';

const nodeTypes = [
  { type: 'input', label: 'Input', icon: ArrowRight, color: 'bg-blue-500' },
  { type: 'risk_check', label: 'Risk Check', icon: Shield, color: 'bg-yellow-500' },
  { type: 'human_reviewer', label: 'Human Reviewer', icon: User, color: 'bg-green-500' },
  { type: 'archive', label: 'Archive', icon: Archive, color: 'bg-gray-500' },
];

export default function WorkflowBuilder() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);

  const addNode = (type: WorkflowNode['type']) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      config: {},
    };
    setNodes([...nodes, newNode]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {nodeTypes.map((nodeType) => {
              const Icon = nodeType.icon;
              return (
                <button
                  key={nodeType.type}
                  onClick={() => addNode(nodeType.type as WorkflowNode['type'])}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${nodeType.color} hover:opacity-90 transition-opacity`}
                >
                  <Icon className="w-4 h-4" />
                  {nodeType.label}
                </button>
              );
            })}
          </div>

          <div className="relative h-96 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            {nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                Drag nodes here or click buttons above to add
              </div>
            ) : (
              <div className="relative w-full h-full">
                {nodes.map((node) => {
                  const nodeType = nodeTypes.find(nt => nt.type === node.type);
                  const Icon = nodeType?.icon || ArrowRight;
                  return (
                    <div
                      key={node.id}
                      className="absolute cursor-move"
                      style={{ left: node.position.x, top: node.position.y }}
                    >
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white ${nodeType?.color || 'bg-gray-500'}`}>
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{nodeType?.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-sm text-gray-600">
            <p>Auto-save enabled. Changes are saved automatically.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

