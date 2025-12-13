/**
 * Score Bars Component
 * Displays 5 score types as horizontal bars
 */

"use client";

interface ScoreBarsProps {
  scores: {
    ethical_index: number;
    compliance_score: number;
    manipulation_score: number;
    bias_score: number;
    legal_risk_score: number;
  };
}

export default function ScoreBars({ scores }: ScoreBarsProps) {
  const scoreConfig = [
    { key: 'ethical_index', label: 'Etik İndeks', color: '#007AFF' },
    { key: 'compliance_score', label: 'Uyum Skoru', color: '#22BF55' },
    { key: 'manipulation_score', label: 'Manipülasyon Skoru', color: '#FF9500' },
    { key: 'bias_score', label: 'Önyargı Skoru', color: '#AF52DE' },
    { key: 'legal_risk_score', label: 'Hukuki Risk Skoru', color: '#E84343' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#22BF55';
    if (score >= 40) return '#FF9500';
    return '#E84343';
  };

  return (
    <div className="space-y-4">
      {scoreConfig.map((config) => {
        const score = scores[config.key as keyof typeof scores];
        const color = getScoreColor(score);
        
        return (
          <div key={config.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
                {config.label}
              </span>
              <span className="text-sm font-bold" style={{ color }}>
                {score}/100
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#2C2C2E' }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

