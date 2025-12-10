/**
 * Proxy-Lite Page - Apple Soft Light Theme (SAAD)
 * Ethical scoring, paragraph analysis, bulk rewrite
 * Premium, clean, simple, human, and reassuring experience
 */

"use client";

import { useState, useRef } from "react";
import { Clock, Settings as SettingsIcon, Mic, Camera, Loader2 } from "lucide-react";
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

export default function ProxyLitePage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [result, setResult] = useState<LiteAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [paragraphRewrites, setParagraphRewrites] = useState<Map<number, string>>(new Map());
  const [showBulkRewrite, setShowBulkRewrite] = useState(false);
  const [isBulkRewriting, setIsBulkRewriting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setParagraphRewrites(new Map());
    setShowBulkRewrite(false);

    try {
      console.log('[Proxy-Lite] Starting analysis...');
      const analysisResult = await analyzeLite(text.trim(), 'tr');
      
      if (analysisResult) {
        console.log('[Proxy-Lite] Analysis completed successfully');
        setResult(analysisResult);
        setIsLive(true);
        saveAnalysis(analysisResult, text.trim());
      } else {
        console.error('[Proxy-Lite] Analysis returned null');
        setError("Analiz tamamlanamadı. Backend yanıt vermedi. Lütfen backend loglarını kontrol edin.");
        setIsLive(false);
      }
    } catch (err: any) {
      console.error("[Proxy-Lite] Analysis error:", err);
      const errorMessage = err?.message || err?.toString() || "Bilinmeyen hata";
      setError(`Analiz hatası: ${errorMessage}. Backend loglarını kontrol edin.`);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProcessingImage(true);
    setError(null);
    // TODO: Implement image OCR
    alert("Yakında: Görsel analizi");
    setProcessingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProcessingAudio(true);
    setError(null);
    // TODO: Implement audio STT
    alert("Yakında: Ses analizi");
    setProcessingAudio(false);
    if (audioInputRef.current) audioInputRef.current.value = '';
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

  const handleBulkRewrite = async () => {
    if (!result || isBulkRewriting) return;
    
    setIsBulkRewriting(true);
    setShowBulkRewrite(false);
    
    try {
      // Collect all rewrites: use existing rewrite if available, otherwise rewrite the paragraph
      const rewritePromises = result.paragraphs.map(async (para, idx) => {
        // If rewrite already exists, use it
        const existingRewrite = paragraphRewrites.get(idx);
        if (existingRewrite) {
          return existingRewrite;
        }
        
        // Otherwise, rewrite this paragraph
        // Only rewrite if it needs rewrite (score < 76)
        if (para.score >= 76) {
          return para.original; // Already safe, no rewrite needed
        }
        
        try {
          const rewriteResult = await rewriteLite(
            para.original,
            para.issues,
            'tr'
          );
          
          if (rewriteResult && rewriteResult.rewritten_text) {
            // Store the rewrite for future use
            const newRewrites = new Map(paragraphRewrites);
            newRewrites.set(idx, rewriteResult.rewritten_text);
            setParagraphRewrites(newRewrites);
            
            return rewriteResult.rewritten_text;
          } else {
            // If rewrite failed, use original
            return para.original;
          }
        } catch (error) {
          console.error(`[Proxy-Lite] Error rewriting paragraph ${idx + 1}:`, error);
          return para.original; // Fallback to original on error
        }
      });
      
      // Wait for all rewrites to complete
      const rewrittenParagraphs = await Promise.all(rewritePromises);
      const combinedText = rewrittenParagraphs.join('\n\n');
      
      setShowBulkRewrite(true);
      // Store in a ref or state for easy copying
      (window as any).__bulkRewriteText = combinedText;
    } catch (error) {
      console.error('[Proxy-Lite] Error in bulk rewrite:', error);
      setToast({ message: 'Toplu yeniden yazma işlemi başarısız oldu', type: 'error' });
    } finally {
      setIsBulkRewriting(false);
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
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Metninizi buraya yazın veya yapıştırın..."
              disabled={loading || processingAudio || processingImage}
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

            {/* Upload buttons */}
            <div className="flex items-center gap-3">
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                disabled={processingAudio || loading || processingImage}
                className="w-12 h-12 rounded-[14px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E3E3E7',
                }}
                title="Yakında: Ses analizi"
                disabled
              >
                {processingAudio ? (
                  <Loader2 size={18} style={{ color: '#6E6E73' }} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Mic size={18} style={{ color: '#3A3A3C' }} strokeWidth={2} />
                )}
              </button>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={processingImage || loading || processingAudio}
                className="w-12 h-12 rounded-[14px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E3E3E7',
                }}
                title="Yakında: Görsel analizi"
                disabled
              >
                {processingImage ? (
                  <Loader2 size={18} style={{ color: '#6E6E73' }} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Camera size={18} style={{ color: '#3A3A3C' }} strokeWidth={2} />
                )}
              </button>

              <div className="flex-1" />
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={!text.trim() || loading || processingAudio || processingImage}
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
                    {/* Score Gauge - Centered */}
                    <div className="flex justify-center">
                      <ScoreGauge score={result.ethics_score} />
                    </div>

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
                          Etik Sorun Etiketleri
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
                    
                    {/* Bulk Rewrite Button */}
                    {result.paragraphs.length > 0 && (
                      <div className="mt-6 pt-6 border-t" style={{ borderColor: '#E3E3E7' }}>
                        {!showBulkRewrite ? (
                          <button
                            type="button"
                            onClick={handleBulkRewrite}
                            disabled={isBulkRewriting}
                            className="w-full py-4 px-6 rounded-[14px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: '#007AFF',
                              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                              fontWeight: 500,
                              boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
                            }}
                          >
                            {isBulkRewriting ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Tüm paragraflar yeniden yazılıyor...
                              </span>
                            ) : (
                              'Tümünü Etik Hale Getir →'
                            )}
                          </button>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold" style={{ color: '#22BF55' }}>
                                Tümünü Etik Hale Getirilmiş Metin
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowBulkRewrite(false)}
                                className="text-[#6E6E73] text-sm"
                              >
                                ✕
                              </button>
                            </div>
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
