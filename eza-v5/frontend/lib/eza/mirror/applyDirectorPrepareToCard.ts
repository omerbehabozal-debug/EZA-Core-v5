/**
 * Apply Director prepare result onto Daily Mirror card + V5 visual (PR C).
 * Authority is driven by backend applyTitle / applyPrompt flags (SOFT vs FULL).
 * SHADOW must not call this with apply flags true.
 */

import type { DailyMirrorCardModel, MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import type { MirrorDirectorMetadataContract } from '@/lib/eza/mirror/director/mirrorDraftTypes';
import type { SainaMirrorSeason } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { MIRROR_ART_DIRECTION_IDS } from '@/lib/eza/mirror/director/mirrorDraftTypes';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';

export type PrepareDirectorMappedPrompt = {
  title: string;
  topicCategory: string;
  season: string;
  mood?: string | null;
  prompt: string;
  negativePrompt: string;
  promptContract: string;
  titleSource: string;
  artDirectionSource: string;
};

export type PrepareDirectorDraftResult = {
  directorEnabled: boolean;
  usedDirector: boolean;
  reusedCache?: boolean;
  directorMode?: string;
  directorExecuted?: boolean;
  directorAffectedOutput?: boolean;
  applyTitle?: boolean;
  applyPrompt?: boolean;
  mappedPrompt?: PrepareDirectorMappedPrompt | null;
  shadowMappedPrompt?: PrepareDirectorMappedPrompt | null;
  metadata?: MirrorDirectorMetadataContract | null;
  fallbackReason?: string | null;
  contentHash?: string | null;
  titleSource?: string | null;
  promptSource?: string | null;
  finalDraft?: { title?: string; artDirection?: string } | null;
  /** PR D1 — evidence package; never drives image prompt in applyDirectorPrepareToCard. */
  conversationContext?: unknown | null;
  /** PR D2 — creative interpretation; visuals come from mappedPrompt only. */
  finalInterpretation?: unknown | null;
};

function isSeason(value: string): value is SainaMirrorSeason {
  return (MIRROR_ART_DIRECTION_IDS as readonly string[]).includes(value);
}

export function applyDirectorPrepareToCard(
  card: DailyMirrorCardModel,
  prepared: PrepareDirectorDraftResult
): DailyMirrorCardModel {
  const applyTitle = Boolean(prepared.applyTitle && prepared.mappedPrompt);
  const applyPrompt = Boolean(prepared.applyPrompt && prepared.mappedPrompt);
  if (!card.visual || (!applyTitle && !applyPrompt && !prepared.metadata)) {
    // Still allow metadata-only attach for SHADOW without changing visuals
    if (prepared.metadata && !prepared.directorAffectedOutput) {
      return {
        ...card,
        mirrorDirectorMetadata: {
          ...prepared.metadata,
          titleSource: prepared.titleSource ?? 'legacy_heuristic',
          directorMode: prepared.directorMode,
          directorExecuted: prepared.directorExecuted,
          directorAffectedOutput: false,
          promptSource: prepared.promptSource ?? 'legacy_heuristic',
        },
      };
    }
    return card;
  }

  const mapped = prepared.mappedPrompt;
  let next: DailyMirrorCardModel = { ...card };

  if (mapped && (applyTitle || applyPrompt)) {
    const season: SainaMirrorSeason | undefined = isSeason(mapped.season)
      ? mapped.season
      : (card.mirrorSeason as SainaMirrorSeason | undefined);
    const prevHybrid = card.visual.hybridTextPayload;

    const visual: MirrorVisualPromptPayload = {
      ...card.visual,
      ...(applyPrompt
        ? {
            prompt: mapped.prompt,
            negativePrompt: mapped.negativePrompt || card.visual.negativePrompt,
            promptContract: mapped.promptContract || MIRROR_V5_PROMPT_CONTRACT,
            topicLabel: mapped.topicCategory || card.visual.topicLabel,
          }
        : {}),
      ...(applyTitle
        ? {
            hybridTextPayload: {
              headline: mapped.title,
              description: prevHybrid?.description ?? '',
              themeTitle: mapped.title,
              themeDescription: prevHybrid?.themeDescription ?? '',
              quote: prevHybrid?.quote ?? '',
              ...(prevHybrid?.subheadline != null
                ? { subheadline: prevHybrid.subheadline }
                : {}),
            },
            masterPosterText: {
              headline: mapped.title,
              quote: card.visual.masterPosterText?.quote ?? '',
            },
          }
        : {}),
    };

    const payload = card.mirrorV3Payload
      ? {
          ...card.mirrorV3Payload,
          ...(applyTitle ? { mirrorTitle: mapped.title } : {}),
          ...(applyPrompt
            ? {
                topic: mapped.topicCategory || card.mirrorV3Payload.topic,
                ...(season ? { season } : {}),
              }
            : {}),
        }
      : undefined;

    next = {
      ...card,
      ...(applyTitle
        ? { headline: mapped.title, dailyThemeTitle: mapped.title }
        : {}),
      ...(applyPrompt && season ? { mirrorSeason: season } : {}),
      visual,
      mirrorV3Payload: payload,
    };
  }

  const meta: DailyMirrorCardModel['mirrorDirectorMetadata'] = prepared.metadata
    ? {
        ...prepared.metadata,
        titleSource:
          prepared.titleSource ??
          prepared.metadata.titleSource ??
          undefined,
        directorMode: prepared.directorMode ?? undefined,
        directorExecuted: prepared.directorExecuted ?? undefined,
        directorAffectedOutput: prepared.directorAffectedOutput ?? undefined,
        promptSource: prepared.promptSource ?? undefined,
      }
    : undefined;

  return {
    ...next,
    ...(meta ? { mirrorDirectorMetadata: meta } : {}),
  };
}
