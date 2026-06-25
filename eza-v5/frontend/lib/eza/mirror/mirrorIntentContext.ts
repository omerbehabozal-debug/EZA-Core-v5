/**
 * Single source for Mirror intent lock + live debug (Sprint 12B live wiring).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  deriveConversationVisualIntent,
  type ConversationVisualIntent,
} from '@/lib/eza/mirror/conversationVisualIntent';
import {
  collectIntentCueBlob,
  extractVehicleHighlightLabels,
  getIntentLockForbiddenPhrases,
  resolveLockedPrimaryIntent,
  type LockedPrimaryIntentId,
  type VehicleHighlightLabels,
} from '@/lib/eza/mirror/intentLockSystem';
import { buildContextualHighlight, type ContextualHighlight } from '@/lib/eza/mirror/contextualHighlight';
import {
  deriveReflectionSignals,
  inferMicroMood,
  type ReflectionSignals,
  type TopicStoryVariantId,
} from '@/lib/eza/mirror/reflectionSignals';
import type { ReflectionToneId } from '@/lib/eza/mirror/reflectionToneEngine';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import { inferSceneTopicKey } from '@/lib/eza/mirror/visualPromptEngine';
import { resolveHeroObject } from '@/lib/eza/mirror/heroObjectRegistry';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import type { ConversationVisualIntentId } from '@/lib/eza/mirror/sceneIntentTypes';
import {
  validateVehicleComparisonPrompt,
  VEHICLE_SCENE_CONTRACT_ID,
} from '@/lib/eza/mirror/vehicleSceneContract';
import { resolvePosterPalette } from '@/lib/eza/mirror/posterPaletteSystem';
import {
  analyzeHybridPromptMarkers,
  detectPromptTruncationRisk,
  inferUsedPromptType,
  isMockSceneImageUrl,
} from '@/lib/eza/mirror/hybridPosterDebug';
import { resolveCardRenderMode } from '@/lib/eza/mirror/mirrorPosterLayout';
import {
  buildMirrorV5RenderDebugTrace,
  formatMirrorV5RenderDebugTrace,
} from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorV5DebugTrace';
import { formatMirrorPhilosophyCheck } from '@/lib/eza/mirror-network/philosophy';
import {
  getHybridEnvDebug,
  isHybridEnabled,
  resolveMirrorRenderMode,
} from '@/lib/eza/mirror/mirrorRenderMode';

export type MirrorIntentContext = {
  cueBlob: string;
  lockedIntent: LockedPrimaryIntentId;
  conversationIntent: ConversationVisualIntent;
  primaryIntentId: ConversationVisualIntentId;
  composition: ConversationVisualIntent['composition'];
  heroObjectPhrase: string;
  vehicleLabels: VehicleHighlightLabels | null;
  intentFingerprint: string;
};

function hashFingerprint(parts: (string | null | undefined)[]): string {
  let h = 0;
  const s = parts.filter(Boolean).join('|');
  for (let i = 0; i < s.length; i += 1) {
    h = (h + s.charCodeAt(i) * (i + 17)) | 0;
  }
  return `mirror-intent-${Math.abs(h).toString(36)}`;
}

export function resolveMirrorIntentContext(input: {
  entries: SavedBehavioralEntry[];
  topicKey?: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  reflectionSignals?: ReflectionSignals;
  reflectionTone?: ReflectionToneId;
  personaFamilyId?: import('@/lib/eza/standalonePersonas').PersonaFamilyId;
  observationCategoryId?: import('@/lib/eza/dailyObservation').UserObservationCategoryId;
}): MirrorIntentContext {
  const reflectionSignals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries);
  const topicKey =
    input.topicKey ??
    inferSceneTopicKey(
      input.entries,
      input.observationCategoryId,
      input.personaFamilyId ?? 'balanced_calm'
    );
  const cueBlob = collectIntentCueBlob(input.entries);
  const lockedIntent = resolveLockedPrimaryIntent({
    entries: input.entries,
    reflectionSignals,
    storyVariant: input.storyVariant,
    cueBlob,
  });
  const conversationIntent = deriveConversationVisualIntent({
    entries: input.entries,
    topicKey,
    storyVariant: input.storyVariant,
    reflectionSignals,
    storyTopicKey: topicKey,
  });
  const hero = resolveHeroObject(conversationIntent.id, conversationIntent.composition);
  const vehicleLabels = extractVehicleHighlightLabels(cueBlob);

  const intentFingerprint = hashFingerprint([
    lockedIntent,
    conversationIntent.id,
    conversationIntent.composition,
    lockedIntent === 'premium_vehicle_comparison' ? VEHICLE_SCENE_CONTRACT_ID : '',
    cueBlob.slice(0, 200),
    input.storyVariant ?? '',
  ]);

  return {
    cueBlob,
    lockedIntent,
    conversationIntent,
    primaryIntentId: conversationIntent.id,
    composition: conversationIntent.composition,
    heroObjectPhrase: hero.objectPhrase,
    vehicleLabels,
    intentFingerprint,
  };
}

export type MirrorIntentDebugSnapshot = {
  selectedPrimaryIntent: string;
  lockedIntent: string;
  sceneIntentLabel: string;
  storyVariant: string;
  microMood: string;
  reflectionTone: string;
  conversationCueBlob: string;
  detectedVehicleLabels: string;
  contextualHighlightKind: string;
  contextualHighlightLeft: string;
  contextualHighlightRight: string;
  visualPromptPreview: string;
  forbiddenPhrases: string;
  posterVersion: string;
  cardDate: string;
  cardId: string;
  seedHint: string;
  sceneImageUrl: string;
  sceneImageStatus: string;
  intentFingerprint: string;
  cardIntentFingerprint: string;
  entriesCount: number;
  staleSceneWarning: string;
  liveVsCardMismatch: boolean;
  sceneContract: string;
  promptContractOk: string;
  promptMissingRequired: string;
  promptForbiddenFound: string;
  posterPalette: string;
  renderMode: string;
  hybridEnabled: string;
  usedPromptType: string;
  imageProvider: string;
  hybridTextFallback: string;
  promptLength: string;
  promptPreview: string;
  promptTruncated: string;
  hybridPromptMarkersOk: string;
  hybridPromptMarkersMissing: string;
  mockSceneImage: string;
  hybridOcrProbe: string;
  hybridEnvDebug: string;
  /** V5 intelligence brief (private / landing prep). */
  v5IntelligenceDebug?: string;
  /** V5 Stage 0 — card title (surface only). */
  v5CardTitle?: string;
  /** V5 Stage 0 — core curiosity (landing/discovery only; title ≠ curiosity). */
  v5CoreCuriosity?: string;
  /** V5 Stage 0 — MirrorSeed JSON (landing prep). */
  v5MirrorSeed?: string;
  /** @deprecated Use v5MirrorSeed */
  v5TopicDNA?: string;
  /** V5 Stage 0 — curiosityContext (landing only, not on card/prompt). */
  v5CuriosityContext?: string;
  /** V5 Stage 0 — leakage audit summary. */
  v5PromptLeakage?: string;
  /** V5 Stage 0 — product philosophy check (not just technical). */
  v5PhilosophyCheck?: string;
  /** V5 frontend minimal prompt (dev). */
  v5FrontendMinimalPrompt?: string;
  /** V5 provider final prompt — mirrors backend openai_prompt_builder (dev). */
  v5ProviderFinalPrompt?: string;
  v5BackendAppendApplied?: string;
  v5PromptSameAsFrontend?: string;
};

