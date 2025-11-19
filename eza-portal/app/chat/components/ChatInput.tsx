"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const [placeholder, setPlaceholder] = useState("Mesaj yaz...");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setAnalysis = useChatStore((s) => s.setAnalysis);
  const engineMode = useChatStore((s) => s.engineMode);
  const provider = useChatStore((s) => s.provider);
  const [loading, setLoading] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Animated placeholder
  useEffect(() => {
    const placeholders = [
      "Mesaj yaz...",
      "EZA'ya sor...",
      "Etik analiz için metin girin...",
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % placeholders.length;
      setPlaceholder(placeholders[index]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function send() {
    if (!message.trim() || loading) return;

    const text = message.trim();
    const userMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    addMessage({ 
      id: userMessageId,
      role: "user", 
      text,
      timestamp: Date.now()
    });
    setMessage("");
    setLoading(true);

    try {
      // Determine endpoint based on mode
      let endpoint = "/api/analyze";  // Default fallback
      if (engineMode === "standalone") {
        endpoint = "/api/standalone_chat";
      } else if (engineMode === "proxy") {
        endpoint = "/api/proxy_chat";
      } else if (engineMode === "proxy_fast") {
        endpoint = "/api/proxy_fast";
      } else if (engineMode === "proxy_deep") {
        endpoint = "/api/proxy_deep";
      }

      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: text,
          mode: engineMode
        })
      });

      const j = await r.json();

      if (j.ok) {
        // Backend response format (from pipeline_runner or route wrapper)
        // Some routes return { ok: true, data: {...} }, others return { ok: true, ... } directly
        const backendData = j.data || j;
        
        // Extract analysis data for messages (both user and assistant)
        // Handle intent: can be string or object {level, summary, score}
        const intentValue = typeof backendData.intent === "string" 
          ? backendData.intent 
          : (backendData.intent?.level || backendData.intent?.summary || "information");
        const intentScoreValue = backendData.intent_score ?? 
                                 (typeof backendData.intent === "object" ? backendData.intent?.score : null) ?? 
                                 0.0;
        
        const messageAnalysis = {
          eza_score: backendData.analysis?.eza_score?.eza_score ?? 
                     (backendData.analysis?.eza_score?.final_score ? backendData.analysis.eza_score.final_score * 100 : null) ??
                     backendData.eza_score_value ??
                     null,
          risk_level: backendData.risk_level || "low",
          intent: intentValue,
          intent_score: intentScoreValue,
          bias: backendData.bias || "low",
          safety: backendData.safety || "low",
          rationale: backendData.analysis?.final?.explanation || backendData.analysis?.final?.reason,
          flags: backendData.risk_flags || [],
          // Add EZA Score v2.1 breakdown
          eza_score_breakdown: backendData.analysis?.eza_score_breakdown || backendData.analysis?.eza_score?.breakdown,
          eza_score_meta: backendData.analysis?.eza_score_meta || backendData.analysis?.eza_score?.meta,
        };

        // Update user message with analysis
        updateMessage(userMessageId, {
          analysis: messageAnalysis
        });

        // Add audit log entry for user message
        useChatStore.getState().addAuditLogEntry(messageAnalysis);
        
        // Get assistant text - check multiple possible fields
        // Note: proxy_chat/route.ts returns llm_output, not text
        const assistantText = backendData.llm_output || 
                             backendData.text || 
                             backendData.output || 
                             backendData.cleaned_output || 
                             "EZA bir yanıt üretti.";
        
        // Check if it's an LLM error and show user-friendly message
        const displayText = assistantText.includes("[LLM Error") 
          ? "⚠️ LLM çağrısı başarısız oldu. Lütfen birkaç dakika bekleyip tekrar deneyin veya API key'inizi kontrol edin."
          : assistantText;
        
        // Extract output analysis for assistant message (if available)
        const assistantAnalysis = backendData.output_analysis ? {
          eza_score: backendData.output_analysis.eza_score ?? null,
          risk_level: backendData.output_analysis.risk_level || "low",
          intent: backendData.output_analysis.intent || "information",
          intent_score: 0.0,
          bias: "low",
          safety: backendData.output_analysis.risk_level || "low",
          rationale: backendData.analysis?.final?.explanation || backendData.analysis?.final?.reason,
          flags: backendData.output_analysis.risk_flags || []
        } : messageAnalysis;  // Fallback to input analysis if output analysis not available
        
        const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        addMessage({ 
          id: assistantMessageId,
          role: "assistant", 
          text: displayText,
          timestamp: Date.now(),
          analysis: assistantAnalysis
        });
        
        // Full analysis for right panel
        const fullAnalysis = {
          ...backendData,
          _raw: backendData
        };
        setAnalysis(fullAnalysis);
        
        // Add audit entry
        useChatStore.getState().addAuditEntry({
          timestamp: new Date().toISOString(),
          message_id: assistantMessageId,
          analysis_snapshot: fullAnalysis
        });
        
        // Add audit log entry for assistant message
        useChatStore.getState().addAuditLogEntry(messageAnalysis);
        
        // Auto-select last assistant message
        useChatStore.getState().setSelectedMessageId(assistantMessageId);
      } else {
        const errorMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        addMessage({
          id: errorMessageId,
          role: "assistant",
          text: `Hata: ${j.error || "EZA-Core analiz API yanıt vermedi."}`,
          timestamp: Date.now()
        });
      }
    } catch (err: any) {
      const errorMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      addMessage({
        id: errorMessageId,
        role: "assistant",
        text: `İstek sırasında hata oluştu: ${err?.message ?? "bilinmiyor"}`,
        timestamp: Date.now()
      });
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.trim() && !loading) {
        send();
      }
    }
  };

  return (
    <div className="p-4 border-t border-panel/50 glass-strong">
      <div className="flex items-end gap-3 max-w-6xl mx-auto">
        {/* Mode Indicator (Left) */}
        <div className="hidden md:flex flex-col items-center gap-1 text-xs text-text-dim">
          <div className="w-8 h-8 rounded-full bg-panel/50 flex items-center justify-center">
            {engineMode === "proxy_deep" && "🔵"}
            {engineMode === "proxy" && "🟡"}
            {engineMode === "proxy_fast" && "⚡"}
            {engineMode === "standalone" && "⚪"}
          </div>
          <span className="text-[10px]">
            {engineMode === "proxy_deep" && "Deep"}
            {engineMode === "proxy" && "Normal"}
            {engineMode === "proxy_fast" && "Fast"}
            {engineMode === "standalone" && "Standalone"}
          </span>
        </div>

        {/* Input Area */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full px-4 py-3 pr-12 rounded-2xl bg-panel/50 border border-panel/50 text-text placeholder:text-text-dim resize-none outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all duration-200"
            disabled={loading}
            style={{
              minHeight: "48px",
              maxHeight: "120px",
            }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={send}
          disabled={loading || !message.trim()}
          className={`px-6 py-3 rounded-2xl font-medium text-sm transition-all duration-200 ${
            message.trim() && !loading
              ? "bg-accent text-bg shadow-accent-glow hover:shadow-accent-glow/80"
              : "bg-panel/50 text-text-dim cursor-not-allowed"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Gönderiliyor...
            </span>
          ) : (
            "Gönder"
          )}
        </button>
      </div>
    </div>
  );
}

