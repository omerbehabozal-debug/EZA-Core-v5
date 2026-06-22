/**
 * V5 — Layer A output: short render brief from Mirror Intelligence payload.
 */

import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import type {
  MirrorLightMode,
  MirrorRenderBrief,
  MirrorSafetyMode,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import {
  MIRROR_V5_DEFAULT_LIGHT_MODE,
  MIRROR_V5_SHOW_SUBTITLE_ON_POSTER,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import { inferStoryTopicFromEvidence } from '@/lib/eza/mirror/conversationMirrorV3/shotDirectorV43';

function evidenceBlob(evidence: readonly ConversationEvidence[]): string {
  return evidence.map((item) => `${item.label} ${item.visualHint}`).join(' ').toLowerCase();
}

function contextBlob(payload: SainaMirrorV3Payload): string {
  return [
    payload.selectedTopic,
    payload.topic,
    ...(payload.visualKeywords ?? []),
    evidenceBlob(payload.conversationEvidence ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

function sanitizeMood(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .replace(/\bcinematic\b/gi, 'editorial')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

const LIGHT_MODE_BY_TOPIC: Record<StoryTopicId, MirrorLightMode> = {
  travel: 'golden_hour_travel',
  architecture: 'soft_architectural_daylight',
  health: 'clean_health_daylight',
  technology_ai: 'modern_technology_light',
  vehicle: 'golden_hour_road',
  spiritual_reflection: 'contemplative_morning',
  finance: 'premium_editorial_daylight',
  food_culture: 'premium_editorial_daylight',
  family: 'premium_editorial_daylight',
  education: 'premium_editorial_daylight',
  general_curiosity: MIRROR_V5_DEFAULT_LIGHT_MODE,
};

function resolveEffectiveTopicId(payload: SainaMirrorV3Payload): StoryTopicId {
  const blob = contextBlob(payload);
  if (
    /product|ürün|urun|shopping|mvp|startup/.test(blob) &&
    !/\bai\b|artificial intelligence|yapay zeka|technology_ai/.test(blob)
  ) {
    return 'general_curiosity';
  }
  return inferStoryTopicFromEvidence(
    payload.storyTopicId,
    payload.conversationEvidence ?? [],
    payload.selectedTopic
  );
}

function resolveLightMode(topicId: StoryTopicId, blob: string): MirrorLightMode {
  if (
    /product|ürün|urun|shopping|mvp|startup/.test(blob) &&
    !/\bai\b|artificial intelligence|yapay zeka/.test(blob)
  ) {
    return MIRROR_V5_DEFAULT_LIGHT_MODE;
  }
  if (topicId === 'travel' && /night|evening|gece|lantern|fener/.test(blob)) {
    return 'quiet_luxury_evening';
  }
  return LIGHT_MODE_BY_TOPIC[topicId] ?? MIRROR_V5_DEFAULT_LIGHT_MODE;
}

function resolveSafetyMode(topicId: StoryTopicId, blob: string): MirrorSafetyMode {
  if (/thyroid|guatr|tiroid|neck|boyun|hormon/.test(blob)) return 'abstract_safe';
  if (topicId === 'health') return 'normal';
  return 'normal';
}

export function resolvePublicTopicHint(topicId: StoryTopicId, blob: string): string {
  if (topicId === 'travel') {
    if (/uzbek|özbek|samarkand|semerkant|buhara|silk/.test(blob)) {
      return 'Uzbekistan train route atmosphere';
    }
    if (/japan|japonya|kyoto|tokyo|gion/.test(blob)) {
      return 'Japan travel atmosphere';
    }
    return 'Travel atmosphere';
  }
  if (topicId === 'health') {
    if (/thyroid|guatr|tiroid/.test(blob)) return 'Thyroid health curiosity';
    return 'Health wellness curiosity';
  }
  if (topicId === 'architecture') return 'Architecture material study';
  if (topicId === 'technology_ai') return 'AI trust question';
  if (topicId === 'vehicle') return 'Long road car comparison';
  if (topicId === 'spiritual_reflection') return 'Quiet spiritual reflection';
  if (topicId === 'finance') return 'Financial decision curiosity';
  if (topicId === 'food_culture') return 'Food culture mood';
  if (topicId === 'family') return 'Home and family warmth';
  if (topicId === 'education') return 'Learning curiosity';
  if (/product|ürün|urun|startup|mvp|shopping/.test(blob)) return 'Product idea curiosity';
  return 'Everyday curiosity';
}

export function resolveVisualDirection(
  topicId: StoryTopicId,
  blob: string,
  mood?: string
): string {
  const moodTail = mood ? ` Mood: ${mood}.` : '';

  if (topicId === 'travel') {
    if (/uzbek|özbek|samarkand|semerkant|buhara/.test(blob)) {
      return `A luminous Central Asian rail journey mood with quiet travel curiosity.${moodTail}`;
    }
    return `A luminous travel mood with open space and quiet curiosity — emotion through light, not darkness.${moodTail}`;
  }
  if (topicId === 'health') {
    if (/thyroid|guatr|tiroid/.test(blob)) {
      return 'A clean health editorial with sensitive neck-area focus — calm, dignified, never alarming.';
    }
    return 'A clean health editorial with clarity, care, and natural light.';
  }
  if (topicId === 'architecture') {
    return 'A refined architectural scene shaped by stone, proportion, and soft daylight.';
  }
  if (topicId === 'technology_ai') {
    return 'A bright human-centered technology workspace — thoughtful, modern, no robot clichés.';
  }
  if (topicId === 'vehicle') {
    return 'A premium road mood with elegant motion and comparison energy — lifestyle, not showroom.';
  }
  if (topicId === 'spiritual_reflection') {
    return 'A serene contemplative atmosphere — morning or warm sunset, respectful and quiet.';
  }
  if (/product|ürün|urun|startup/.test(blob)) {
    return 'A bright product-thinking mood — curiosity about what could be built next.';
  }
  return `A premium editorial mood with natural light and elegant negative space.${moodTail}`;
}

export function buildMirrorRenderBrief(payload: SainaMirrorV3Payload): MirrorRenderBrief {
  const blob = contextBlob(payload);
  const topicId = resolveEffectiveTopicId(payload);
  const mood = sanitizeMood(payload.emotionalAtmosphere ?? payload.emotion);

  return {
    title: payload.mirrorTitle,
    topicCategory: topicId,
    mood,
    publicTopicHint: resolvePublicTopicHint(topicId, blob),
    visualDirection: resolveVisualDirection(topicId, blob, mood),
    lightMode: resolveLightMode(topicId, blob),
    locale: 'tr',
    safetyMode: resolveSafetyMode(topicId, blob),
    showSubtitleOnPoster: MIRROR_V5_SHOW_SUBTITLE_ON_POSTER,
  };
}