export function buildMirrorIntentDebugSnapshot(input: {
  card: DailyMirrorCardModel | null;
  entries: SavedBehavioralEntry[];
  meta?: MirrorStateMeta | null;
  posterVersion?: string;
}): MirrorIntentDebugSnapshot {
  const { card, entries, meta, posterVersion = '—' } = input;

  const live = resolveMirrorIntentContext({
    entries,
    storyVariant: card?.storyVariant,
    reflectionSignals: card?.reflectionSignals,
    reflectionTone: card?.reflectionTone,
    personaFamilyId: card?.personaFamilyId,
  });

  const highlight: ContextualHighlight | null = card
    ? buildContextualHighlight(card)
    : null;

  const signals = card?.reflectionSignals ?? deriveReflectionSignals(entries);
  const microMood =
    card?.microMood ??
    inferMicroMood(signals, card?.reflectionTone ?? 'calm_reflective');

  const forbidden = getIntentLockForbiddenPhrases(live.lockedIntent);
  const fullPrompt = card?.visual?.prompt ?? '';
  const promptPreview = fullPrompt.slice(0, 800);
  const promptLength = fullPrompt.length;
  const trunc = detectPromptTruncationRisk(fullPrompt);
  const renderMode = resolveCardRenderMode(card);
  const usedPromptType =
    card?.visual?.usedPromptType ?? inferUsedPromptType(fullPrompt, renderMode);
  const markerReport =
    usedPromptType === 'hybrid_middle'
      ? analyzeHybridPromptMarkers(fullPrompt)
      : { ok: true, missing: [] as string[], present: [] as string[] };
  const sceneUrl = card?.visual?.sceneImageUrl ?? '';
  const mockScene = isMockSceneImageUrl(sceneUrl);
  const contractCheck =
    live.lockedIntent === 'premium_vehicle_comparison'
      ? validateVehicleComparisonPrompt(fullPrompt)
      : { ok: true, missing: [], forbidden: [] };
  const posterPalette = card ? resolvePosterPalette(card) : '—';
  const cardFp = card?.visual?.intentFingerprint ?? '—';
  const liveFp = live.intentFingerprint;
  const mismatch = Boolean(card && cardFp !== '—' && cardFp !== liveFp);

  const staleScene = mismatch
    ? 'Intent fingerprint değişti — günlük kartı yeniden oluşturun ve sahneyi tekrar üretin.'
    : card?.visual?.sceneImageUrl
      ? 'Sahne görseli cache’te; intent/prompt değiştiyse Sahneyi Oluştur’u yeniden çalıştırın.'
      : '';

  let v5IntelligenceDebug: string | undefined;
  let v5CardTitle: string | undefined;
  let v5CoreCuriosity: string | undefined;
  let v5MirrorSeed: string | undefined;
  let v5TopicDNA: string | undefined;
  let v5CuriosityContext: string | undefined;
  let v5PromptLeakage: string | undefined;
  let v5PhilosophyCheck: string | undefined;
  let v5FrontendMinimalPrompt: string | undefined;
  let v5ProviderFinalPrompt: string | undefined;
  let v5BackendAppendApplied: string | undefined;
  let v5PromptSameAsFrontend: string | undefined;
  if (card?.mirrorV3Payload) {
    const v5 = buildMirrorV5RenderDebugTrace(card.mirrorV3Payload);
    v5IntelligenceDebug = formatMirrorV5RenderDebugTrace(v5).split('=== B)')[0]?.trim();
    v5CardTitle = v5.stage0.cardTitle;
    v5CoreCuriosity = v5.stage0.coreCuriosity;
    v5MirrorSeed = JSON.stringify(v5.stage0.seed, null, 2);
    v5TopicDNA = v5MirrorSeed;
    v5CuriosityContext = v5.stage0.curiosityContext;
    v5PhilosophyCheck = formatMirrorPhilosophyCheck(v5.stage0.philosophy);
    const l = v5.stage0.promptLeakage;
    v5PromptLeakage = [
      `passed: ${l.passed}`,
      `mirrorBodyInPrompt: ${l.mirrorBodyInPrompt}`,
      `coreCuriosityInPrompt: ${l.coreCuriosityInPrompt}`,
      `curiosityContextInPrompt: ${l.curiosityContextInPrompt}`,
      `seedQuestionsInPrompt: ${l.seedQuestionsInPrompt}`,
      `conversationSummaryInPrompt: ${l.conversationSummaryInPrompt}`,
      `emailInPrompt: ${l.emailInPrompt}`,
      `phoneInPrompt: ${l.phoneInPrompt}`,
      `personalEntityInPrompt: ${l.personalEntityInPrompt}`,
      `topicHintInPrompt: ${l.topicHintInPrompt}`,
      `visualDirectionInPrompt: ${l.visualDirectionInPrompt}`,
      `evidenceLabelsInPrompt: ${l.evidenceLabelsInPrompt}`,
      `moodInImagePrompt: ${v5.stage0.moodInImagePrompt}`,
      `rawConversationSent: false`,
      `fullSummarySent: false`,
    ].join('\n');
    v5FrontendMinimalPrompt = v5.render.frontendMinimalPrompt;
    v5ProviderFinalPrompt = v5.render.backendProviderPrompt;
    v5BackendAppendApplied = String(v5.render.backendAppendApplied);
    v5PromptSameAsFrontend = String(v5.render.promptSameAsFrontend);
  }

  return {
    selectedPrimaryIntent: live.primaryIntentId,
    lockedIntent: live.lockedIntent ?? 'null',
    sceneIntentLabel: card?.visual?.sceneIntentLabel ?? '—',
    storyVariant: card?.storyVariant ?? '—',
    microMood: card?.microMood ?? microMood,
    reflectionTone: card?.reflectionTone ?? '—',
    conversationCueBlob: live.cueBlob.slice(0, 400) || '—',
    detectedVehicleLabels: live.vehicleLabels
      ? `${live.vehicleLabels.left} · ${live.vehicleLabels.right}`
      : '—',
    contextualHighlightKind: highlight?.kind ?? '—',
    contextualHighlightLeft: highlight?.left?.label ?? '—',
    contextualHighlightRight: highlight?.right?.label ?? '—',
    visualPromptPreview: promptPreview || '—',
    forbiddenPhrases: forbidden.length ? forbidden.join(', ') : '—',
    posterVersion,
    cardDate: card?.date ?? '—',
    cardId: meta?.generatedAt ?? card?.date ?? '—',
    seedHint: card?.visual?.seedHint ?? '—',
    sceneImageUrl: card?.visual?.sceneImageUrl ?? '—',
    sceneImageStatus: card?.visual?.sceneImageStatus ?? '—',
    intentFingerprint: liveFp,
    cardIntentFingerprint: cardFp,
    entriesCount: entries.length,
    staleSceneWarning: mismatch
      ? 'Kart eski intent fingerprint ile üretilmiş; günlük kartı yeniden oluşturun.'
      : staleScene,
    liveVsCardMismatch: mismatch,
    sceneContract:
      card?.visual?.sceneContractId ??
      (live.lockedIntent === 'premium_vehicle_comparison' ? VEHICLE_SCENE_CONTRACT_ID : '—'),
    promptContractOk: contractCheck.ok ? 'yes' : 'NO',
    promptMissingRequired: contractCheck.missing.length
      ? contractCheck.missing.join(', ')
      : '—',
    promptForbiddenFound: contractCheck.forbidden.length
      ? contractCheck.forbidden.join(', ')
      : 'none',
    posterPalette,
    renderMode,
    hybridEnabled: isHybridEnabled() ? 'true' : 'false',
    usedPromptType,
    imageProvider: card?.visual?.imageProvider ?? '—',
    hybridTextFallback: card?.visual?.hybridFallbackReason ?? card?.visual?.hybridTextRisk
      ? 'true'
      : 'false',
    promptLength: String(promptLength),
    promptPreview: promptPreview || '—',
    promptTruncated: trunc.truncated ? `YES (>${trunc.max})` : 'no',
    hybridPromptMarkersOk: markerReport.ok ? 'yes' : 'NO',
    hybridPromptMarkersMissing: markerReport.missing.length
      ? markerReport.missing.join(', ')
      : '—',
    mockSceneImage: mockScene ? 'YES (mock/picsum)' : sceneUrl ? 'no' : '—',
    hybridOcrProbe: card?.visual?.hybridOcrProbe ?? '—',
    hybridEnvDebug: getHybridEnvDebug(),
    v5IntelligenceDebug,
    v5CardTitle,
    v5CoreCuriosity,
    v5MirrorSeed,
    v5TopicDNA,
    v5CuriosityContext,
    v5PromptLeakage,
    v5PhilosophyCheck,
    v5FrontendMinimalPrompt,
    v5ProviderFinalPrompt,
    v5BackendAppendApplied,
    v5PromptSameAsFrontend,
  };
}

