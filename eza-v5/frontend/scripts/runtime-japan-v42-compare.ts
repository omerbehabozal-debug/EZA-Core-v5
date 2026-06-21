import { readFileSync, writeFileSync } from 'node:fs';
import { MIRROR_V2_QA_SCENARIOS } from '../lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { buildMirrorPayloadV3 } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorV3ImagePrompt } from '../lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import { buildVisualPayloadFromMirrorV3 } from '../lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';

const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
  seed: 'runtime-japan-report',
  conversationId: 'runtime-japan-report',
});
const newPrompt = buildVisualPayloadFromMirrorV3(payload).prompt;

let oldChars = 11607;
try {
  const oldReport = readFileSync('runtime-japan-report.txt', 'utf8');
  const match = oldReport.match(/sentToOpenAIChars": (\d+)/);
  if (match) oldChars = Number(match[1]);
} catch {
  /* use default from V4.1 report */
}

const removedBlocks = [
  'Narrative theme:',
  'Meaning:',
  'Emotion:',
  'Narrative distance:',
  'Emotional atmosphere:',
  'Narrative distance visual behavior',
  'Universal cinematic meaning',
  'Cinematography contract:',
  'Reference tier:',
  'Season art direction:',
  'Visual metaphor translation',
  'Shareability test:',
  'Meaning and emotion layer',
  'Topic visibility test',
  'V4 core principle:',
  '75% of poster design',
  '15% mood shaping',
];

const out = [
  '=== V4.2 JAPAN PROMPT COMPARISON ===',
  '',
  `Old prompt (V4.1): ${oldChars} chars`,
  `New prompt (V4.2): ${newPrompt.length} chars`,
  `Reduction: ${oldChars - newPrompt.length} chars (${Math.round((1 - newPrompt.length / oldChars) * 100)}%)`,
  '',
  '=== REMOVED FROM PROMPT (verified absent) ===',
  ...removedBlocks.map((b) => `- ${b}: ${newPrompt.includes(b) ? 'STILL PRESENT' : 'removed'}`),
  '',
  '=== NEW FINAL OPENAI PROMPT ===',
  newPrompt,
].join('\n');

writeFileSync('runtime-japan-v42-report.txt', out, 'utf8');
console.log(out);
