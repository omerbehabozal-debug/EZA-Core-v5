/**
 * Paragraph Analysis Component - Apple Soft Light Theme
 * Shows paragraph-by-paragraph analysis with ethical score and rewrite suggestions
 * NO HIGHLIGHTS - plain text only, frame color changes based on risk
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
  const needsRewrite = score < 76; // Show rewrite for medium/high risk (0-75)

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

  // Determine frame border color based on score
  const getFrameBorderColor = () => {
    if (score >= 76) return '#22BF55'; // Green for low risk
    if (score >= 51) return '#F4A72F'; // Orange for medium risk
    return '#E84343'; // Red for high risk
  };

  return (
    <div 
      className="rounded-[12px] sm:rounded-[16px] p-4 sm:p-5 md:p-6 mb-3 sm:mb-4"
      style={{ 
        backgroundColor: '#FFFFFF',
        boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
        border: `1px solid ${getFrameBorderColor()}40`,
      }}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
            <span className="text-xs sm:text-sm font-medium text-[#6E6E73]" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
              Paragraf {index + 1}
            </span>
            <span 
              className="px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: `${color}15`,
                color: color,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 700,
              }}
            >
              Etik Skor: {score}
            </span>
          </div>
          
          {paragraph.issues && paragraph.issues.length > 0 && (
            <div className="mb-2 sm:mb-3">
              <FlagsPills flags={paragraph.issues} />
            </div>
          )}
        </div>
      </div>

      {/* Original Text - Plain text, NO highlights, frame color based on risk */}
      <div className="mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-xs text-[#6E6E73] mb-1.5 sm:mb-2" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
          Orijinal Metin
        </p>
        <div 
          className="rounded-[12px] sm:rounded-[14px] p-3 sm:p-4 border"
          style={{ 
            backgroundColor: '#F8F9FB',
            borderColor: getFrameBorderColor(),
            borderWidth: '1px',
          }}
        >
          <p className="text-[#1C1C1E] text-xs sm:text-sm leading-[1.4] break-words whitespace-pre-wrap" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
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
              className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-[12px] sm:rounded-[14px] text-xs sm:text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 active:opacity-75 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              style={{ 
                backgroundColor: '#007AFF',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 500,
                boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
              }}
            >
              {isRewriting ? 'Yeniden yazılıyor...' : 'Daha Etik Hâle Getirilmiş Öneri →'}
            </button>
          ) : rewriteText ? (
            <div>
              <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
                <div className="flex-1 min-w-0">
                  <p 
                    className={`text-[10px] sm:text-xs font-semibold ${rewriteResult?.improved ? 'text-[#22BF55]' : 'text-[#F4A72F]'}`}
                    style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', fontWeight: 500 }}
                  >
                    {rewriteResult?.improved ? 'Daha Etik Hâle Getirilmiş Öneri' : 'Yeniden Yazılmış Metin'}
                  </p>
                  {rewriteResult && (
                    <p className="text-[10px] sm:text-xs text-[#6E6E73] mt-0.5 sm:mt-1" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
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
                  className="text-[#6E6E73] text-sm sm:text-base flex-shrink-0 touch-manipulation"
                >
                  ✕
                </button>
              </div>
              {!rewriteResult?.improved && (
                <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: '#F4A72F15', border: '1px solid #F4A72F40' }}>
                  <p className="text-[10px] sm:text-xs text-[#F4A72F]" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    ⚠️ Bu öneri etik skorunu iyileştirmedi. Metni gözden geçirmeniz önerilir.
                  </p>
                </div>
              )}
              <div 
                className="rounded-[12px] sm:rounded-[14px] p-3 sm:p-4 border"
                style={{ 
                  backgroundColor: '#F8F9FB',
                  borderColor: rewriteResult?.improved ? '#22BF55' : '#F4A72F',
                  borderWidth: '1px',
                }}
              >
                <p className="text-[#1C1C1E] text-xs sm:text-sm leading-[1.4] whitespace-pre-wrap break-words" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
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
