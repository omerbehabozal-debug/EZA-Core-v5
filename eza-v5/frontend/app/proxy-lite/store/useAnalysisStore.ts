/**
 * Zustand Store for Proxy-Lite Analysis
 * Manages input type, platform, tone, CTA preferences, and analysis results
 */

import { create } from 'zustand';
import { LiteAnalysisResponse } from '@/api/proxy_lite';

export type InputType = 'text' | 'audio' | 'image' | 'video';
export type Context = 'social_media' | 'corporate_professional' | 'legal_official' | 'educational_informative' | 'personal_blog' | null;
export type TargetAudience = 'general_public' | 'clients_consultants' | 'students' | 'children_youth' | 'colleagues' | 'regulators_public' | null;
export type Tone = 'neutral' | 'professional' | 'friendly' | 'funny' | 'persuasive' | 'strict_warning' | null;
export type CTAType = 'follow' | 'comment' | 'opinion' | null;

interface AnalysisState {
  // Input configuration
  inputType: InputType;
  context: Context;
  targetAudience: TargetAudience;
  tone: Tone;
  ctaEnabled: boolean;
  ctaType: CTAType;
  isPremium: boolean;
  
  // Analysis data
  analysisResult: LiteAnalysisResponse | null;
  originalText: string;
  rewrittenText: string | null;
  rewriteScore: number | null;
  
  // History
  history: Array<{
    id: string;
    createdAt: string;
    title: string;
    text: string;
    analysis: LiteAnalysisResponse;
    tags: string[];
  }>;
  
  // Actions
  setInputType: (type: InputType) => void;
  setContext: (context: Context) => void;
  setTargetAudience: (audience: TargetAudience) => void;
  setTone: (tone: Tone) => void;
  setCtaEnabled: (enabled: boolean) => void;
  setCtaType: (type: CTAType) => void;
  setAnalysisResult: (result: LiteAnalysisResponse | null) => void;
  setOriginalText: (text: string) => void;
  setRewrittenText: (text: string | null) => void;
  setRewriteScore: (score: number | null) => void;
  addToHistory: (entry: {
    id: string;
    createdAt: string;
    title: string;
    text: string;
    analysis: LiteAnalysisResponse;
    tags: string[];
  }) => void;
  clearHistory: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  // Initial state
  inputType: 'text',
  context: null,
  targetAudience: null,
  tone: null,
  ctaEnabled: false,
  ctaType: null,
  isPremium: true, // Default to premium for now
  analysisResult: null,
  originalText: '',
  rewrittenText: null,
  rewriteScore: null,
  history: [],
  
  // Actions
  setInputType: (type) => set({ inputType: type }),
  setContext: (context) => set({ context }),
  setTargetAudience: (audience) => set({ targetAudience: audience }),
  setTone: (tone) => set({ tone }),
  setCtaEnabled: (enabled) => set({ ctaEnabled: enabled }),
  setCtaType: (type) => set({ ctaType: type }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setOriginalText: (text) => set({ originalText: text }),
  setRewrittenText: (text) => set({ rewrittenText: text }),
  setRewriteScore: (score) => set({ rewriteScore: score }),
  addToHistory: (entry) => set((state) => ({
    history: [entry, ...state.history].slice(0, 20) // Keep last 20
  })),
  clearHistory: () => set({ history: [] }),
}));

