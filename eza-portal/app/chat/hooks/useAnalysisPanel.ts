"use client";

import { useState } from "react";
import { useChatStore } from "@/stores/chatStore";

export function useAnalysisPanel() {
  const analysis = useChatStore((s) => s.analysis);
  const selectedMessageIndex = useChatStore((s) => s.selectedMessageIndex);
  const setSelectedMessageIndex = useChatStore((s) => s.setSelectedMessageIndex);
  const [activeTab, setActiveTab] = useState<"overview" | "intent" | "risk" | "bias" | "moral" | "memory">("overview");

  return {
    analysis,
    selectedMessageIndex,
    setSelectedMessageIndex,
    activeTab,
    setActiveTab,
  };
}

