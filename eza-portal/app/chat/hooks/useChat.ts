"use client";

import { useChatStore } from "@/stores/chatStore";

export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const analysis = useChatStore((s) => s.analysis);
  const addMessage = useChatStore((s) => s.addMessage);
  const setAnalysis = useChatStore((s) => s.setAnalysis);

  return {
    messages,
    analysis,
    addMessage,
    setAnalysis,
  };
}

