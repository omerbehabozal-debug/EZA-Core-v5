/**
 * Proxy-Lite Page - Final Apple Premium Design
 * Ethical scoring, paragraph analysis, bulk rewrite
 */

"use client";

import { useState, useRef } from "react";
import { analyzeLite, LiteAnalysisResponse } from "@/api/proxy_lite";
import { saveAnalysis, getHistory, LiteHistoryItem } from "./lib/storage";
import { getEthicalScoreColor, getRiskLabelFromLevel } from "./lib/scoringUtils";
import ScoreGauge from "./components/ScoreGauge";
import FlagsPills from "./components/FlagsPills";
import ParagraphAnalysis from "./components/ParagraphAnalysis";
import Tabs, { TabList, Tab, TabPanel } from "./components/Tabs";
import Settings from "./components/Settings";
import HistoryDrawer from "./components/HistoryDrawer";

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

  const handleBulkRewrite = () => {
    if (!result) return;
    
    // Collect all rewrites: use rewrite if available, otherwise use original
    const combinedText = result.paragraphs.map((para, idx) => {
      const rewrite = paragraphRewrites.get(idx);
      return rewrite || para.original;
    }).join('\n\n');
    
    setShowBulkRewrite(true);
    // Store in a ref or state for easy copying
    (window as any).__bulkRewriteText = combinedText;
  };

  const copyBulkRewrite = () => {
    const text = (window as any).__bulkRewriteText;
    if (text) {
      navigator.clipboard.writeText(text);
      alert('Metin kopyalandı!');
    }
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: '#0A0F1F',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div className="max-w-[720px] mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">
              EZA Proxy-Lite
            </h1>
            <p className="text-[#D4D9E5] text-sm">
              Hızlı ve temel etik kontrol
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all hover:scale-105 shadow-lg backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(26, 31, 46, 0.8)' }}
              title="Geçmiş"
            >
              📜
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all hover:scale-105 shadow-lg backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(26, 31, 46, 0.8)' }}
              title="Ayarlar"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="text-center">
          <p className="text-[#D4D9E5] text-xs">
            Bağımsız, yapay zeka destekli temel etik kontrol
          </p>
        </div>

        {/* Input Card */}
        <div 
          className="rounded-2xl p-6 shadow-lg backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(26, 31, 46, 0.8)' }}
        >
          <form onSubmit={handleAnalyze} className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Metninizi buraya yazın veya yapıştırın..."
              disabled={loading || processingAudio || processingImage}
              className="w-full h-40 px-4 py-3 rounded-xl text-white placeholder-[#D4D9E5] resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3A82F7] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#1A1F2E',
                border: '1px solid rgba(58, 130, 247, 0.2)',
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
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#1A1F2E' }}
                title="Yakında: Ses analizi"
                disabled
              >
                {processingAudio ? '⏳' : '🎤'}
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
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#1A1F2E' }}
                title="Yakında: Görsel analizi"
                disabled
              >
                {processingImage ? '⏳' : '📷'}
              </button>

              <div className="flex-1" />
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={!text.trim() || loading || processingAudio || processingImage}
              className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{
                backgroundColor: '#3A82F7',
                boxShadow: loading ? '0 0 20px rgba(58, 130, 247, 0.5)' : '0 4px 12px rgba(58, 130, 247, 0.3)',
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
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#30E171]' : 'bg-[#FF3B3B]'} animate-pulse`}></div>
            <span className="text-sm text-[#D4D9E5]">
              {isLive ? 'Canlı veri yüklendi' : 'Şu anda offline, örnek analiz gösteriliyor'}
            </span>
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div 
            className="rounded-xl p-4 border shadow-lg"
            style={{
              backgroundColor: 'rgba(26, 31, 46, 0.8)',
              borderColor: '#FF3B3B',
            }}
          >
            <p className="text-[#FF3B3B] text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div 
              className="rounded-2xl p-8 shadow-lg backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(26, 31, 46, 0.8)' }}
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
                          backgroundColor: `${getEthicalScoreColor(result.ethics_score)}20`,
                          color: getEthicalScoreColor(result.ethics_score),
                        }}
                      >
                        {getRiskLabelFromLevel(result.ethics_level)}
                      </span>
                    </div>

                    {/* Unique Issues */}
                    {result.unique_issues && result.unique_issues.length > 0 && (
                      <div>
                        <p className="text-sm text-[#D4D9E5] mb-3 text-center">Etik Sorun Etiketleri</p>
                        <div className="flex justify-center flex-wrap gap-2">
                          <FlagsPills flags={result.unique_issues} />
                        </div>
                      </div>
                    )}

                    {/* Provider Info */}
                    <div className="text-center">
                      <p className="text-xs text-[#D4D9E5]">
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
                    {paragraphRewrites.size > 0 && (
                      <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(58, 130, 247, 0.2)' }}>
                        {!showBulkRewrite ? (
                          <button
                            type="button"
                            onClick={handleBulkRewrite}
                            className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all hover:shadow-lg shadow-lg"
                            style={{
                              backgroundColor: '#3A82F7',
                              boxShadow: '0 4px 12px rgba(58, 130, 247, 0.3)',
                            }}
                          >
                            Tümünü Etik Hale Getir
                          </button>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-[#30E171]">
                                Tümünü Etik Hale Getirilmiş Metin
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowBulkRewrite(false)}
                                className="text-[#D4D9E5] hover:text-white text-sm"
                              >
                                ✕
                              </button>
                            </div>
                            <div 
                              className="rounded-xl p-4 border mb-3"
                              style={{ 
                                backgroundColor: '#1A1F2E',
                                borderColor: '#30E171',
                              }}
                            >
                              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                                {(window as any).__bulkRewriteText || ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={copyBulkRewrite}
                              className="w-full py-2 px-4 rounded-xl text-sm font-medium text-white transition-all"
                              style={{ backgroundColor: '#3A82F7' }}
                            >
                              Kopyala
                            </button>
                            <p className="text-xs text-[#D4D9E5] mt-2 text-center">
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
    </div>
  );
}
