/**
 * Phase 3.5 — mapped prompt reuse lineage gate.
 */

import { describe, expect, it } from 'vitest';
import {
  canReuseMappedPromptForJourney,
  JOURNEY_MAPPER_VERSION_V5,
  type JourneySemanticScopePayload,
} from '@/lib/eza/mirror/journey';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

function scope(
  overrides: Partial<JourneySemanticScopePayload> = {}
): JourneySemanticScopePayload {
  return {
    semanticScope: 'journey_window_v1',
    journeyId: 'journey-bmw',
    journeyVersion: 1,
    sourceConversationId: 'conv-1',
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    windowHash: 'habc123',
    scopedInputHash: 'sdef456',
    selectedSteps: [],
    ...overrides,
  };
}

function cardWithLineage(
  lineage: DailyMirrorCardModel['mirrorJourneyLineage'] | null,
  prompt = 'VISUAL NARRATIVE: dusk family SUV road'
): DailyMirrorCardModel {
  return {
    id: 'c1',
    date: '2026-08-09',
    headline: 't',
    dailyThemeTitle: 't',
    visual: {
      prompt,
      negativePrompt: '',
      promptContract: 'saina_mirror_v5_minimal',
    },
    mirrorDirectorMetadata: {
      analysisSchemaVersion: 'a',
      draftSchemaVersion: 'd',
      reviewSchemaVersion: 'r',
      analysisSource: 'x',
      draftSource: 'interpretation_llm',
      directorReasonCodes: [],
      revisionCount: 0,
      topicCategory: 'vehicle',
      contentHash: 'h',
      promptSource: 'interpretation_v5_mapper',
    },
    mirrorJourneyLineage: lineage,
  } as DailyMirrorCardModel;
}

describe('canReuseMappedPromptForJourney', () => {
  it('allows reuse when exact scoped lineage matches', () => {
    const s = scope();
    const card = cardWithLineage({
      semanticScope: 'journey_window_v1',
      journeyId: 'journey-bmw',
      journeyVersion: 1,
      windowHash: 'habc123',
      scopedInputHash: 'sdef456',
      interpretationHash: 'i1',
      mapperVersion: JOURNEY_MAPPER_VERSION_V5,
    });
    expect(
      canReuseMappedPromptForJourney({
        card,
        scope: s,
        interpretationHash: 'i1',
        mapperVersion: JOURNEY_MAPPER_VERSION_V5,
      })
    ).toBe(true);
  });

  it('denies reuse when journeyVersion differs', () => {
    const card = cardWithLineage({
      semanticScope: 'journey_window_v1',
      journeyId: 'journey-bmw',
      journeyVersion: 1,
      windowHash: 'habc123',
      scopedInputHash: 'sdef456',
      mapperVersion: JOURNEY_MAPPER_VERSION_V5,
    });
    expect(
      canReuseMappedPromptForJourney({
        card,
        scope: scope({ journeyVersion: 2, scopedInputHash: 'sother' }),
      })
    ).toBe(false);
  });

  it('denies reuse when windowHash differs', () => {
    const card = cardWithLineage({
      semanticScope: 'journey_window_v1',
      journeyId: 'journey-bmw',
      journeyVersion: 1,
      windowHash: 'habc123',
      scopedInputHash: 'sdef456',
      mapperVersion: JOURNEY_MAPPER_VERSION_V5,
    });
    expect(
      canReuseMappedPromptForJourney({
        card,
        scope: scope({ windowHash: 'hother' }),
      })
    ).toBe(false);
  });

  it('denies legacy pinned prompt without journey lineage', () => {
    const card = cardWithLineage(null);
    expect(
      canReuseMappedPromptForJourney({
        card,
        scope: scope(),
      })
    ).toBe(false);
  });

  it('denies when selected step mutation changes scopedInputHash', () => {
    const card = cardWithLineage({
      semanticScope: 'journey_window_v1',
      journeyId: 'journey-bmw',
      journeyVersion: 1,
      windowHash: 'habc123',
      scopedInputHash: 'sdef456',
      mapperVersion: JOURNEY_MAPPER_VERSION_V5,
    });
    expect(
      canReuseMappedPromptForJourney({
        card,
        scope: scope({ scopedInputHash: 'smutated' }),
      })
    ).toBe(false);
  });
});
