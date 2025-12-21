/**
 * Score Bars Component
 * Displays 5 score types as horizontal bars with info tooltips
 */

"use client";

import InfoTooltip from "./InfoTooltip";

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
    {
      key: 'ethical_index',
      label: 'Etik İndeks',
      color: '#007AFF',
      description: 'İçeriğin genel etik değerlendirmesi. Yüksek skor (70+) güvenli, düşük skor (<40) riskli içerik anlamına gelir. Manipülasyon, önyargı, yanıltıcı bilgi gibi faktörler düşük skor üretir.'
    },
    {
      key: 'compliance_score',
      label: 'Uyum Skoru',
      color: '#22BF55',
      description: 'Seçili politika setlerine (TRT, FINTECH, HEALTH) uyumluluk seviyesi. Yüksek skor (70+) politika gereksinimlerini karşıladığını, düşük skor (<40) ihlal riski olduğunu gösterir.'
    },
    {
      key: 'manipulation_score',
      label: 'Manipülasyon Skoru',
      color: '#FF9500',
      description: 'İçeriğin duygusal manipülasyon, korku/umut sömürüsü, yanıltıcı retorik kullanımı seviyesi. Yüksek skor (>60) manipülatif dil, düşük skor (<30) daha tarafsız içerik anlamına gelir.'
    },
    {
      key: 'bias_score',
      label: 'Önyargı Skoru',
      color: '#AF52DE',
      description: 'İçerikte tespit edilen ideolojik, kültürel veya sistematik önyargı seviyesi. Yüksek skor (>60) önyargılı dil, düşük skor (<30) daha dengeli içerik anlamına gelir.'
    },
    {
      key: 'legal_risk_score',
      label: 'Hukuki Risk Skoru',
      color: '#E84343',
      description: 'İçeriğin yasal risk seviyesi. Yüksek skor (>60) iftira, yanıltıcı reklam, sağlık iddiaları gibi yasal riskler içerir. Düşük skor (<30) yasal açıdan güvenli içerik anlamına gelir.'
    },
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
                  {config.label}
                </span>
                <InfoTooltip content={config.description} position="top" />
              </div>
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

