"use client";

import { useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import AnalysisPanel from "./AnalysisPanel";
import ModeSwitcher from "./ModeSwitcher";

export default function ChatLayout() {
  const messages = useChatStore((s) => s.messages);
  const analysis = useChatStore((s) => s.analysis);
  const selectedMessageIndex = useChatStore((s) => s.selectedMessageIndex);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get analysis for each message (simplified - in real app, store analysis per message)
  // For now, we show analysis for the last assistant message
  const getMessageAnalysis = (index: number) => {
    const msg = messages[index];
    // Show analysis for the last assistant message that has analysis
    if (msg.role === "assistant" && index === messages.length - 1 && analysis) {
      return analysis;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-panel/50 glass-strong">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-accent-soft bg-clip-text text-transparent">
            EZA Portal
          </h1>
          <span className="hidden md:inline text-xs text-text-dim px-2 py-1 rounded-full bg-panel/50">
            Premium UI v1.0
          </span>
        </div>
        <ModeSwitcher />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 rounded-full bg-panel/30 flex items-center justify-center mb-4">
                  <span className="text-4xl">⚖</span>
                </div>
                <h2 className="text-xl font-semibold text-text mb-2">
                  EZA Portal'a Hoş Geldiniz
                </h2>
                <p className="text-text-dim text-sm max-w-md">
                  Etik analiz için mesaj göndermek için aşağıdaki alanı kullanın.
                  <br />
                  Mesajlarınız otomatik olarak analiz edilecek ve sağ panelde detaylı sonuçlar görüntülenecektir.
                </p>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    role={m.role}
                    text={m.text}
                    index={i}
                    analysis={getMessageAnalysis(i)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <ChatInput />
        </div>

        {/* Analysis Panel - Desktop */}
        <div className="hidden lg:block w-[400px] border-l border-panel/50 bg-bg-light overflow-hidden">
          <AnalysisPanel />
        </div>

        {/* Analysis Panel - Mobile Bottom Sheet */}
        {selectedMessageIndex !== null && analysis && (
          <>
            <div
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => useChatStore.getState().setSelectedMessageIndex(null)}
            />
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-light border-t border-panel/50 rounded-t-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-panel/50">
                <h2 className="text-lg font-semibold">Etik Analiz</h2>
                <button
                  onClick={() => useChatStore.getState().setSelectedMessageIndex(null)}
                  className="text-text-dim hover:text-text"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <AnalysisPanel />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

