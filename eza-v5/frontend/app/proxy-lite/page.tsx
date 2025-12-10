/**
 * Proxy-Lite Page - Real Backend Only (No Mock)
 */

"use client";

import { useState } from "react";
import { analyzeLite, ProxyLiteRealResult } from "@/api/proxy_lite";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "./components/ScoreBadge";
import RiskLevelTag from "./components/RiskLevelTag";

export default function ProxyLitePage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProxyLiteRealResult | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setResult(null);
    setHasAttempted(true);

    try {
      const res = await analyzeLite(text.trim());
      setResult(res);
    } catch (err) {
      console.error("Analysis error:", err);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 md:px-10 py-10 max-w-4xl mx-auto">
      <h1 className="text-center text-3xl font-bold">EZA Proxy-Lite</h1>
      <p className="text-center text-gray-500 mb-8">Hızlı ve temel etik kontrol.</p>

      <form onSubmit={handleAnalyze}>
        <textarea 
          className="w-full border rounded-lg p-4"
          placeholder="Analiz etmek istediğiniz içeriği yazın..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />

        <button 
          type="submit"
          className="mt-4 w-full bg-blue-600 text-white font-semibold rounded-lg p-3 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!text.trim() || loading}
        >
          {loading ? "Analiz Ediliyor..." : "Analiz Et"}
        </button>
      </form>

      {/* Backend Offline Warning */}
      {result === null && !loading && hasAttempted && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm font-medium">
            Backend şu anda devre dışı. Analiz yapılamadı.
          </p>
        </div>
      )}

      {/* Status Badge */}
      {(loading || result) && (
        <div className="mt-6">
          <StatusBadge
            loading={loading}
            live={result?.live}
          />
        </div>
      )}

      {/* Result - Only show when we have real backend data */}
      {result && result.live && (
        <div className="mt-6 space-y-6">
          {/* Main Score Card */}
          <div className="bg-white shadow-lg p-6 rounded-xl">
            <h2 className="font-semibold mb-6 text-xl">Analiz Sonucu</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">Etik Skor</p>
                <ScoreBadge score={Math.round(result.risk_score)} />
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">Risk Seviyesi</p>
                <RiskLevelTag 
                  level={(result.risk_level.toLowerCase() as 'low' | 'medium' | 'high' | 'critical') || 'low'} 
                />
              </div>
            </div>

            {/* LLM Output */}
            <div className="mb-6">
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Model Yanıtı</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.output}</p>
              </div>
            </div>

            {/* Risk Flags */}
            {result.flags && result.flags.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3">Tespit Edilen Riskler</h3>
                <div className="flex flex-wrap gap-2">
                  {result.flags.map((flag, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Analysis from Backend */}
            {result.raw?.analysis && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3">Detaylı Analiz</h3>
                
                {/* Input Analysis */}
                {result.raw.analysis.input && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-xs text-blue-900 mb-2">Girdi Analizi</h4>
                    <div className="text-xs text-blue-800 space-y-1">
                      {result.raw.analysis.input.risk_score !== undefined && (
                        <p>Risk Skoru: {result.raw.analysis.input.risk_score.toFixed(2)}</p>
                      )}
                      {result.raw.analysis.input.intent && (
                        <p>Niyet: {result.raw.analysis.input.intent}</p>
                      )}
                      {result.raw.analysis.input.text_length && (
                        <p>Metin Uzunluğu: {result.raw.analysis.input.text_length} karakter</p>
                      )}
                    </div>
                  </div>
                )}

                {/* EZA Score Details */}
                {result.raw.analysis.eza_score && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-xs text-green-900 mb-2">EZA Skor Detayları</h4>
                    <div className="text-xs text-green-800 space-y-1">
                      {result.raw.analysis.eza_score.final_score !== undefined && (
                        <p>Final Skor: {result.raw.analysis.eza_score.final_score.toFixed(2)}</p>
                      )}
                      {result.raw.analysis.eza_score.user_score !== undefined && (
                        <p>Kullanıcı Skoru: {result.raw.analysis.eza_score.user_score.toFixed(2)}</p>
                      )}
                      {result.raw.analysis.eza_score.output_score !== undefined && (
                        <p>Çıktı Skoru: {result.raw.analysis.eza_score.output_score.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Policy Result */}
                {result.raw.policy_result && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-xs text-purple-900 mb-2">Politika Değerlendirmesi</h4>
                    <div className="text-xs text-purple-800 space-y-1">
                      {result.raw.policy_result.violated_rules && result.raw.policy_result.violated_rules.length > 0 && (
                        <div>
                          <p className="font-semibold mb-1">İhlal Edilen Kurallar ({result.raw.policy_result.violated_rules.length}):</p>
                          <ul className="list-disc list-inside ml-2">
                            {result.raw.policy_result.violated_rules.map((rule: any, idx: number) => (
                              <li key={idx}>{rule.rule_name || rule}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.raw.policy_result.compliance_score !== undefined && (
                        <p>Uyum Skoru: {(result.raw.policy_result.compliance_score * 100).toFixed(1)}%</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