/** Boost entries with BMW/Mercedes cues for dev QA (no backend). */
export function withDevVehicleCueHints(
  entries: SavedBehavioralEntry[]
): SavedBehavioralEntry[] {
  const hints = [
    'bmw',
    'mercedes',
    '3 serisi',
    'c serisi',
    'konfor',
    'uzun yol',
    'karşılaştırma',
    'hangisi',
    'tercih',
    'karar',
    'compare',
    'choice_comparison',
  ];
  if (!entries.length) {
    return [
      {
        schema_version: 1,
        interaction_id: 'dev-bmw-mercedes-mock',
        mode: 'standalone',
        savedAt: new Date().toISOString(),
        vector: {
          input_risk: 0.1,
          output_risk: 0.1,
          input_health: 0.9,
          output_health: 0.9,
          alignment_score: 82,
          eza_final: 78,
          intent: 'compare bmw mercedes comfort sedan choice',
          alignment_verdict: 'aligned',
          redirect: false,
          redirect_reason: null,
          policy_violation_count: 0,
        },
        asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
        mirrorCueHints: hints,
        standaloneObservation: {
          user_pattern: {
            category: 'decision_direction',
            confidence: 0.9,
            signals: hints,
          },
          ai_behavior: { category: 'explanatory', confidence: 0.85, signals: ['comparison'] },
          relationship_balance: {
            category: 'decision_balance',
            confidence: 0.8,
            signals: ['karar'],
          },
        },
      },
    ];
  }
  return entries.map((e, i) =>
    i < 4 ? { ...e, mirrorCueHints: [...(e.mirrorCueHints ?? []), ...hints] } : e
  );
}
