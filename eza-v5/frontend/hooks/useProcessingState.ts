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

// State to message mapping
const STATE_MESSAGES: Record<ProcessingState, string> = {
  idle: '',
  receiving_input: 'İçerik alındı',
  evaluating_context: 'Bağlam değerlendiriliyor',
  measuring_risk: 'Risk sinyalleri ölçülüyor',
  checking_policy: 'Politika uyumu kontrol ediliyor',
  preparing_results: 'Sonuçlar hazırlanıyor',
  generating_rewrite: 'Anlam korunarak alternatifler oluşturuluyor',
};

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
      if (config.action === 'rewrite' && REWRITE_STATE_MESSAGES[state]) {
        return REWRITE_STATE_MESSAGES[state]!;
      }
      return STATE_MESSAGES[state] || '';
    },
    [config.action]
  );

  const start = useCallback(() => {
    if (isActiveRef.current) return; // Prevent double start

    isActiveRef.current = true;
    stateIndexRef.current = -1;
    setState('idle');

    // Start state progression
    const flow = getFlow();
    const transitionDelay = 500 + Math.random() * 400; // 500-900ms

    const progressState = () => {
      stateIndexRef.current += 1;

      if (stateIndexRef.current >= flow.length) {
        // Flow complete, but keep showing last state until explicitly stopped
        return;
      }

      const nextState = flow[stateIndexRef.current];
      setState(nextState);
      setCurrentMessage(getMessage(nextState));

      // Schedule next transition
      if (stateIndexRef.current < flow.length - 1) {
        intervalRef.current = setTimeout(progressState, transitionDelay);
      }
    };

    // Start immediately
    progressState();
  }, [getFlow, getMessage]);

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

