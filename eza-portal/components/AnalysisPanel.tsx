"use client";

import { useChatStore } from "@/stores/chatStore";

export default function AnalysisPanel() {
  const analysis = useChatStore((s) => s.analysis);
  const engineMode = useChatStore((s) => s.engineMode);
  const depthMode = useChatStore((s) => s.depthMode);

  if (!analysis) {
    return (
      <div className="w-full p-4">
        <div className="text-neutral-500 text-sm">
          ⓘ Analiz sonuçları burada görünecek.
        </div>
      </div>
    );
  }

  // Standalone mod: eski /analyze response
  if (engineMode === "standalone") {
    // Backend'den gelen raw data'yı kontrol et
    const rawData = analysis._raw || analysis;
    
    return (
      <div className="w-full p-4 space-y-4">
        {/* EZA Score */}
        <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
          <h3 className="text-neutral-300 text-sm">EZA Skoru</h3>
          <p className="text-2xl font-semibold mt-1">
            {analysis.eza_score?.eza_score ?? analysis.eza_score ?? rawData.eza_alignment?.alignment_score ?? rawData.reasoning_shield?.alignment_score ?? "—"}
          </p>
          {rawData.reasoning_shield && (
            <p className="text-neutral-400 text-xs mt-1">
              Risk Level: {rawData.reasoning_shield.final_risk_level ?? rawData.risk_level ?? "—"}
            </p>
          )}
        </div>

        {/* Intent */}
        {(analysis.intent || rawData.intent || rawData.intent_engine) && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">Niyet Analizi</h3>
            <p className="text-lg font-medium mt-1">
              {analysis.intent?.level ?? rawData.intent?.primary ?? rawData.intent_engine?.primary ?? rawData.risk_level ?? "—"}
            </p>
            <p className="text-neutral-400 text-xs mt-1">
              {analysis.intent?.summary ?? rawData.intent?.primary ?? "Intent analysis completed"}
            </p>
            {rawData.intent_engine && (
              <p className="text-neutral-400 text-xs mt-1">
                Risk Score: {rawData.intent_engine.risk_score ?? rawData.risk_score ?? "—"}
              </p>
            )}
          </div>
        )}

        {/* LEVEL 7 – Critical Bias Engine */}
        {(analysis.critical_bias || rawData.critical_bias) && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">LEVEL 7 – Critical Bias</h3>
            <p className="text-lg font-medium mt-1">
              {(analysis.critical_bias || rawData.critical_bias)?.level ?? "—"}
            </p>
            <p className="text-neutral-400 text-xs mt-1">
              Skor: {(analysis.critical_bias || rawData.critical_bias)?.bias_score ?? "—"}
            </p>
            {(analysis.critical_bias || rawData.critical_bias)?.summary && (
              <p className="text-neutral-400 text-xs mt-1">
                {(analysis.critical_bias || rawData.critical_bias).summary}
              </p>
            )}
          </div>
        )}

        {/* LEVEL 9 – Abuse & Coercion Engine */}
        {(analysis.abuse || rawData.abuse) && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">LEVEL 9 – Abuse & Coercion</h3>
            <p className="text-lg font-medium mt-1">
              {(analysis.abuse || rawData.abuse)?.level ?? "—"}
            </p>
            {(analysis.abuse || rawData.abuse)?.score !== undefined && (
              <p className="text-neutral-400 text-xs mt-1">
                Skor: {(analysis.abuse || rawData.abuse).score}
              </p>
            )}
            {(analysis.abuse || rawData.abuse)?.summary && (
              <p className="text-neutral-400 text-xs mt-1">
                {(analysis.abuse || rawData.abuse).summary}
              </p>
            )}
          </div>
        )}

        {/* LEVEL 8 – Moral Compass Engine */}
        {(analysis.moral_compass || rawData.moral_compass) && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">LEVEL 8 – Moral Compass</h3>
            <p className="text-lg font-medium mt-1">
              {(analysis.moral_compass || rawData.moral_compass)?.level ?? "—"}
            </p>
            {(analysis.moral_compass || rawData.moral_compass)?.score !== undefined && (
              <p className="text-neutral-400 text-xs mt-1">
                Skor: {(analysis.moral_compass || rawData.moral_compass).score}
              </p>
            )}
            {(analysis.moral_compass || rawData.moral_compass)?.summary && (
              <p className="text-neutral-400 text-xs mt-1">
                {(analysis.moral_compass || rawData.moral_compass).summary}
              </p>
            )}
          </div>
        )}

        {/* LEVEL 10 – Memory Consistency Engine */}
        {(analysis.memory_consistency || rawData.memory_consistency) && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">LEVEL 10 – Memory Consistency</h3>
            <p className="text-lg font-medium mt-1">
              {(analysis.memory_consistency || rawData.memory_consistency)?.level ?? "—"}
            </p>
            {(analysis.memory_consistency || rawData.memory_consistency)?.score !== undefined && (
              <p className="text-neutral-400 text-xs mt-1">
                Skor: {(analysis.memory_consistency || rawData.memory_consistency).score}
              </p>
            )}
            {(analysis.memory_consistency || rawData.memory_consistency)?.summary && (
              <p className="text-neutral-400 text-xs mt-1">
                {(analysis.memory_consistency || rawData.memory_consistency).summary}
              </p>
            )}
          </div>
        )}

        {/* Additional Level 5-6 modules */}
        {rawData.drift_matrix && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">Drift Matrix</h3>
            <p className="text-neutral-400 text-xs mt-1">
              {rawData.drift_matrix.summary || "Drift analysis completed"}
            </p>
          </div>
        )}

        {/* Level 5 – EZA Score */}
        {(rawData.eza_score || analysis.eza_score_full) && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">EZA Score (Level 5)</h3>
            <p className="text-lg font-medium mt-1">
              {(rawData.eza_score || analysis.eza_score_full)?.eza_score ?? 
               (rawData.eza_score || analysis.eza_score_full)?.score ?? "—"}
            </p>
            {(rawData.eza_score || analysis.eza_score_full)?.summary && (
              <p className="text-neutral-400 text-xs mt-1">
                {(rawData.eza_score || analysis.eza_score_full).summary}
              </p>
            )}
          </div>
        )}

        {/* Level 5 – Final Verdict */}
        {(rawData.final_verdict || analysis.final_verdict) && (
          <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow">
            <h3 className="text-neutral-300 text-sm">Final Verdict (Level 5)</h3>
            <p className="text-lg font-medium mt-1">
              {(rawData.final_verdict || analysis.final_verdict)?.level ?? "—"}
            </p>
            {(rawData.final_verdict || analysis.final_verdict)?.reason && (
              <p className="text-neutral-400 text-xs mt-1">
                {(rawData.final_verdict || analysis.final_verdict).reason}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Proxy mode analizi: input + output
  const input = analysis.input_analysis;
  const output = analysis.output_analysis;
  const inputRaw = input?._raw || input;
  const outputRaw = output?._raw || output;

  return (
    <div className="w-full p-4 space-y-4">
      <h2 className="text-lg font-semibold mb-2">
        Etik Analiz (Proxy — {depthMode.toUpperCase()})
      </h2>

      {/* Input analizi */}
      {input && (
        <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow space-y-2">
          <h3 className="text-neutral-300 text-sm font-semibold">Input Analizi</h3>
          <div>
            <p className="text-xs text-neutral-400">EZA Skoru</p>
            <p className="text-lg font-medium">
              {input.eza_score?.eza_score ?? input.eza_score ?? inputRaw?.eza_alignment?.alignment_score ?? inputRaw?.eza_score?.eza_score ?? "—"}
            </p>
          </div>
          {input.intent && (
            <div>
              <p className="text-xs text-neutral-400">Niyet</p>
              <p className="text-sm">{input.intent.level ?? inputRaw?.intent?.primary ?? "—"}</p>
            </div>
          )}
          {/* LEVEL 9 – Abuse */}
          {(input.abuse || inputRaw?.abuse) && (
            <div>
              <p className="text-xs text-neutral-400">LEVEL 9 – Abuse</p>
              <p className="text-sm">{(input.abuse || inputRaw?.abuse)?.level ?? "—"}</p>
            </div>
          )}
          {/* LEVEL 7 – Critical Bias */}
          {(input.critical_bias || inputRaw?.critical_bias) && (
            <div>
              <p className="text-xs text-neutral-400">LEVEL 7 – Critical Bias</p>
              <p className="text-sm">{(input.critical_bias || inputRaw?.critical_bias)?.level ?? "—"}</p>
            </div>
          )}
          {/* LEVEL 8 – Moral Compass */}
          {(input.moral_compass || inputRaw?.moral_compass) && (
            <div>
              <p className="text-xs text-neutral-400">LEVEL 8 – Moral Compass</p>
              <p className="text-sm">{(input.moral_compass || inputRaw?.moral_compass)?.level ?? "—"}</p>
            </div>
          )}
        </div>
      )}

      {/* Output analizi */}
      {output ? (
        <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow space-y-2">
          <h3 className="text-neutral-300 text-sm font-semibold">Output Analizi</h3>
          <div>
            <p className="text-xs text-neutral-400">EZA Skoru</p>
            <p className="text-lg font-medium">
              {output.eza_score?.eza_score ?? output.eza_score ?? outputRaw?.eza_alignment?.alignment_score ?? outputRaw?.eza_score?.eza_score ?? "—"}
            </p>
          </div>
          {output.intent && (
            <div>
              <p className="text-xs text-neutral-400">Niyet</p>
              <p className="text-sm">{output.intent.level ?? outputRaw?.intent?.primary ?? "—"}</p>
            </div>
          )}
          {/* LEVEL 9 – Abuse */}
          {(output.abuse || outputRaw?.abuse) && (
            <div>
              <p className="text-xs text-neutral-400">LEVEL 9 – Abuse</p>
              <p className="text-sm">{(output.abuse || outputRaw?.abuse)?.level ?? "—"}</p>
            </div>
          )}
          {/* LEVEL 7 – Critical Bias */}
          {(output.critical_bias || outputRaw?.critical_bias) && (
            <div>
              <p className="text-xs text-neutral-400">LEVEL 7 – Critical Bias</p>
              <p className="text-sm">{(output.critical_bias || outputRaw?.critical_bias)?.level ?? "—"}</p>
            </div>
          )}
          {/* LEVEL 8 – Moral Compass */}
          {(output.moral_compass || outputRaw?.moral_compass) && (
            <div>
              <p className="text-xs text-neutral-400">LEVEL 8 – Moral Compass</p>
              <p className="text-sm">{(output.moral_compass || outputRaw?.moral_compass)?.level ?? "—"}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#111418] border border-neutral-800 p-4 rounded-xl shadow text-neutral-400 text-xs">
          {depthMode === "fast"
            ? "Fast Mode: Çıkış analizi minimal veya atlanmış olabilir."
            : "Output analizi mevcut değil."}
        </div>
      )}
    </div>
  );
}

