/**
 * Mirror Intelligence — shareVoice (caption layer 1).
 * Deterministic V1; speaks to the reader, never explains the Mirror.
 */

import type { MirrorSeed } from '@/lib/eza/mirror-network/types';
import type { ShareVoiceLine, ShareVoicePreset } from '@/lib/eza/mirror-share/types';

function mapMoodToPreset(mood: MirrorSeed['mood']): ShareVoicePreset {
  if (mood === 'comparison' || mood === 'planning') {
    return 'clear_confident_direct';
  }
  return 'quiet_editorial_minimal';
}

function buildCaptionLine(seed: MirrorSeed, blob: string): string {
  const topic = seed.topicCategory;

  if (topic === 'travel' && /japan|japonya|kyoto/.test(blob)) {
    return 'Bazı şehirler gündüz değil, akşam anlaşılır.';
  }
  if (topic === 'travel' && /uzbek|özbek|train|tren/.test(blob)) {
    return 'Bazı yollar, varış noktasından önce anlatılır.';
  }
  if (topic === 'travel') {
    return 'Yol bazen cevaptan önce gelir.';
  }
  if (topic === 'architecture') {
    return 'Işık, bir yapının gerçek dilini bazen gece söyler.';
  }
  if (topic === 'vehicle') {
    return 'Uzun yol, düşünceleri sessizce netleştirir.';
  }
  if (topic === 'spiritual_reflection') {
    return 'Sessizlik, bir şehri tanımanın en iyi yollarından biri olabilir.';
  }
  if (topic === 'technology_ai') {
    return 'Bazı sorular, cevap beklerken büyür.';
  }
  if (seed.mood === 'reflection') {
    return 'Merak, doğru anda dinlenince derinleşir.';
  }
  return 'Bazı konular, yürürken daha iyi anlaşılır.';
}

export function buildShareVoice(seed: MirrorSeed, blob: string): ShareVoiceLine {
  const preset = mapMoodToPreset(seed.mood);
  return {
    text: buildCaptionLine(seed, blob),
    preset,
  };
}
