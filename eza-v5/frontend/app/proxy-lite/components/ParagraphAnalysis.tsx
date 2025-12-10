/**
 * Paragraph Analysis Component
 * Shows paragraph-by-paragraph analysis with ethical score and rewrite suggestions
 * NO HIGHLIGHTS - plain text only
 */

'use client';

import { useState } from 'react';
import { ParagraphAnalysis as ParagraphAnalysisType, rewriteLite } from '@/api/proxy_lite';
import { getEthicalScoreColor, getRiskLabel } from '../lib/scoringUtils';
import FlagsPills from './FlagsPills';

interface ParagraphAnalysisProps {
  paragraph: ParagraphAnalysisType;
  index: number;
  onRewriteUpdate?: (index: number, rewrite: string | null) => void;
}

export default function ParagraphAnalysis({ paragraph, index, onRewriteUpdate }: ParagraphAnalysisProps) {
  const [showRewrite, setShowRewrite] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteText, setRewriteText] = useState<string | null>(paragraph.rewrite || null);
  
  const score = paragraph.score;
  const color = getEthicalScoreColor(score);
  const label = getRiskLabel(score);
  const needsRewrite = score < 70; // Only show rewrite for medium/high risk

  const [rewriteResult, setRewriteResult] = useState<{ text: string; improved: boolean; originalScore: number; newScore: number } | null>(null);

  const handleRewrite = async () => {
    if (isRewriting) return;
    
    setIsRewriting(true);
    try {
      const result = await rewriteLite(
        paragraph.original,
        paragraph.issues,
        'tr'
      );
      
      if (result) {
        setRewriteText(result.rewritten_text);
        setRewriteResult({
          text: result.rewritten_text,
          improved: result.improved,
          originalScore: result.original_ethical_score,
          newScore: result.new_ethical_score
        });
        setShowRewrite(true);
        // Notify parent component
        if (onRewriteUpdate) {
          onRewriteUpdate(index, result.rewritten_text);
        }
      } else {
        alert('Yeniden yazma işlemi başarısız oldu. Lütfen tekrar deneyin.');
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
      className="rounded-2xl p-6 mb-4 shadow-lg"
      style={{ backgroundColor: '#111726' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-slate-400">Paragraf {index + 1}</span>
            <span 
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              Etik Skor: {score} ({label})
            </span>
          </div>
          
          {paragraph.issues && paragraph.issues.length > 0 && (
            <div className="mb-3">
              <FlagsPills flags={paragraph.issues} />
            </div>
          )}
        </div>
      </div>

      {/* Original Text - Plain text, NO highlights */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-2">Orijinal Metin</p>
        <div 
          className="rounded-xl p-4"
          style={{ backgroundColor: '#1A1F2E' }}
        >
          <p className="text-slate-50 text-sm leading-relaxed">
            {paragraph.original}
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
                backgroundColor: '#3A82F7',
                boxShadow: '0 4px 12px rgba(58, 130, 247, 0.3)',
              }}
            >
              {isRewriting ? 'Yeniden yazılıyor...' : 'Daha Etik Hâle Getirilmiş Öneri →'}
            </button>
          ) : rewriteText ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={`text-xs font-semibold ${rewriteResult?.improved ? 'text-[#30E171]' : 'text-[#F6A302]'}`}>
                    {rewriteResult?.improved ? 'Daha Etik Hâle Getirilmiş Öneri' : 'Yeniden Yazılmış Metin'}
                  </p>
                  {rewriteResult && (
                    <p className="text-xs text-slate-400 mt-1">
                      Önce: {rewriteResult.originalScore} → Sonra: {rewriteResult.newScore}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRewrite(false);
                    setRewriteResult(null);
                  }}
                  className="text-slate-400 hover:text-slate-50 text-sm"
                >
                  ✕
                </button>
              </div>
              {!rewriteResult?.improved && (
                <div className="mb-2 p-2 rounded-lg bg-[#F6A302]20 border border-[#F6A302]">
                  <p className="text-xs text-[#F6A302]">
                    ⚠️ Bu öneri etik skorunu iyileştirmedi. Metni gözden geçirmeniz önerilir.
                  </p>
                </div>
              )}
              <div 
                className="rounded-xl p-4 border"
                style={{ 
                  backgroundColor: '#1A1F2E',
                  borderColor: rewriteResult?.improved ? '#30E171' : '#F6A302',
                }}
              >
                <p className="text-slate-50 text-sm leading-relaxed whitespace-pre-wrap">
                  {rewriteText}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
