"use client";

import { useState } from "react";
import { useChatStore } from "@/stores/chatStore";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  index: number;
  analysis?: any;
}

export default function MessageBubble({ role, text, index, analysis }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const setSelectedMessageIndex = useChatStore((s) => s.setSelectedMessageIndex);
  const selectedIndex = useChatStore((s) => s.selectedMessageIndex);

  const isUser = role === "user";
  const isSelected = selectedIndex === index;

  // Extract quick analysis data
  const intent = analysis?._raw?.intent?.primary || 
                 analysis?._raw?.intent_engine?.primary || 
                 analysis?.intent?.level || null;
  const bias = analysis?._raw?.critical_bias?.level || 
               analysis?.critical_bias?.level || null;
  const safety = analysis?._raw?.reasoning_shield?.final_risk_level || 
                 analysis?.eza_score ? "OK" : null;

  return (
    <div
      className={`w-full flex mb-4 animate-slide-in ${
        isUser ? "justify-end" : "justify-start"
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => {
        if (analysis) {
          setSelectedMessageIndex(isSelected ? null : index);
        }
      }}
    >
      <div className="max-w-[75%] relative group">
        {/* Message Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-200 ${
            isUser
              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
              : "glass text-text border border-panel/50"
          } ${
            isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""
          }`}
          style={{
            boxShadow: isUser
              ? "0 4px 12px rgba(59, 130, 246, 0.3)"
              : "0 4px 12px rgba(0, 0, 0, 0.25)",
          }}
        >
          {text}
        </div>

        {/* Hover Actions */}
        {showActions && analysis && (
          <div className="absolute top-0 right-0 flex gap-1 mt-1 animate-fade-in">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMessageIndex(isSelected ? null : index);
              }}
              className="p-1.5 rounded-lg glass hover:bg-panel/80 transition text-xs"
              title="İçerik Analizi"
            >
              🔍
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMessageIndex(isSelected ? null : index);
              }}
              className="p-1.5 rounded-lg glass hover:bg-panel/80 transition text-xs"
              title="Etik Skor"
            >
              ⚖
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMessageIndex(isSelected ? null : index);
              }}
              className="p-1.5 rounded-lg glass hover:bg-panel/80 transition text-xs"
              title="Bias - Deception - Pressure"
            >
              🧠
            </button>
          </div>
        )}

        {/* Quick Labels */}
        {!isUser && (intent || bias || safety) && (
          <div className="flex gap-2 mt-2 text-xs text-text-dim">
            {intent && (
              <span className="px-2 py-0.5 rounded-full bg-panel/50">
                Intent: {intent}
              </span>
            )}
            {bias && (
              <span className="px-2 py-0.5 rounded-full bg-panel/50">
                Bias: {bias}
              </span>
            )}
            {safety && (
              <span className="px-2 py-0.5 rounded-full bg-panel/50">
                Safety: {safety}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

