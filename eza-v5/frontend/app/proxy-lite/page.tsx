/**
 * Proxy-Lite Page - Apple Soft Light Theme (SAAD)
 * Ethical scoring, paragraph analysis, bulk rewrite
 * Premium, clean, simple, human, and reassuring experience
 */

"use client";

import { useState, useRef } from "react";
import { Clock, Settings as SettingsIcon } from "lucide-react";
import { analyzeLite, LiteAnalysisResponse, rewriteLite } from "@/api/proxy_lite";
import { saveAnalysis, getHistory, LiteHistoryItem } from "./lib/storage";
import { getEthicalScoreColor, getRiskLabelFromLevel } from "./lib/scoringUtils";
import ScoreGauge from "./components/ScoreGauge";
import FlagsPills from "./components/FlagsPills";
import ParagraphAnalysis from "./components/ParagraphAnalysis";
import Tabs, { TabList, Tab, TabPanel } from "./components/Tabs";
import Settings from "./components/Settings";
import HistoryDrawer from "./components/HistoryDrawer";
import Toast from "./components/Toast";
import MediaUploadTabs from "./components/MediaUploadTabs";
import ContextSelector from "./components/ContextSelector";
import TargetAudienceSelector from "./components/TargetAudienceSelector";
import ToneSelector from "./components/ToneSelector";
import EnhancedScoreDisplay from "./components/EnhancedScoreDisplay";
import { useAnalysisStore } from "./store/useAnalysisStore";

