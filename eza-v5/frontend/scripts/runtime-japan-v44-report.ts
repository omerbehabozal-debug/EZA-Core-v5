import { writeFileSync } from 'node:fs';
import { MIRROR_V2_QA_SCENARIOS } from '../lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { buildMirrorPayloadV3 } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorV3ImagePrompt } from '../lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import { buildVisualPayloadFromMirrorV3 } from '../lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
import { resolveTopicShotMode } from '../lib/eza/mirror/conversationMirrorV3/shotDirectorV43';

const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
const entries = scenario.buildEntries();
const seed = 'runtime-japan-v44-report';
const conversationId = 'runtime-japan-v44-report';

const payload = buildMirrorPayloadV3(entries, { seed, conversationId, season: scenario.season });
const promptOnly = buildMirrorV3ImagePrompt(payload);
const visual = buildVisualPayloadFromMirrorV3(payload);
const shot = resolveTopicShotMode({
  storyTopicId: payload.storyTopicId,
  evidence: payload.conversationEvidence,
  selectedTopic: payload.selectedTopic,
});

const hasObjectCatalog = promptOnly.includes('Conversation evidence (20%)');
const hasSupportingList = promptOnly.includes('Supporting evidence');
const fusionSection = promptOnly.split('Fusion rule:')[0] ?? promptOnly;
const hasEvidenceBullets = /^-\s+\S+.*→/m.test(fusionSection);

const auditVerdict =
  !hasEvidenceBullets && !hasSupportingList && !hasObjectCatalog
    ? 'PASS — single fusion paragraph, no object inventory'
    : 'FAIL — prompt still reads like object list';

const report = {
  refinementVersion: payload.refinementVersion,
  auditVerdict,
  heroScene: payload.sceneComposition.heroScene,
  evidenceFusionScene: payload.sceneComposition.evidenceFusionScene,
  title: payload.mirrorTitle,
  body: payload.mirrorText,
  shotMode: shot,
  promptStats: {
    basePromptChars: promptOnly.length,
    sentToOpenAIChars: visual.prompt.length,
    qualityGateAppended: visual.prompt.length > promptOnly.length,
  },
  checks: { hasEvidenceBullets, hasSupportingList, hasObjectCatalog },
};

const out = [
  '=== V4.4 RUNTIME REPORT (japan-travel) ===',
  JSON.stringify(report, null, 2),
  '',
  '=== FINAL OPENAI PROMPT (sent to API) ===',
  visual.prompt,
  '',
  '=== AUDIT ===',
  auditVerdict,
].join('\n');

writeFileSync('runtime-japan-v44-report.txt', out, 'utf8');
console.log(out);
