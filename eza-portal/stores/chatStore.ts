import { create } from "zustand";

export type Role = "user" | "assistant";

export interface Msg {
  role: Role;
  text: string;
}

export type EngineMode = "standalone" | "proxy" | "fast" | "deep" | "openai";
export type DepthMode = "fast" | "deep";

export type Provider = "openai" | "anthropic" | "mistral" | "llama";

interface ChatState {
  messages: Msg[];
  analysis: any | null;
  selectedMessageIndex: number | null;
  engineMode: EngineMode;
  depthMode: DepthMode;
  provider: Provider;
  addMessage: (m: Msg) => void;
  setAnalysis: (a: any | null) => void;
  setSelectedMessageIndex: (idx: number | null) => void;
  setEngineMode: (m: EngineMode) => void;
  setDepthMode: (m: DepthMode) => void;
  setProvider: (p: Provider) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  analysis: null,
  selectedMessageIndex: null,
  engineMode: "standalone",
  depthMode: "fast",
  provider: "openai",
  addMessage: (m) =>
    set((s) => ({
      messages: [...s.messages, m]
    })),
  setAnalysis: (a) => set(() => ({ analysis: a })),
  setSelectedMessageIndex: (idx) => set(() => ({ selectedMessageIndex: idx })),
  setEngineMode: (m) => set(() => ({ engineMode: m })),
  setDepthMode: (m) => set(() => ({ depthMode: m })),
  setProvider: (p) => set(() => ({ provider: p })),
  reset: () =>
    set({
      messages: [],
      analysis: null,
      selectedMessageIndex: null,
      engineMode: "standalone",
      depthMode: "fast",
      provider: "openai"
    })
}));
