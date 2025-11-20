/**
 * EngineTabs Component - Tabbed view of engine results
 */

import { useState } from 'react';
import { Code2 } from 'lucide-react';

interface EngineTabsProps {
  deception?: any;
  psychPressure?: any;
  legalRisk?: any;
  rawResponse?: any;
}

export default function EngineTabs({ deception, psychPressure, legalRisk, rawResponse }: EngineTabsProps) {
  const [activeTab, setActiveTab] = useState<'engines' | 'json'>('engines');

  const engines = [
    {
      name: 'Deception',
      data: deception,
      color: 'red',
    },
    {
      name: 'Psychological Pressure',
      data: psychPressure,
      color: 'amber',
    },
    {
      name: 'Legal Risk',
      data: legalRisk,
      color: 'blue',
    },
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('engines')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'engines'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Engines
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'json'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Raw JSON
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'engines' ? (
          <div className="space-y-4">
            {engines.map((engine, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">{engine.name}</h3>
                  {engine.data && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getLevelColor(engine.data.level || 'low')}`}>
                      {engine.data.level?.toUpperCase() || 'N/A'}
                    </span>
                  )}
                </div>
                {engine.data ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Score:</span>
                      <span className="font-medium text-gray-900">
                        {((engine.data.score || engine.data.risk_score || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    {engine.data.summary && (
                      <p className="text-xs text-gray-600 mt-2">{engine.data.summary}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No data available</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Code2 className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Raw Response</span>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 overflow-x-auto text-xs font-mono text-gray-800 border border-gray-200 max-h-96 overflow-y-auto">
              {rawResponse ? JSON.stringify(rawResponse, null, 2) : 'No data available'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

