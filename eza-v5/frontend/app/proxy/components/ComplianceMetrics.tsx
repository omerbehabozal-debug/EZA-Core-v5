/**
 * Compliance Metrics Component
 * Shows compliance breakdown by policy
 */

"use client";

import InfoTooltip from "./InfoTooltip";

interface ComplianceMetricsProps {
  policies?: string[];
  complianceScore: number;
}

export default function ComplianceMetrics({ policies, complianceScore }: ComplianceMetricsProps) {
  const policyColors: Record<string, string> = {
    TRT: '#007AFF',
    FINTECH: '#22BF55',
    HEALTH: '#FF9500',
  };

  const policyDescriptions: Record<string, string> = {
    TRT: 'TRT (Türkiye Radyo ve Televizyon Kurumu) politikaları: Tarafsızlık, doğruluk, çeşitlilik ve kamu yararı ilkelerine uyumluluk.',
    FINTECH: 'FINTECH politikaları: Finansal hizmetlerde şeffaflık, yanıltıcı reklam yasağı, tüketici koruması ve düzenleyici uyumluluk.',
    HEALTH: 'HEALTH politikaları: Sağlık iddiaları, tıbbi bilgi doğruluğu, zararlı sağlık tavsiyeleri ve düzenleyici uyumluluk gereksinimleri.',
  };

  return (
    <div className="p-6 rounded-xl" style={{ backgroundColor: '#1C1C1E' }}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold" style={{ color: '#E5E5EA' }}>
          Uyumluluk Metrikleri
        </h3>
        <InfoTooltip
          content="Genel Uyum Skoru, seçili politika setlerine göre içeriğin uyumluluk seviyesini gösterir. Yüksek skor (70+) politika gereksinimlerini karşıladığını, düşük skor (<40) ihlal riski olduğunu gösterir."
          position="top"
        />
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: '#8E8E93' }}>Genel Uyum Skoru</span>
            <span className="text-2xl font-bold" style={{ color: complianceScore >= 70 ? '#22BF55' : '#FF9500' }}>
              {complianceScore}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#2C2C2E' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${complianceScore}%`,
                backgroundColor: complianceScore >= 70 ? '#22BF55' : '#FF9500',
              }}
            />
          </div>
        </div>
        
        {policies && policies.length > 0 && (
          <div className="pt-4 border-t" style={{ borderColor: '#2C2C2E' }}>
            <p className="text-sm mb-3" style={{ color: '#8E8E93' }}>Uygulanan Politikalar:</p>
            <div className="flex flex-wrap gap-2">
              {policies.map((policy) => (
                <div key={policy} className="flex items-center gap-1">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${policyColors[policy] || '#6E6E73'}20`,
                      color: policyColors[policy] || '#8E8E93',
                    }}
                  >
                    {policy}
                  </span>
                  {policyDescriptions[policy] && (
                    <InfoTooltip
                      content={policyDescriptions[policy]}
                      position="top"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

