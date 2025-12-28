/**
 * Paragraph Analysis View Component - Proxy Style
 * Shows paragraph-by-paragraph analysis with risks and justifications
 * Similar to Proxy Lite but with deeper analysis
 */

'use client';

import { ParagraphAnalysis as ParagraphAnalysisType, RiskLocation, DecisionJustificationResponse } from '@/api/proxy_corporate';
import InfoTooltip from './InfoTooltip';

interface ParagraphAnalysisViewProps {
  paragraphs: ParagraphAnalysisType[];
  riskLocations: RiskLocation[];
  justifications?: DecisionJustificationResponse[] | null;
}

export default function ParagraphAnalysisView({ 
  paragraphs, 
  riskLocations, 
  justifications 
}: ParagraphAnalysisViewProps) {
  // Get risks for a paragraph - use paragraph's own risk_locations
  const getRisksForParagraph = (paragraph: ParagraphAnalysisType) => {
    // Each paragraph already has its own risk_locations from backend
    // These are the risks detected specifically for this paragraph
    return paragraph.risk_locations || [];
  };

  // Get justifications for a paragraph (by matching risk types)
  const getJustificationsForParagraph = (paragraph: ParagraphAnalysisType) => {
    if (!justifications) return [];
    
    // Match justifications to paragraph by risk types in paragraph's risk_locations
    const paragraphRiskTypes = paragraph.risk_locations.map(rl => rl.type);
    const paragraphPolicies = paragraph.risk_locations
      .map(rl => rl.policy)
      .filter((p): p is string => p !== null && p !== undefined);
    
    return justifications.filter(j => {
      // Check if justification's violation type matches any risk in paragraph
      const violationType = j.violation.toLowerCase();
      const matchesType = paragraphRiskTypes.some(rt => violationType.includes(rt.toLowerCase()));
      
      // Also check policy match if available
      const matchesPolicy = j.policy && paragraphPolicies.includes(j.policy);
      
      return matchesType || matchesPolicy;
    });
  };

  // Get risk color based on severity
  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#E84343';
      case 'medium': return '#F4A72F';
      case 'low': return '#22BF55';
      default: return '#8E8E93';
    }
  };

  // Get overall risk level for paragraph
  const getParagraphRiskLevel = (paragraph: ParagraphAnalysisType) => {
    // PREMIUM FLOW: All paragraphs are analyzed (light or deep mode)
    const ethicalScore = paragraph.ethical_index ?? 50; // Default to 50 if missing
    if (ethicalScore >= 76) return { level: 'low', color: '#22BF55', label: 'Düşük Risk' };
    if (ethicalScore >= 51) return { level: 'medium', color: '#F4A72F', label: 'Orta Risk' };
    return { level: 'high', color: '#E84343', label: 'Yüksek Risk' };
  };

  // Get analysis level label
  const getAnalysisLevelLabel = (paragraph: ParagraphAnalysisType) => {
    const analysisLevel = (paragraph as any).analysis_level;
    if (analysisLevel === 'light') {
      return { label: 'Hızlı Tarama', color: '#8E8E93', description: 'Bu paragraf için derin analiz gerekli görülmedi.' };
    }
    return { label: 'Derin Analiz', color: '#2563EB', description: 'Bu paragraf detaylı analizden geçirildi.' };
  };

  if (!paragraphs || paragraphs.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--proxy-text-muted)' }}>
        <p>Paragraf analizi bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {paragraphs.map((paragraph, index) => {
        const paragraphRisks = getRisksForParagraph(paragraph);
        const paragraphJustifications = getJustificationsForParagraph(paragraph);
        const riskLevel = getParagraphRiskLevel(paragraph);

        return (
          <div
            key={index}
            className="rounded-2xl p-6 transition-colors"
            style={{
              backgroundColor: 'var(--proxy-surface)',
              border: `1px solid ${riskLevel.color}40`,
              boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
            }}
          >
            {/* Paragraph Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--proxy-text-secondary)' }}>
                    Paragraf {index + 1}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* PREMIUM FLOW: All paragraphs are analyzed - show scores */}
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: `${riskLevel.color}15`,
                        color: riskLevel.color,
                        fontWeight: 600,
                      }}
                    >
                      {riskLevel.label} • Etik Skor: {paragraph.ethical_index ?? 'N/A'}
                    </span>
                    <InfoTooltip
                      content="Etik Skor, bu paragrafın genel etik değerlendirmesini gösterir. Yüksek skor (76+) düşük risk, orta skor (51-75) orta risk, düşük skor (<51) yüksek risk anlamına gelir."
                      position="top"
                    />
                    {/* Analysis Level Badge (Light/Deep) */}
                    {(() => {
                      const levelInfo = getAnalysisLevelLabel(paragraph);
                      return (
                        <span
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: `${levelInfo.color}15`,
                            color: levelInfo.color,
                            fontSize: '10px',
                          }}
                        >
                          {levelInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Paragraph Scores (Mini) - PREMIUM FLOW: Always show */}
                <div className="flex items-center gap-4 text-xs mb-3" style={{ color: 'var(--proxy-text-muted)' }}>
                  <span>Uyum: {paragraph.compliance_score ?? 'N/A'}</span>
                  <span>Manipülasyon: {paragraph.manipulation_score ?? 'N/A'}</span>
                  <span>Önyargı: {paragraph.bias_score ?? 'N/A'}</span>
                  <span>Hukuki: {paragraph.legal_risk_score ?? 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Paragraph Text */}
            <div className="mb-4">
              <p className="text-xs mb-2" style={{ color: 'var(--proxy-text-muted)' }}>
                Analiz Edilen Metin
              </p>
              <div
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: 'var(--proxy-bg-secondary)',
                  borderColor: `${riskLevel.color}40`,
                  borderWidth: '1px',
                }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--proxy-text-primary)' }}>
                  {paragraph.text}
                </p>
              </div>
            </div>

            {/* Risks for this paragraph */}
            {paragraphRisks.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--proxy-text-secondary)' }}>
                    Tespit Edilen Riskler
                  </p>
                  <InfoTooltip
                    content="Bu paragrafta tespit edilen riskler, normalize edilmiş primary risk pattern'lere göre gösterilir. Her risk, narrative intent'e göre gruplandırılmıştır ve birden fazla politika referansı içerebilir."
                    position="top"
                  />
                </div>
                <div className="space-y-2">
                  {paragraphRisks.map((risk, riskIndex) => (
                    <div
                      key={riskIndex}
                      className="rounded-lg p-3 border"
                      style={{
                        backgroundColor: `${getRiskColor(risk.severity)}10`,
                        borderColor: `${getRiskColor(risk.severity)}40`,
                        borderWidth: '1px',
                      }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              backgroundColor: `${getRiskColor(risk.severity)}20`,
                              color: getRiskColor(risk.severity),
                            }}
                          >
                            {risk.type.toUpperCase()}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${getRiskColor(risk.severity)}15`,
                              color: getRiskColor(risk.severity),
                            }}
                          >
                            {risk.severity}
                          </span>
                          {risk.policy && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--proxy-action-primary)' }}>
                              {risk.policy}
                            </span>
                          )}
                        </div>
                      </div>
                      {risk.evidence && (
                        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--proxy-text-secondary)' }}>
                          {risk.evidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Justifications for this paragraph */}
            {paragraphJustifications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--proxy-text-secondary)' }}>
                    Karar Gerekçesi
                  </p>
                  <InfoTooltip
                    content="Karar Gerekçesi, tespit edilen risklerin neden riskli olduğunu açıklar. Her gerekçe, narrative intent, reader influence ve systemic risk faktörlerini içerir. Bu gerekçeler, regulator ve yönetim için açıklayıcı niteliktedir."
                    position="top"
                  />
                </div>
                <div className="space-y-2">
                  {paragraphJustifications.map((justification, justIndex) => (
                    <div
                      key={justIndex}
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: 'var(--proxy-bg-secondary)',
                        border: '1px solid var(--proxy-border-soft)',
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold" style={{ color: 'var(--proxy-text-primary)' }}>
                            {justification.violation}
                          </span>
                          {justification.policies && justification.policies.length > 1 && (
                            <div className="flex gap-1 flex-wrap">
                              {justification.policies.map((policy, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--proxy-action-primary)' }}
                                >
                                  {policy}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: `${getRiskColor(justification.severity >= 0.7 ? 'high' : justification.severity >= 0.4 ? 'medium' : 'low')}15`,
                            color: getRiskColor(justification.severity >= 0.7 ? 'high' : justification.severity >= 0.4 ? 'medium' : 'low'),
                          }}
                        >
                          Şiddet: {(justification.severity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--proxy-text-secondary)' }}>
                        {justification.evidence}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flags */}
            {paragraph.flags && paragraph.flags.length > 0 && (
              <div className="mt-4">
                <p className="text-xs mb-2 font-medium" style={{ color: 'var(--proxy-text-secondary)' }}>
                  İşaretler
                </p>
                <div className="flex flex-wrap gap-2">
                  {paragraph.flags.map((flag, flagIndex) => (
                    <span
                      key={flagIndex}
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: 'rgba(142, 142, 147, 0.1)',
                        color: 'var(--proxy-text-secondary)',
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

