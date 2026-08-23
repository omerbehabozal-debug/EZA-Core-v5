/**
 * Browser-native Yansı answer speech. No backend TTS. Never logs spoken text.
 */

export function isYansiSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

export function cancelYansiSpeech(): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export function speakYansiAnswer(text: string): void {
  const spoken = text.trim();
  if (!spoken || !isYansiSpeechSupported()) return;
  cancelYansiSpeech();
  try {
    const utterance = new window.SpeechSynthesisUtterance(spoken);
    utterance.lang = 'tr-TR';
    window.speechSynthesis.speak(utterance);
  } catch {
    /* ignore */
  }
}
