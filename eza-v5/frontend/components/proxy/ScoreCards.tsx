/**
 * ScoreCards Component - Statistics cards
 */

import { TrendingUp, Shield, Brain, Activity } from 'lucide-react';

interface ScoreCardsProps {
  scoreBreakdown?: any;
  alignment?: any;
  deception?: any;
  psychPressure?: any;
  memoryConsistency?: any;
}

export default function ScoreCards({ scoreBreakdown, alignment, deception, psychPressure, memoryConsistency }: ScoreCardsProps) {
  if (!scoreBreakdown && !alignment) {
    return null;
  }

  const ezaScore = scoreBreakdown?.final_score || 0;
  const alignmentScore = alignment?.alignment_score || 0;
  const reasoningLevel = deception?.level || psychPressure?.level || 'low';
  const memoryLevel = memoryConsistency?.level || 'low';

  const cards = [
    {
      title: 'EZA Score',
      value: Math.round(ezaScore),
      icon: TrendingUp,
      color: 'indigo',
      max: 100,
    },
    {
      title: 'Alignment',
      value: Math.round(alignmentScore),
      icon: Shield,
      color: 'blue',
      max: 100,
    },
    {
      title: 'Reasoning',
      value: reasoningLevel,
      icon: Brain,
      color: 'purple',
      isLevel: true,
    },
    {
      title: 'Memory',
      value: memoryLevel,
      icon: Activity,
      color: 'green',
      isLevel: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colorClasses = {
          indigo: 'bg-indigo-100 text-indigo-600',
          blue: 'bg-blue-100 text-blue-600',
          purple: 'bg-purple-100 text-purple-600',
          green: 'bg-green-100 text-green-600',
        };

        return (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg ${colorClasses[card.color as keyof typeof colorClasses]} flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-xs font-medium text-gray-500 mb-1">{card.title}</h3>
            {card.isLevel ? (
              <p className="text-lg font-semibold text-gray-900 capitalize">{card.value}</p>
            ) : (
              <div>
                <p className="text-lg font-semibold text-gray-900">{card.value}</p>
                {card.max && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${colorClasses[card.color as keyof typeof colorClasses].split(' ')[0]}`}
                      style={{ width: `${(card.value / card.max) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

