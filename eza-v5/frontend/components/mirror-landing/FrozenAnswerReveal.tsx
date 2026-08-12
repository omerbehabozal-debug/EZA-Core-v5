'use client';

/**
 * Client-only progressive reveal of frozen answer text.
 * Never alters content; respects prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from 'react';

export type FrozenAnswerRevealProps = {
  text: string;
  onComplete: () => void;
  /** chars per tick when animating */
  charsPerTick?: number;
  tickMs?: number;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export default function FrozenAnswerReveal({
  text,
  onComplete,
  charsPerTick = 4,
  tickMs = 16,
}: FrozenAnswerRevealProps) {
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [visible, setVisible] = useState(() =>
    prefersReducedMotion() || text.length <= 24 ? text.length : 0
  );

  useEffect(() => {
    doneRef.current = false;
    setVisible(prefersReducedMotion() || text.length <= 24 ? text.length : 0);
  }, [text]);

  useEffect(() => {
    if (visible >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onCompleteRef.current();
      }
      return;
    }
    const id = window.setTimeout(() => {
      setVisible((n) => Math.min(text.length, n + charsPerTick));
    }, tickMs);
    return () => window.clearTimeout(id);
  }, [visible, text, charsPerTick, tickMs]);

  const done = visible >= text.length;
  const shown = text.slice(0, visible);

  return (
    <span data-testid="frozen-answer-reveal" data-reveal-complete={done ? 'true' : 'false'}>
      {shown}
      {!done ? <span className="opacity-40" aria-hidden>|</span> : null}
    </span>
  );
}
