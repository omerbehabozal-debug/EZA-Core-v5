/**
 * Policy Config Component
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/ui/button';
import { PolicyConfig as PolicyConfigType } from '@/lib/types';
import { X, Plus } from 'lucide-react';

interface PolicyConfigProps {
  config: PolicyConfigType;
  onSave: (config: PolicyConfigType) => void;
}

export default function PolicyConfig({ config, onSave }: PolicyConfigProps) {
  const [localConfig, setLocalConfig] = useState(config);

  const addHighRiskTopic = () => {
    setLocalConfig({
      ...localConfig,
      high_risk_topics: [...localConfig.high_risk_topics, ''],
    });
  };

  const removeHighRiskTopic = (index: number) => {
    setLocalConfig({
      ...localConfig,
      high_risk_topics: localConfig.high_risk_topics.filter((_, i) => i !== index),
    });
  };

  const updateHighRiskTopic = (index: number, value: string) => {
    const updated = [...localConfig.high_risk_topics];
    updated[index] = value;
    setLocalConfig({ ...localConfig, high_risk_topics: updated });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            High-Risk Topics
          </label>
          <div className="space-y-2">
            {localConfig.high_risk_topics.map((topic, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => updateHighRiskTopic(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter high-risk topic"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHighRiskTopic(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addHighRiskTopic}>
              <Plus className="w-4 h-4 mr-2" />
              Add Topic
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Illegal Use Cases
          </label>
          <textarea
            value={localConfig.illegal_use_cases.join('\n')}
            onChange={(e) => setLocalConfig({
              ...localConfig,
              illegal_use_cases: e.target.value.split('\n').filter(Boolean),
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter illegal use cases (one per line)"
          />
        </div>

        <Button onClick={() => onSave(localConfig)} className="w-full">
          Save Policy Pack
        </Button>
      </CardContent>
    </Card>
  );
}

