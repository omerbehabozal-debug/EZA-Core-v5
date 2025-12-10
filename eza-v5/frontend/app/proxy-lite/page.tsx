/**
 * Proxy-Lite Page - Premium Modern UX/UI
 * Dark theme with Apple + Anthropic inspired design
 */

"use client";

import { useState } from "react";
import { analyzeLite, ProxyLiteRealResult } from "@/api/proxy_lite";
import CircularRiskScore from "./components/CircularRiskScore";
import RiskBadge from "./components/RiskBadge";
import FlagsPills from "./components/FlagsPills";
import FileUploadButton from "./components/FileUploadButton";

export default function ProxyLitePage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProxyLiteRealResult | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setHasAttempted(true);

    try {
      const res = await analyzeLite(text.trim());
      if (res) {
        setResult(res);
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

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: '#0A0F1F',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div className="max-w-[720px] mx-auto px-4 py-12 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">
            EZA Proxy-Lite
          </h1>
          <p className="text-gray-400 text-lg">
            Hızlı ve temel etik kontrol
          </p>
        </div>

        {/* Input Section */}
        <div 
          className="rounded-2xl p-6 shadow-2xl"
          style={{ backgroundColor: '#111726' }}
        >
          <form onSubmit={handleAnalyze} className="space-y-4">
            {/* Textarea with floating label effect */}
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Analiz etmek istediğiniz içeriği yazın..."
                disabled={loading}
                className="w-full h-40 px-4 py-3 rounded-xl text-white placeholder-gray-500 resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#1A1F2E',
                  border: '1px solid #1A1F2E'
                }}
              />
            </div>

            {/* Upload buttons row */}
            <div className="flex items-center gap-3">
              <FileUploadButton type="audio" />
              <FileUploadButton type="image" />
              <div className="flex-1" />
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={!text.trim() || loading}
              className="w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              style={{
                backgroundColor: '#0066FF',
                boxShadow: loading ? '0 0 20px rgba(0, 102, 255, 0.5)' : '0 4px 12px rgba(0, 102, 255, 0.3)'
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
        {(loading || result) && (
          <div className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#4FC3FF] animate-pulse"></div>
                <span className="text-sm text-gray-400">İşleniyor...</span>
              </>
            ) : result?.live ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#4CAF50]"></div>
                <span className="text-sm text-[#4CAF50]">Canlı veri yüklendi</span>
              </>
            ) : null}
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div 
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: '#1A1F2E',
              borderColor: '#F44336'
            }}
          >
            <p className="text-[#F44336] text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {result && result.live && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Main Results Card */}
            <div 
              className="rounded-2xl p-8 shadow-2xl"
              style={{ backgroundColor: '#111726' }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Circular Risk Score */}
                <div className="flex justify-center md:justify-start">
                  <CircularRiskScore score={result.risk_score} />
                </div>

                {/* Right: Risk Badge & Output */}
                <div className="space-y-6">
                  {/* Risk Badge */}
                  <div>
                    <p className="text-sm text-gray-400 mb-3">Risk Kategorisi</p>
                    <RiskBadge level={result.risk_level} />
                  </div>

                  {/* Output Message */}
                  <div>
                    <p className="text-sm text-gray-400 mb-3">Filtrelenmiş Yanıt</p>
                    <div 
                      className="rounded-xl p-4"
                      style={{ backgroundColor: '#1A1F2E' }}
                    >
                      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                        {result.output}
                      </p>
                    </div>
                  </div>

                  {/* Risk Flags */}
                  {result.flags && result.flags.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-3">Tespit Edilen Riskler</p>
                      <FlagsPills flags={result.flags} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Panel */}
            <div 
              className="rounded-xl p-4 border text-center"
              style={{
                backgroundColor: '#111726',
                borderColor: '#1A1F2E'
              }}
            >
              <p className="text-gray-400 text-sm">
                Daha detaylı analiz için{' '}
                <a 
                  href="/proxy/login" 
                  className="text-[#0066FF] hover:text-[#4FC3FF] transition-colors font-medium"
                >
                  Proxy moduna geç →
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
