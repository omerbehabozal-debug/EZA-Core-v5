import { writeFileSync } from 'node:fs';
import { MIRROR_V2_QA_SCENARIOS } from '../lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { buildMirrorPayloadV3 } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorV3ImagePrompt } from '../lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import { buildVisualPayloadFromMirrorV3 } from '../lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';

const SCENARIOS = [
  { id: 'japan-travel', label: 'Japonya seyahati' },
  { id: 'architecture-facade', label: 'Mimari cephe' },
  { id: 'bmw-mercedes', label: 'BMW vs Mercedes' },
  { id: 'ai-trust', label: 'Yapay zeka güveni' },
  { id: 'spirituality', label: 'Maneviyat' },
] as const;

const V2_WORDS =
  /keşif|keşfin|inner voice|wonder|possibility|journey|iç ses|ufuk|olasılık|uzak ufuk|inner journey|distance and curiosity/i;

const TOPIC_NAME_TITLE = /^(Kyoto|Japonya|Tokyo|BMW|Mercedes|Yapay Zeka)$/i;

function auditScenario(id: string, label: string) {
  const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === id)!;
  const seed = `runtime-v45-${id}`;
  const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
    seed,
    conversationId: seed,
    season: scenario.season,
  });
  const prompt = buildVisualPayloadFromMirrorV3(payload).prompt;

  const fusionSection = prompt.split('Fusion rule:')[0] ?? prompt;
  const checks = {
    promptUnder5000: prompt.length <= 5000,
    hasFusionScene: prompt.includes('Evidence fusion scene'),
    hasWorldLayer: prompt.includes('World Layer:'),
    hasUnifiedFrameRule: prompt.includes('Unified frame rule:'),
    noEvidenceBullets: !/^-\s+\S+.*→/m.test(fusionSection),
    noSupportingList: !prompt.includes('Supporting evidence'),
    noObjectCatalog: !prompt.includes('Conversation evidence (20%)'),
    titleNotTopicName: !TOPIC_NAME_TITLE.test(payload.mirrorTitle.trim()),
    bodyNoV2Words: !V2_WORDS.test(payload.mirrorText),
    bodyNoInventory: !/fenerli sokaklar|rota notları|tren bileti/i.test(payload.mirrorText),
    bodyShort: payload.mirrorText.length >= 15 && payload.mirrorText.length <= 180,
  };

  const pass = Object.values(checks).every(Boolean);

  return {
    scenario: label,
    scenarioId: id,
    selectedTopic: payload.selectedTopic,
    heroAnchor: payload.sceneComposition.heroScene,
    evidenceFusionScene: payload.sceneComposition.evidenceFusionScene,
    worldLayer: payload.sceneComposition.worldLayer,
    title: payload.mirrorTitle,
    body: payload.mirrorText,
    promptChars: prompt.length,
    finalOpenAIPrompt: prompt,
    checks,
    verdict: pass ? 'PASS' : 'FAIL',
  };
}

const results = SCENARIOS.map((s) => auditScenario(s.id, s.label));

const out = [
  '=== V4.5 RUNTIME REPORT (5 scenarios) ===',
  `Generated: ${new Date().toISOString()}`,
  '',
  ...results.flatMap((r) => [
    `--- ${r.scenario} (${r.scenarioId}) — ${r.verdict} ---`,
    `selectedTopic: ${r.selectedTopic}`,
    `Hero Anchor: ${r.heroAnchor}`,
    `Evidence Fusion Scene: ${r.evidenceFusionScene}`,
    `World Layer: ${r.worldLayer}`,
    `Title: ${r.title}`,
    `Body: ${r.body}`,
    `Prompt chars: ${r.promptChars}`,
    `Checks: ${JSON.stringify(r.checks)}`,
    '',
    'Final OpenAI Prompt:',
    r.finalOpenAIPrompt,
    '',
    '---',
    '',
  ]),
  '=== SUMMARY ===',
  ...results.map((r) => `${r.scenario}: ${r.verdict}`),
].join('\n');

writeFileSync('runtime-v45-report.txt', out, 'utf8');
console.log(out);
