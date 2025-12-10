/**
 * Proxy-Lite Page - Complete Premium Refactor
 * Ethical scoring, paragraph analysis, bulk rewrite, history
 */

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { analyzeText, analyzeImage, analyzeAudio, ProxyLiteAnalysisResponse } from "@/api/proxy_lite";
import { analyzeLite } from "@/api/proxy_lite"; // Legacy fallback
import { convertToParagraphAnalysis } from "./lib/analyzeHelper";
import { saveAnalysis } from "./lib/storage";
import { getEthicalScoreColor, getRiskLabelFromLevel } from "./lib/scoringUtils";
import ScoreGauge from "./components/ScoreGauge";
import FlagsPills from "./components/FlagsPills";
import ParagraphAnalysis from "./components/ParagraphAnalysis";
import Tabs, { TabList, Tab, TabPanel } from "./components/Tabs";
import Settings from "./components/Settings";
import HistoryDrawer from "./components/HistoryDrawer";
import { AnalysisHistory } from "./lib/storage";

export default function ProxyLitePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [result, setResult] = useState<ProxyLiteAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRewrite, setShowRewrite] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setShowRewrite(false);

    try {
      // Try new endpoint first
      let analysisResult: ProxyLiteAnalysisResponse | null = await analyzeText(text.trim());
      
      // Fallback to legacy if new endpoint not available
      if (!analysisResult) {
        const legacyResult = await analyzeLite(text.trim());
        if (legacyResult && legacyResult.live) {
          analysisResult = await convertToParagraphAnalysis(text.trim(), legacyResult);
        }
      }

      if (analysisResult) {
        setResult(analysisResult);
        saveAnalysis(analysisResult, text.trim());
      } else {
        setError("Sunucu ile bağlantı kurulamadı");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Sunucu ile bağlantı kurulamadı");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    setError(null);
    try {
      const { text: extractedText, analysis } = await analyzeImage(file);
      if (extractedText) {
        setText(extractedText);
        if (analysis) {
          setResult(analysis);
          saveAnalysis(analysis, extractedText);
        }
      } else {
        setError("Görsel işlenemedi");
      }
    } catch (err) {
      console.error("Image processing error:", err);
      setError("Görsel işlenemedi");
    } finally {
      setProcessingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingAudio(true);
    setError(null);
    try {
      const { text: extractedText, analysis } = await analyzeAudio(file);
      if (extractedText) {
        setText(extractedText);
        if (analysis) {
          setResult(analysis);
          saveAnalysis(analysis, extractedText);
        }
      } else {
        setError("Ses dosyası işlenemedi");
      }
    } catch (err) {
      console.error("Audio processing error:", err);
      setError("Ses dosyası işlenemedi");
    } finally {
      setProcessingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const handleHistorySelect = (entry: AnalysisHistory) => {
    setResult(entry.result as ProxyLiteAnalysisResponse);
    setText(entry.title);
    setShowHistory(false);
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
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">
              EZA Proxy-Lite
            </h1>
            <p className="text-gray-400 text-lg">
              Hızlı ve temel etik kontrol
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-105"
              style={{ backgroundColor: '#111726' }}
              title="Geçmiş"
            >
              📜
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-105"
              style={{ backgroundColor: '#111726' }}
              title="Ayarlar"
            >
              ⚙️
            </button>
          </div>
        </div>


        {/* Input Section */}
        <div 
          className="rounded-xl p-6 shadow-2xl"
          style={{ backgroundColor: '#111726', borderRadius: '12px' }}
        >
          <form onSubmit={handleAnalyze} className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Analiz etmek istediğiniz içeriği yazın..."
              disabled={loading || processingAudio || processingImage}
              className="w-full h-40 px-4 py-3 rounded-xl text-white placeholder-gray-500 resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#1A1F2E',
                border: '1px solid #1A1F2E',
                borderRadius: '12px'
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
                style={{ backgroundColor: '#1A1F2E', borderRadius: '12px' }}
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
                style={{ backgroundColor: '#1A1F2E', borderRadius: '12px' }}
                title="Görsel Yükle"
              >
                {processingImage ? '⏳' : '📷'}
              </button>

              <div className="flex-1" />
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={!text.trim() || loading || processingAudio || processingImage}
              className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              style={{
                backgroundColor: '#0066FF',
                boxShadow: loading ? '0 0 20px rgba(0, 102, 255, 0.5)' : '0 4px 12px rgba(0, 102, 255, 0.3)',
                borderRadius: '12px'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 102, 255, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 102, 255, 0.3)';
                }
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
        {loading && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4FC3FF] animate-pulse"></div>
            <span className="text-sm text-gray-400">İşleniyor...</span>
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div 
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: '#1A1F2E',
              borderColor: '#FF3B3B',
              borderRadius: '12px'
            }}
          >
            <p className="text-[#FF3B3B] text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div 
              className="rounded-xl p-8 shadow-2xl"
              style={{ backgroundColor: '#111726', borderRadius: '12px' }}
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
                      <ScoreGauge score={result.ethic_score} />
                    </div>
                    
                    {/* Risk Level Badge */}
                    <div className="flex justify-center">
                      <span 
                        className="px-4 py-2 rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: `${getEthicalScoreColor(result.ethic_score)}20`,
                          color: getEthicalScoreColor(result.ethic_score),
                        }}
                      >
                        {getRiskLabelFromLevel(result.risk_level)}
                      </span>
                    </div>

                    {/* Flags */}
                    {result.flags && result.flags.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-400 mb-3 text-center">Tespit Edilen Etik Sorunlar</p>
                        <div className="flex justify-center">
                          <FlagsPills flags={result.flags} />
                        </div>
                      </div>
                    )}

                    {/* Proxy CTA - Only if score < 100 */}
                    {result.ethic_score < 100 && (
                      <div 
                        className="rounded-xl p-4 text-center border"
                        style={{
                          backgroundColor: '#1A1F2E',
                          borderColor: '#1A1F2E',
                          borderRadius: '12px'
                        }}
                      >
                        <p className="text-gray-400 text-sm">
                          Tam güvenli değil →{' '}
                          <a 
                            href="/proxy/login" 
                            className="text-[#0066FF] hover:text-[#4FC3FF] transition-colors font-medium"
                          >
                            Proxy moduna geç
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </TabPanel>

                <TabPanel value="paragraphs">
                  <div className="mt-6 space-y-4">
                    {result.paragraphs.map((para) => (
                      <ParagraphAnalysis
                        key={para.index}
                        paragraph={para}
                        index={para.index}
                      />
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
