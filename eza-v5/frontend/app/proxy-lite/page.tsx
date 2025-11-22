/**
 * Proxy-Lite Page - Real Backend Only (No Mock)
 */

"use client";

import { useState } from "react";
import { analyzeLite, ProxyLiteRealResult } from "@/api/proxy_lite";
import StatusBadge from "@/components/StatusBadge";

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
        <div className="mt-6 bg-white shadow p-6 rounded-xl">
          <h2 className="font-semibold mb-4 text-lg">Analiz Sonucu</h2>

          <p className="text-4xl font-bold">{result.risk_score}</p>
          <p className="text-gray-600 capitalize">{result.risk_level} risk</p>

          <p className="mt-4 text-gray-700">{result.output}</p>

          {result.flags && result.flags.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-sm mb-2">Risk Flags:</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {result.flags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

