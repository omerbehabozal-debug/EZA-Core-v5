import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, mode } = await req.json();

    const resp = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: message,
        mode: mode || "standalone"
      })
    });

    if (!resp.ok) {
      return NextResponse.json({
        ok: false,
        error: `Backend error: ${resp.status} ${resp.statusText}`
      });
    }

    const backendData = await resp.json();

    // Backend response formatını frontend'in beklediği formata dönüştür
    const transformedData = {
      // Output text (frontend cleaned_output veya output bekliyor)
      cleaned_output: backendData.rewritten_text || backendData.model_outputs?.chatgpt || "",
      output: backendData.rewritten_text || backendData.model_outputs?.chatgpt || "",
      
      // EZA Score (frontend eza_score bekliyor)
      // Priority: eza_score.eza_score (0-100) > eza_alignment.alignment_score > reasoning_shield.alignment_score > alignment_meta.score
      // Note: eza_score.final_score is 0-1 range, eza_score.eza_score is 0-100 range
      eza_score: (backendData.eza_score?.eza_score !== undefined && backendData.eza_score?.eza_score !== null) ? backendData.eza_score.eza_score :
                 (backendData.eza_score?.final_score !== undefined && backendData.eza_score?.final_score !== null) ? (backendData.eza_score.final_score * 100) :
                 backendData.eza_alignment?.alignment_score ?? 
                 backendData.reasoning_shield?.alignment_score ?? 
                 backendData.alignment_meta?.score ?? 
                 null,
      
      // Intent (frontend intent.level ve intent.summary bekliyor)
      intent: backendData.intent ? {
        level: backendData.intent.primary || backendData.intent_engine?.primary || backendData.risk_level || "unknown",
        summary: backendData.intent.primary || backendData.intent_engine?.primary || "Intent analysis completed",
        score: backendData.intent_score || backendData.intent_engine?.risk_score || 0.0
      } : (backendData.intent_engine ? {
        level: backendData.intent_engine.primary || "unknown",
        summary: backendData.intent_engine.primary || "Intent analysis completed",
        score: backendData.intent_engine.risk_score || 0.0
      } : null),
      
      // Bias and Safety for message bubble labels
      bias: backendData.bias || backendData.critical_bias?.level || "low",
      safety: backendData.safety || backendData.reasoning_shield?.final_risk_level || backendData.risk_level || "low",
      
      // LEVEL 7 – Critical Bias Engine (backend'den geliyor)
      critical_bias: backendData.critical_bias || null,
      
      // LEVEL 9 – Abuse & Coercion Engine (backend'den geliyor)
      abuse: backendData.abuse || null,
      
      // LEVEL 8 – Moral Compass Engine (backend'den geliyor)
      moral_compass: backendData.moral_compass || null,
      
      // LEVEL 10 – Memory Consistency Engine (backend'den geliyor)
      memory_consistency: backendData.memory_consistency || null,
      
      // Level 5-6 modules (backend'den geliyor)
      drift_matrix: backendData.drift_matrix || null,
      eza_score_full: backendData.eza_score || null,
      final_verdict: backendData.final_verdict || null,
      
      // Tüm backend data'yı da ekle (ileride kullanılabilir)
      _raw: backendData
    };

    return NextResponse.json({ ok: true, data: transformedData });

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message || "Unknown error"
    });
  }
}

