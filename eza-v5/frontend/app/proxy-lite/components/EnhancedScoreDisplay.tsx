/**
 * Enhanced Score Display Component
 * Shows Ethical, Neutrality, Writing Quality, and Platform Fit scores
 */

"use client";

import { LiteAnalysisResponse } from "@/api/proxy_lite";
import ScoreGauge from "./ScoreGauge";

interface EnhancedScoreDisplayProps {
  result: LiteAnalysisResponse;
}

export default function EnhancedScoreDisplay({ result }: EnhancedScoreDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return '#22BF55';
    if (score >= 40) return '#FF9500';
    return '#E84343';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'İyi';
    if (score >= 40) return 'Orta';
    return 'Düşük';
  };

  return (
    <div className="space-y-6">
      {/* Main Ethical Score - Large */}
      <div className="flex flex-col items-center">
        <ScoreGauge score={result.ethics_score} />
        <p className="text-sm mt-2" style={{ color: '#6E6E73' }}>
          Etik Skor
        </p>
      </div>

      {/* Secondary Scores - Small Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-4 rounded-[12px] bg-[#F8F9FB]">
          <div className="text-2xl font-bold" style={{ color: getScoreColor(result.neutrality_score) }}>
            {result.neutrality_score}
          </div>
          <div className="text-xs mt-1" style={{ color: '#6E6E73' }}>
            Tarafsızlık
          </div>
          <div className="text-xs mt-1" style={{ color: getScoreColor(result.neutrality_score) }}>
            {getScoreLabel(result.neutrality_score)}
          </div>
        </div>
        
        <div className="text-center p-4 rounded-[12px] bg-[#F8F9FB]">
          <div className="text-2xl font-bold" style={{ color: getScoreColor(result.writing_quality_score) }}>
            {result.writing_quality_score}
          </div>
          <div className="text-xs mt-1" style={{ color: '#6E6E73' }}>
            Yazım Kalitesi
          </div>
          <div className="text-xs mt-1" style={{ color: getScoreColor(result.writing_quality_score) }}>
            {getScoreLabel(result.writing_quality_score)}
          </div>
        </div>
        
        <div className="text-center p-4 rounded-[12px] bg-[#F8F9FB]">
          <div className="text-2xl font-bold" style={{ color: getScoreColor(result.platform_fit_score) }}>
            {result.platform_fit_score}
          </div>
          <div className="text-xs mt-1" style={{ color: '#6E6E73' }}>
            Platform Uyumu
          </div>
          <div className="text-xs mt-1" style={{ color: getScoreColor(result.platform_fit_score) }}>
            {getScoreLabel(result.platform_fit_score)}
          </div>
        </div>
      </div>
    </div>
  );
}

