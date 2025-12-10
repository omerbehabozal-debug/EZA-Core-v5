/**
 * Paragraph Analysis Component
 * Shows paragraph-by-paragraph analysis with ethical score and suggestions
 */

'use client';

import { useState } from 'react';
import { ParagraphAnalysis as ParagraphAnalysisType, rewriteLite } from '@/api/proxy_lite';
import { cn } from '@/lib/utils';
import { getColorFromLevel, getRiskLabelFromLevel } from '../lib/scoringUtils';
import FlagsPills from './FlagsPills';
import HighlightText from './HighlightText';

interface ParagraphAnalysisProps {
  paragraph: ParagraphAnalysisType;
  index: number;
}

export default function ParagraphAnalysis({ paragraph, index }: ParagraphAnalysisProps) {
  const [showRewrite, setShowRewrite] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<{
    text: string;
    score: number;
    riskLevel: 'dusuk' | 'orta' | 'yuksek';
  } | null>(null);
  
  const color = getColorFromLevel(paragraph.risk_level);
  const label = getRiskLabelFromLevel(paragraph.risk_level);
  const needsRewrite = paragraph.risk_level !== 'dusuk'; // Only show rewrite for medium/high risk

  const handleRewrite = async () => {
    if (isRewriting) return;
    
    setIsRewriting(true);
    try {
      const result = await rewriteLite(
        paragraph.original_text,
        paragraph.risk_labels,
        'tr'
      );
      
      if (result && result.new_ethical_score > result.original_ethical_score) {
        setRewriteResult({
          text: result.rewritten_text,
          score: result.new_ethical_score,
          riskLevel: result.risk_level_after,
        });
        setShowRewrite(true);
      } else {
        alert('Bu öneri daha güvenli değil, lütfen metni gözden geçirin.');
      }
    } catch (error) {
      console.error('Rewrite failed:', error);
      alert('Yeniden yazma işlemi başarısız oldu.');
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <div 
      className="rounded-xl p-6 mb-4"
      style={{ backgroundColor: '#1A1F2E', borderRadius: '12px' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-400">Paragraf {paragraph.index}</span>
            <span 
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              Etik Skor: {paragraph.ethical_score} ({label})
            </span>
          </div>
          
          {paragraph.risk_labels && paragraph.risk_labels.length > 0 && (
            <div className="mb-3">
              <FlagsPills flags={paragraph.risk_labels} />
            </div>
          )}
        </div>
      </div>

      {/* Original Text */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Orijinal Metin</p>
        <div 
          className="rounded-lg p-4"
          style={{ backgroundColor: '#111726', borderRadius: '12px' }}
        >
          <p className="text-white text-sm leading-relaxed">
            <HighlightText
              text={paragraph.original_text}
              spans={paragraph.highlighted_spans}
              riskLevel={paragraph.risk_level}
            />
          </p>
        </div>
      </div>

      {/* Rewrite Section */}
      {needsRewrite && (
        <div>
          {!showRewrite ? (
            <button
              type="button"
              onClick={handleRewrite}
              disabled={isRewriting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#0066FF',
                boxShadow: '0 4px 12px rgba(0, 102, 255, 0.3)',
                borderRadius: '12px'
              }}
            >
              {isRewriting ? 'Yeniden yazılıyor...' : 'Daha Etik Hâle Getirilmiş Öneri →'}
            </button>
          ) : rewriteResult ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-[#39FF88]">
                    Daha Etik Hâle Getirilmiş Öneri
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Önce: {paragraph.ethical_score} → Sonra: {rewriteResult.score}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRewrite(false);
                    setRewriteResult(null);
                  }}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <div 
                className="rounded-lg p-4 border"
                style={{ 
                  backgroundColor: '#111726',
                  borderColor: '#39FF88',
                  borderRadius: '12px'
                }}
              >
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                  {rewriteResult.text}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