export default function ProxyLitePage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LiteAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [paragraphRewrites, setParagraphRewrites] = useState<Map<number, string>>(new Map());
  const [showBulkRewrite, setShowBulkRewrite] = useState(false);
  const [isBulkRewriting, setIsBulkRewriting] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<LiteAnalysisResponse | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  
  const { context, targetAudience, tone, originalText, setOriginalText, setAnalysisResult } = useAnalysisStore();

  // Sync text with store
  const handleTextChange = (newText: string) => {
    setText(newText);
    setOriginalText(newText);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setRewriteResult(null);
    setError(null);
    setParagraphRewrites(new Map());
    setShowBulkRewrite(false);

    try {
      console.log('[Proxy-Lite] Starting analysis...');
      const analysisResult = await analyzeLite(text.trim(), 'tr', undefined, context || undefined, targetAudience || undefined, tone || undefined);
      
      if (analysisResult) {
        console.log('[Proxy-Lite] Analysis completed successfully');
        setResult(analysisResult);
        setAnalysisResult(analysisResult);
        setIsLive(true);
        saveAnalysis(analysisResult, text.trim());
      } else {
        console.error('[Proxy-Lite] Analysis returned null');
        setError("Analiz tamamlanamadı. Backend yanıt vermedi. Lütfen backend'in çalıştığından emin olun (http://localhost:8000/docs).");
        setIsLive(false);
      }
    } catch (err: any) {
      console.error("[Proxy-Lite] Analysis error:", err);
      const errorMessage = err?.message || err?.toString() || "Bilinmeyen hata";
      
      // More specific error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        userFriendlyMessage = 'Backend\'e bağlanılamıyor. Backend\'in çalıştığından emin olun (http://localhost:8000).';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('zaman aşımı')) {
        userFriendlyMessage = 'İstek zaman aşımına uğradı. Lütfen daha kısa bir metin deneyin veya tekrar deneyin.';
      } else if (errorMessage.includes('HTTP 404')) {
        userFriendlyMessage = 'Backend endpoint bulunamadı. Backend API\'sinin doğru yapılandırıldığından emin olun.';
      } else if (errorMessage.includes('HTTP 500')) {
        userFriendlyMessage = 'Backend sunucu hatası. Backend loglarını kontrol edin.';
      }
      
      setError(`Analiz hatası: ${userFriendlyMessage}`);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (entry: LiteHistoryItem) => {
    setResult(entry.analysis);
    setText(entry.text);
    setShowHistory(false);
    setIsLive(true);
    setParagraphRewrites(new Map());
    setShowBulkRewrite(false);
  };

  const handleParagraphRewriteUpdate = (index: number, rewrite: string | null) => {
    const newRewrites = new Map(paragraphRewrites);
    if (rewrite) {
      newRewrites.set(index, rewrite);
    } else {
      newRewrites.delete(index);
    }
    setParagraphRewrites(newRewrites);
  };

  const handleFullRewrite = async () => {
    if (!result || isRewriting) return;
    
    setIsRewriting(true);
    setRewriteResult(null);
    setError(null);
    
    try {
      // Rewrite the full text (not paragraph by paragraph)
      const fullText = result.paragraphs.map(p => p.original).join('\n\n');
      const allIssues = result.unique_issues;
      
      const rewriteResponse = await rewriteLite(fullText, allIssues, 'tr');
      
      if (rewriteResponse && rewriteResponse.rewritten_text) {
        // Auto re-analyze the rewritten text
        const reAnalysisResult = await analyzeLite(
          rewriteResponse.rewritten_text,
          'tr',
          undefined,
          context || undefined,
          targetAudience || undefined,
          tone || undefined
        );
        
        if (reAnalysisResult) {
          setRewriteResult(reAnalysisResult);
          setShowBulkRewrite(true);
          (window as any).__bulkRewriteText = rewriteResponse.rewritten_text;
          setToast({ 
            message: `Yeniden yazma tamamlandı! Orijinal: ${result.ethics_score} → Yeni: ${reAnalysisResult.ethics_score} (${reAnalysisResult.ethics_score > result.ethics_score ? '+' : ''}${reAnalysisResult.ethics_score - result.ethics_score})`, 
            type: 'success' 
          });
        } else {
          setError("Yeniden yazılmış metin analiz edilemedi");
        }
      } else {
        setError("Yeniden yazma başarısız oldu");
      }
    } catch (error) {
      console.error('[Proxy-Lite] Error in full rewrite:', error);
      setError("Yeniden yazma hatası");
      setToast({ message: 'Yeniden yazma işlemi başarısız oldu', type: 'error' });
    } finally {
      setIsRewriting(false);
    }
  };

  const copyBulkRewrite = async () => {
    const text = (window as any).__bulkRewriteText;
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        setToast({ message: 'Metin kopyalandı!', type: 'success' });
      } catch (err) {
        setToast({ message: 'Kopyalama başarısız oldu', type: 'error' });
      }
    }
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: '#F8F9FB',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div className="max-w-[720px] mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 
              className="text-4xl font-bold mb-2"
              style={{ 
                color: '#1C1C1E',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 600
              }}
            >
              EZA Proxy-Lite
            </h1>
            <p className="text-sm" style={{ color: '#6E6E73' }}>
              Hızlı ve temel etik kontrol
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-10 h-10 rounded-[16px] flex items-center justify-center"
              style={{ 
                backgroundColor: '#FFFFFF',
                boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
              }}
              title="Geçmiş"
            >
              <Clock size={18} style={{ color: '#3A3A3C' }} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-[16px] flex items-center justify-center"
              style={{ 
                backgroundColor: '#FFFFFF',
                boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
              }}
              title="Ayarlar"
            >
              <SettingsIcon size={18} style={{ color: '#3A3A3C' }} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="text-center">
          <p className="text-xs" style={{ color: '#6E6E73' }}>
            Bağımsız, yapay zeka destekli temel etik kontrol
          </p>
        </div>

        {/* Input Card */}
        <div 
          className="rounded-[16px] p-6"
          style={{ 
            backgroundColor: '#FFFFFF',
            boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
          }}
        >
          <form onSubmit={handleAnalyze} className="space-y-4">
            {/* Media Upload Tabs */}
            <MediaUploadTabs onTextExtracted={(text) => handleTextChange(text)} />
            
            {/* Text Input */}
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Metninizi buraya yazın veya yapıştırın..."
              disabled={loading}
              className="w-full min-h-[320px] px-4 py-3 rounded-[14px] resize-y transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#F8F9FB',
                border: '1px solid #E3E3E7',
                color: '#1C1C1E',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                lineHeight: '1.5',
                fontSize: '15px',
              }}
            />
            
            {/* Context, Target Audience and Tone Selectors */}
            <div className="grid grid-cols-3 gap-4">
              <ContextSelector />
              <TargetAudienceSelector />
              <ToneSelector />
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={!text.trim() || loading}
              className="w-full py-4 px-6 rounded-[14px] font-semibold text-white transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                backgroundColor: '#007AFF',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 500,
                boxShadow: loading ? '0 0 20px rgba(0, 122, 255, 0.5)' : '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analiz Ediliyor...
                </span>
              ) : (
                'Analiz Et'
              )}
            </button>
          </form>
        </div>

        {/* Status Row */}
        {result && (
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#22BF55]' : 'bg-[#E84343]'} animate-pulse`}></div>
            <span className="text-sm" style={{ color: '#6E6E73' }}>
              {isLive ? 'Canlı veri yüklendi' : 'Şu anda offline, örnek analiz gösteriliyor'}
            </span>
          </div>
        )}

        {/* Success Message */}
        {result && isLive && (
          <div 
            className="rounded-[16px] p-4 border shadow-lg"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#22BF55',
              boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: '#22BF55' }}>✓</span>
              <p className="text-sm font-medium" style={{ color: '#22BF55' }}>
                Analiz tamamlandı — sonuçlar hazır
              </p>
            </div>
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div 
            className="rounded-[16px] p-4 border shadow-lg"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E84343',
              boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: '#E84343' }}>⚠️</span>
              <p className="text-sm font-medium" style={{ color: '#E84343' }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div 
              className="rounded-[16px] p-8"
              style={{ 
                backgroundColor: '#FFFFFF',
                boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
              }}
            >
              <Tabs defaultTab="general">
                <TabList>
                  <Tab value="general">Genel Sonuç</Tab>
                  <Tab value="paragraphs">Paragraf Analizi</Tab>
                </TabList>

                <TabPanel value="general">
                  <div className="mt-6 space-y-6">
                    {/* Enhanced Score Display */}
                    <EnhancedScoreDisplay result={result} />

                    {/* Ethics Level Badge */}
                    <div className="flex justify-center">
                      <span 
                        className="px-4 py-2 rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: `${getEthicalScoreColor(result.ethics_score)}15`,
                          color: getEthicalScoreColor(result.ethics_score),
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                          fontWeight: 500,
                        }}
                      >
                        {getRiskLabelFromLevel(result.ethics_level)}
                      </span>
                    </div>

                    {/* Unique Issues */}
                    {result.unique_issues && result.unique_issues.length > 0 && (
                      <div>
                        <p className="text-sm mb-3 text-center" style={{ color: '#6E6E73' }}>
                          Etik Bulgular
                        </p>
                        <div className="flex justify-center flex-wrap gap-2">
                          <FlagsPills flags={result.unique_issues} />
                        </div>
                      </div>
                    )}

                    {/* Provider Info */}
                    <div className="text-center">
                      <p className="text-xs" style={{ color: '#6E6E73' }}>
                        Analiz {result.provider} tarafından yapılmıştır.
                      </p>
                    </div>
                  </div>
                </TabPanel>

                <TabPanel value="paragraphs">
                  <div className="mt-6 space-y-4">
                    {result.paragraphs.map((para, idx) => (
                      <ParagraphAnalysis
                        key={idx}
                        paragraph={para}
                        index={idx}
                        onRewriteUpdate={handleParagraphRewriteUpdate}
                      />
                    ))}
                    
                    {/* Full Rewrite Button */}
                    {result.paragraphs.length > 0 && (
                      <div className="mt-6 pt-6 border-t" style={{ borderColor: '#E3E3E7' }}>
                        {!showBulkRewrite ? (
                          <button
                            type="button"
                            onClick={handleFullRewrite}
                            disabled={isRewriting}
                            className="w-full py-4 px-6 rounded-[14px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: '#007AFF',
                              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                              fontWeight: 500,
                              boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
                            }}
                          >
                            {isRewriting ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Daha Etik Hale Getiriliyor...
                              </span>
                            ) : (
                              'Daha Etik Hale Getir →'
                            )}
                          </button>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold" style={{ color: '#22BF55' }}>
                                Güvenli ifade önerisi
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowBulkRewrite(false)}
                                className="text-[#6E6E73] text-sm"
                              >
                                ✕
                              </button>
                            </div>
                            
                            {/* Score Comparison */}
                            {rewriteResult && (
                              <div className="mb-4 p-4 rounded-[12px] bg-[#F8F9FB]">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                  <div>
                                    <p className="text-xs text-[#6E6E73] mb-1">Orijinal Skor</p>
                                    <p className="text-2xl font-bold" style={{ color: getEthicalScoreColor(result.ethics_score) }}>
                                      {result.ethics_score}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#6E6E73] mb-1">Yeni Skor</p>
                                    <p className="text-2xl font-bold" style={{ color: getEthicalScoreColor(rewriteResult.ethics_score) }}>
                                      {rewriteResult.ethics_score}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#6E6E73] mb-1">Fark</p>
                                    <p className={`text-2xl font-bold ${rewriteResult.ethics_score > result.ethics_score ? 'text-[#22BF55]' : 'text-[#E84343]'}`}>
                                      {rewriteResult.ethics_score > result.ethics_score ? '+' : ''}{rewriteResult.ethics_score - result.ethics_score}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div 
                              className="rounded-[14px] p-4 border mb-3"
                              style={{ 
                                backgroundColor: '#F8F9FB',
                                borderColor: '#22BF55',
                                borderWidth: '1px',
                              }}
                            >
                              <p className="text-sm leading-[1.4] whitespace-pre-wrap" style={{ color: '#1C1C1E', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                                {(window as any).__bulkRewriteText || ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={copyBulkRewrite}
                              className="w-full py-2 px-4 rounded-[14px] text-sm font-medium text-white transition-opacity duration-200 hover:opacity-90"
                              style={{ 
                                backgroundColor: '#007AFF',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                fontWeight: 500,
                              }}
                            >
                              Kopyala
                            </button>
                            <p className="text-xs mt-2 text-center" style={{ color: '#6E6E73' }}>
                              Bu öneriler yalnızca etik yönlendirme amaçlıdır.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabPanel>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelect={handleHistorySelect}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
