import { writeFileSync } from 'node:fs';
import { MIRROR_V2_QA_SCENARIOS } from '../lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { buildMirrorPayloadV3 } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorPayload } from '../lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { buildMirrorV3ImagePrompt } from '../lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import { buildVisualPayloadFromMirrorV3 } from '../lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
import { resolveShotMode } from '../lib/eza/mirror/conversationMirrorV3/artDirectionV32';
import { buildMirrorV3SeedHint } from '../lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';
import { resolveEvidenceMirrorCopy } from '../lib/eza/mirror/conversationMirrorV3/evidenceAwareMirrorCopy';
import { resolveMeaningMirrorCopy } from '../lib/eza/mirror/conversationMirrorV3/meaningMirrorCopy';
import { resolveNarrativeDistance } from '../lib/eza/mirror/conversationMirrorV3/narrativeDistance';

const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
const entries = scenario.buildEntries();
const seed = 'runtime-japan-report';
const conversationId = 'runtime-japan-report';

const v2Base = buildMirrorPayload(entries, { seed, conversationId, season: scenario.season });
const payload = buildMirrorPayloadV3(entries, { seed, conversationId, season: scenario.season });
const promptOnly = buildMirrorV3ImagePrompt(payload);
const visual = buildVisualPayloadFromMirrorV3(payload);
const seedKey = buildMirrorV3SeedHint(payload);
const shot = resolveShotMode(seedKey, {
  hasConcreteEvidence: (payload.conversationEvidence ?? []).length >= 3,
});
const meaningCopyLegacy = resolveMeaningMirrorCopy({
  storyTopicId: 'travel',
  selectedTopic: payload.selectedTopic,
  seed,
  narrativeDistance: resolveNarrativeDistance(seed).level,
});
const evidenceCopyDirect = resolveEvidenceMirrorCopy({
  evidence: payload.conversationEvidence,
  selectedTopic: payload.selectedTopic,
  storyTopicId: 'travel',
  seed,
});

const report = {
  refinementVersion: payload.refinementVersion,
  selectedTopic: payload.selectedTopic,
  primaryStoryTopic: payload.topic,
  title: {
    final: payload.mirrorTitle,
    source: 'evidenceAwareMirrorCopy.ts',
    v2BaseWouldBe: v2Base.mirrorTitle,
    v2UsedInFinal: payload.mirrorTitle === v2Base.mirrorTitle,
  },
  body: {
    final: payload.mirrorText,
    source: 'evidenceAwareMirrorCopy.ts',
    v2BaseWouldBe: v2Base.mirrorText,
    meaningCopyLegacyWouldBe: meaningCopyLegacy,
    v2UsedInFinal: payload.mirrorText === v2Base.mirrorText,
    meaningUsedInFinal: payload.mirrorText === meaningCopyLegacy,
  },
  heroScene: {
    final: payload.sceneComposition.heroScene,
    source: 'sceneCompositionV4.ts',
    sceneMetaphorFinal: payload.sceneMetaphor,
    v2SceneMetaphorWouldBe: v2Base.sceneMetaphor,
  },
  evidence: payload.conversationEvidence,
  shotMode: shot,
  closingLine: {
    final: payload.closingLine ?? null,
    v2WouldBe: v2Base.closingLine ?? null,
    inOpenAIPrompt:
      visual.prompt.includes('Bazı yolculuklar') ||
      visual.prompt.includes('Optional closing line'),
  },
  evidenceInPrompt: {
    primaryLabelInPrompt: visual.prompt.includes(
      payload.conversationEvidence[0]?.label ?? '___MISSING___'
    ),
    heroSceneBlockInPrompt: visual.prompt.includes('Hero scene (dominant'),
    evidenceBlockInPrompt: visual.prompt.includes('Conversation evidence:'),
  },
  promptStats: {
    basePromptChars: promptOnly.length,
    sentToOpenAIChars: visual.prompt.length,
    qualityGateAppended: visual.prompt.length > promptOnly.length,
  },
};

const out = [
  '=== RUNTIME REPORT (japan-travel) ===',
  JSON.stringify(report, null, 2),
  '',
  '=== FINAL OPENAI PROMPT (sent to API) ===',
  visual.prompt,
].join('\n');

writeFileSync('runtime-japan-report.txt', out, 'utf8');
console.log(out);
