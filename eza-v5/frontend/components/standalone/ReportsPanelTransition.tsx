'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const PANEL_MS = 280;

interface ReportsPanelTransitionProps {
  activeKey: string;
  className?: string;
  children: (key: string) => React.ReactNode;
}

/**
 * Aşama 2 — sekme paneli: fade + blur + hafif y (premium, sakin).
 * prefers-reduced-motion: anında geçiş.
 */
export default function ReportsPanelTransition({
  activeKey,
  className,
  children,
}: ReportsPanelTransitionProps) {
  const reducedMotion = useReducedMotion();
  const [shownKey, setShownKey] = useState(activeKey);
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (activeKey === shownKey) return;

    if (reducedMotion) {
      setShownKey(activeKey);
      setPhase('idle');
      return;
    }

    setPhase('exit');
    const exitId = window.setTimeout(() => {
      setShownKey(activeKey);
      setPhase('enter');
      const enterId = window.setTimeout(() => setPhase('idle'), PANEL_MS);
      timersRef.current.push(enterId);
    }, PANEL_MS);
    timersRef.current.push(exitId);

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [activeKey, shownKey, reducedMotion]);

  const motionClass =
    phase === 'exit' ? 'eza-panel-exit' : phase === 'enter' ? 'eza-panel-enter' : '';

  return (
    <div
      className={cn('eza-panel-stage', motionClass, className)}
      aria-live="polite"
      aria-busy={phase !== 'idle'}
    >
      {children(shownKey)}
    </div>
  );
}
