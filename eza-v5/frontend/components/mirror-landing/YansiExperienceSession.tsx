'use client';

/**
 * Mode A only — Audio + Rhythm session for published Yansı experience.
 * Not mounted on continuation (/sohbet) or standalone new chat.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  readYansiRhythm,
  resolveYansiRevealPace,
  writeYansiRhythm,
  type YansiRevealPace,
  type YansiRhythmId,
} from '@/lib/eza/mirror/yansiRhythm';
import {
  cancelYansiSpeech,
  isYansiSpeechSupported,
  speakYansiAnswer,
} from '@/lib/eza/mirror/yansiSpeech';

type YansiExperienceSessionValue = {
  slug: string;
  audioOn: boolean;
  setAudioOn: (on: boolean) => void;
  rhythm: YansiRhythmId;
  setRhythm: (next: YansiRhythmId) => void;
  speechSupported: boolean;
  revealPace: YansiRevealPace;
  notifyAnswerRevealed: (answerText: string) => void;
  registerRevealedAnswer: (answerText: string) => void;
};

const YansiExperienceSessionContext = createContext<YansiExperienceSessionValue | null>(
  null
);

export function useYansiExperienceSession(): YansiExperienceSessionValue | null {
  return useContext(YansiExperienceSessionContext);
}

export function YansiExperienceSessionProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const [audioOn, setAudioOnState] = useState(false);
  const [rhythm, setRhythmState] = useState<YansiRhythmId>(() => readYansiRhythm());
  const speechSupported = isYansiSpeechSupported();
  const latestAnswerRef = useRef<string | null>(null);
  const audioOnRef = useRef(false);
  audioOnRef.current = audioOn;

  const setAudioOn = useCallback((on: boolean) => {
    if (!isYansiSpeechSupported()) return;
    setAudioOnState(on);
    if (!on) {
      cancelYansiSpeech();
      return;
    }
    const latest = latestAnswerRef.current;
    if (latest) speakYansiAnswer(latest);
  }, []);

  const setRhythm = useCallback((next: YansiRhythmId) => {
    setRhythmState(next);
    writeYansiRhythm(next);
  }, []);

  const notifyAnswerRevealed = useCallback((answerText: string) => {
    const spoken = answerText.trim();
    if (!spoken) return;
    latestAnswerRef.current = spoken;
    if (audioOnRef.current) speakYansiAnswer(spoken);
  }, []);

  const registerRevealedAnswer = useCallback((answerText: string) => {
    const spoken = answerText.trim();
    if (!spoken) return;
    latestAnswerRef.current = spoken;
  }, []);

  useEffect(() => {
    return () => {
      cancelYansiSpeech();
    };
  }, [slug]);

  const revealPace = useMemo(
    () => resolveYansiRevealPace(rhythm, reducedMotion),
    [rhythm, reducedMotion]
  );

  const value = useMemo(
    () => ({
      slug,
      audioOn,
      setAudioOn,
      rhythm,
      setRhythm,
      speechSupported,
      revealPace,
      notifyAnswerRevealed,
      registerRevealedAnswer,
    }),
    [
      slug,
      audioOn,
      setAudioOn,
      rhythm,
      setRhythm,
      speechSupported,
      revealPace,
      notifyAnswerRevealed,
      registerRevealedAnswer,
    ]
  );

  return (
    <YansiExperienceSessionContext.Provider value={value}>
      {children}
    </YansiExperienceSessionContext.Provider>
  );
}
