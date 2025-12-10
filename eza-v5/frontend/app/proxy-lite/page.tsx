/**
 * Proxy-Lite Page - Complete Premium Refactor
 * Apple dark/premium design, ethical scoring, paragraph analysis
 */

"use client";

import { useState, useRef } from "react";
import { analyzeLite, LiteAnalysisResponse } from "@/api/proxy_lite";
import { saveAnalysis, getHistory, LiteHistoryItem, clearHistory } from "./lib/storage";
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const analysisResult = await analyzeLite(text.trim(), 'tr');
      
      if (analysisResult && analysisResult.ok) {
        setResult(analysisResult);
        setIsLive(true);
        saveAnalysis(analysisResult, text.trim());
      } else {
        setError("Şu anda analiz hizmetine ulaşılamıyor. Lütfen daha sonra tekrar deneyin.");
        setIsLive(false);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Şu anda analiz hizmetine ulaşılamıyor. Lütfen daha sonra tekrar deneyin.");
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
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950"
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
    >
      <div className="max-w-[720px] mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-slate-50 mb-2">
              EZA Proxy-Lite
            </h1>
            <p className="text-slate-300 text-sm">
              Hızlı ve temel etik kontrol
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all hover:scale-105 shadow-lg"
              style={{ backgroundColor: '#111726' }}
              title="Geçmiş"
            >
              📜
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all hover:scale-105 shadow-lg"
              style={{ backgroundColor: '#111726' }}
              title="Ayarlar"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="text-center">
          <p className="text-slate-400 text-xs">
            Bağımsız, yapay zeka destekli temel etik kontrol
          </p>
        </div>

        {/* Input Card */}
        <div 
          className="rounded-2xl p-6 shadow-lg"
          style={{ backgroundColor: '#111726' }}
        >
          <form onSubmit={handleAnalyze} className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Metninizi buraya yazın veya yapıştırın..."
              disabled={loading || processingAudio || processingImage}
              className="w-full h-40 px-4 py-3 rounded-xl text-slate-50 placeholder-slate-500 resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007aff] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#1A1F2E',
                border: '1px solid #1A1F2E',
              }}
            />

            {/* Upload buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#1A1F2E' }}
                title="Yakında: Ses analizi"
                disabled
              >
                🎤
              </button>
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
                title="Ses Yükle"
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
              className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#007aff',
                boxShadow: loading ? '0 0 20px rgba(0, 122, 255, 0.5)' : '0 4px 12px rgba(0, 122, 255, 0.3)',
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
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#39FF88]' : 'bg-[#FF3B3B]'} animate-pulse`}></div>
            <span className="text-sm text-slate-400">
              {isLive ? 'Canlı veri yüklendi' : 'Şu anda offline, örnek analiz gösteriliyor'}
            </span>
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div 
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: '#1A1F2E',
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
              className="rounded-2xl p-8 shadow-lg"
              style={{ backgroundColor: '#111726' }}
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
                      <ScoreGauge score={result.overall_ethical_score} />
                    </div>

                    {/* Overall Message */}
                    <div className="text-center">
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {result.overall_message}
                      </p>
                    </div>

                    {/* Flags */}
                    {result.paragraph_analyses.some(p => p.risk_labels && p.risk_labels.length > 0) && (
                      <div>
                        <p className="text-sm text-slate-400 mb-3 text-center">Tespit Edilen Etik Sorunlar</p>
                        <div className="flex justify-center">
                          <FlagsPills flags={result.paragraph_analyses.flatMap(p => p.risk_labels || [])} />
                        </div>
                      </div>
                    )}

                    {/* Provider Info */}
                    <div className="text-center">
                      <p className="text-xs text-slate-500">
                        Analiz sağlayıcısı: {result.provider === 'openai' ? 'OpenAI' : result.provider === 'groq' ? 'Groq' : 'Mistral'}
                      </p>
                    </div>
                  </div>
                </TabPanel>

                <TabPanel value="paragraphs">
                  <div className="mt-6 space-y-4">
                    {result.paragraph_analyses.map((para) => (
                      <ParagraphAnalysis key={para.index} paragraph={para} index={para.index} />
                    ))}
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
