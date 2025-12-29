/**
 * Processing State Hook
 * Semantic processing state management for Proxy actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ProcessingState =
  | 'idle'
  | 'receiving_input'
  | 'evaluating_context'
  | 'measuring_risk'
  | 'checking_policy'
  | 'preparing_results'
  | 'generating_rewrite';

interface ProcessingStateConfig {
  action: 'analyze' | 'rewrite';
  analysis_mode?: 'fast' | 'pro';  // NEW: Analysis mode for message differentiation
  onComplete?: () => void;
  onError?: () => void;
}

// State flow definitions
const ANALYZE_FLOW: ProcessingState[] = [
  'receiving_input',
  'evaluating_context',
  'measuring_risk',
  'checking_policy',
  'preparing_results',
];

const REWRITE_FLOW: ProcessingState[] = [
  'evaluating_context',
  'measuring_risk',
  'generating_rewrite',
  'preparing_results',
];

// State to message mapping (FAST mode - default)
const STATE_MESSAGES_FAST: Record<ProcessingState, string> = {
  idle: '',
  receiving_input: 'İçerik alındı',
  evaluating_context: 'Bağlam değerlendiriliyor',
  measuring_risk: 'Risk sinyalleri ölçülüyor',
  checking_policy: 'Politika uyumu kontrol ediliyor',
  preparing_results: 'Sonuçlar hazırlanıyor',
  generating_rewrite: 'Hızlı yeniden yazım önerisi hazırlanıyor',
};

// State to message mapping (PRO mode - professional)
const STATE_MESSAGES_PRO: Record<ProcessingState, string> = {
  idle: '',
  receiving_input: 'İçerik alındı',
  evaluating_context: 'Bağlam ve risk gerekçeleri değerlendiriliyor…',
  measuring_risk: 'Derin risk analizi yapılıyor',
  checking_policy: 'Politika uyumu ve bağlam kontrol ediliyor',
  preparing_results: 'Profesyonel analiz tamamlanıyor',
  generating_rewrite: 'Profesyonel yeniden yazım hazırlanıyor…',
};

// Legacy mapping for backward compatibility
const STATE_MESSAGES: Record<ProcessingState, string> = STATE_MESSAGES_FAST;

// Rewrite-specific messages (override for rewrite action)
const REWRITE_STATE_MESSAGES: Partial<Record<ProcessingState, string>> = {
  evaluating_context: 'Anlatım dengesi değerlendiriliyor',
  measuring_risk: 'Riskli ifadeler yeniden ele alınıyor',
  generating_rewrite: 'Anlam korunarak alternatifler oluşturuluyor',
  preparing_results: 'Öneri hazırlanıyor',
};

export function useProcessingState(config: ProcessingStateConfig) {
  const [state, setState] = useState<ProcessingState>('idle');
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const stateIndexRef = useRef<number>(-1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef<boolean>(false);

  const getFlow = useCallback(() => {
    return config.action === 'analyze' ? ANALYZE_FLOW : REWRITE_FLOW;
  }, [config.action]);

  const getMessage = useCallback(
    (state: ProcessingState): string => {
      // PRO mode messages (if analysis_mode is 'pro')
      if (config.analysis_mode === 'pro') {
        if (config.action === 'rewrite' && REWRITE_STATE_MESSAGES[state]) {
          return REWRITE_STATE_MESSAGES[state]!;
        }
        return STATE_MESSAGES_PRO[state] || '';
      }
      
      // FAST mode messages (default)
      if (config.action === 'rewrite' && REWRITE_STATE_MESSAGES[state]) {
        return REWRITE_STATE_MESSAGES[state]!;
      }
      return STATE_MESSAGES_FAST[state] || '';
    },
    [config.action, config.analysis_mode]
  );

  const start = useCallback(() => {
    if (isActiveRef.current) {
      console.log('[ProcessingState] Already active, skipping start');
      return; // Prevent double start
    }

    console.log('[ProcessingState] Starting...', config.action);
    isActiveRef.current = true;
    stateIndexRef.current = -1;
    
    // Start state progression immediately
    const flow = getFlow();
    console.log('[ProcessingState] Flow:', flow);
    
    const progressState = () => {
      stateIndexRef.current += 1;

      if (stateIndexRef.current >= flow.length) {
        // Flow complete - cycle through last 3 states to keep user engaged
        // This prevents the "stuck" feeling when backend takes longer
        const lastStates = flow.slice(-3); // Last 3 states
        const cycleIndex = (stateIndexRef.current - flow.length) % lastStates.length;
        const nextState = lastStates[cycleIndex];
        const message = getMessage(nextState);
        
        console.log('[ProcessingState] Cycling through final states:', nextState, 'message:', message);
        
        setState(() => nextState);
        setCurrentMessage(() => message);

        // Continue cycling every 1.5-2 seconds (slower than initial progression)
        const cycleDelay = 1500 + Math.random() * 500;
        intervalRef.current = setTimeout(progressState, cycleDelay);
        return;
      }

      const nextState = flow[stateIndexRef.current];
      const message = getMessage(nextState);
      
      console.log('[ProcessingState] Setting state:', nextState, 'message:', message);
      
      // Use functional updates to ensure state is set correctly
      setState(() => nextState);
      setCurrentMessage(() => message);

      // Schedule next transition with random delay (500-900ms)
      if (stateIndexRef.current < flow.length - 1) {
        // Normal progression - faster transitions
        const transitionDelay = 500 + Math.random() * 400;
        console.log('[ProcessingState] Scheduling next transition in', transitionDelay, 'ms');
        intervalRef.current = setTimeout(progressState, transitionDelay);
      } else {
        // Last state before cycling - slightly longer delay before starting cycle
        const transitionDelay = 800 + Math.random() * 400;
        console.log('[ProcessingState] Reaching final state, will start cycling in', transitionDelay, 'ms');
        intervalRef.current = setTimeout(progressState, transitionDelay);
      }
    };

    // Start immediately with first state
    progressState();
  }, [getFlow, getMessage, config.action]);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
    setState('idle');
    setCurrentMessage('');
    stateIndexRef.current = -1;
  }, []);

  const reset = useCallback(() => {
    stop();
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  return {
    state,
    message: currentMessage,
    isProcessing: state !== 'idle',
    start,
    stop,
    reset,
  };
}

