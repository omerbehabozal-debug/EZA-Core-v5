import { writeFileSync } from 'node:fs';
import type { SavedBehavioralEntry } from '../lib/behavioralHistory';
import { MIRROR_V2_QA_SCENARIOS } from '../lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { buildMirrorPayloadV3 } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorRenderBrief } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
import { buildOpenAIRenderPromptFromPayload } from '../lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt';
import { buildMirrorV5RenderDebugTrace } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorV5DebugTrace';

function thyroidEntry(): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'runtime-thyroid',
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    mirrorCueHints: ['guatr', 'thyroid', 'tiroid', 'boyun', 'health'],
    vector: {
      input_risk: 0.22,
      output_risk: 0.18,
      input_health: 0.78,
      output_health: 0.82,
      alignment_score: 84,
      eza_final: 84,
      intent: 'explore',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.04, risk_delta_output_minus_input: -0.04, index: 0.08 },
  };
}

function uzbekTrainEntries(): SavedBehavioralEntry[] {
  const base = Date.now();
  const mk = (id: string, i: number, hints: string[]): SavedBehavioralEntry => ({
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: new Date(base - i * 3600000).toISOString(),
    mirrorCueHints: hints,
    vector: {
      input_risk: 0.22,
      output_risk: 0.18,
      input_health: 0.78,
      output_health: 0.82,
      alignment_score: 84,
      eza_final: 84,
      intent: 'explore',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.04, risk_delta_output_minus_input: -0.04, index: 0.08 },
  });
  return [
    mk('uz-1', 0, ['uzbekistan', 'train', 'tren', 'samarkand', 'route']),
    mk('uz-2', 1, ['rail', 'journey', 'central asia', 'travel']),
    mk('uz-3', 2, ['ticket', 'rota', 'curious']),
  ];
}

const SCENARIOS: { label: string; buildEntries: () => SavedBehavioralEntry[] }[] = [
  {
    label: '1. Japonya seyahati',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!.buildEntries(),
  },
  {
    label: '2. Guatr / thyroid health',
    buildEntries: () => [thyroidEntry()],
  },
  {
    label: '3. Mimari cephe',
    buildEntries: () =>
      MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'architecture-facade')!.buildEntries(),
  },
  {
    label: '4. BMW vs Mercedes',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'bmw-mercedes')!.buildEntries(),
  },
  {
    label: '5. Yapay zeka güveni',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'ai-trust')!.buildEntries(),
  },
  {
    label: '6. Maneviyat',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'spirituality')!.buildEntries(),
  },
  {
    label: '7. Özbekistan tren rotası',
    buildEntries: uzbekTrainEntries,
  },
  {
    label: '8. Ürün fikri',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'shopping-choice')!.buildEntries(),
  },
];

const sections: string[] = ['=== SAINA Mirror V5 Render Layer Report ===', ''];

for (const scenario of SCENARIOS) {
  const id = scenario.label.replace(/^\d+\.\s*/, '').replace(/\s+/g, '-').toLowerCase();
  const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
    seed: `runtime-v5-${id}`,
    conversationId: `runtime-v5-${id}`,
  });
  const brief = buildMirrorRenderBrief(payload);
  const { prompt, promptLength } = buildOpenAIRenderPromptFromPayload(brief);
  const trace = buildMirrorV5RenderDebugTrace(payload);

  sections.push(`--- ${scenario.label} ---`);
  sections.push(`title: ${brief.title}`);
  sections.push(`topicCategory: ${brief.topicCategory}`);
  sections.push(`mood: ${brief.mood ?? '—'}`);
  sections.push(`publicTopicHint: ${brief.publicTopicHint}`);
  sections.push(`visualDirection: ${brief.visualDirection}`);
  sections.push(`lightMode: ${brief.lightMode}`);
  sections.push(`safetyMode: ${brief.safetyMode}`);
  sections.push(`promptLength: ${promptLength}`);
  sections.push(`rawConversationSent: ${trace.render.rawConversationSent}`);
  sections.push(`fullSummarySent: ${trace.render.fullSummarySent}`);
  sections.push(`evidenceListSent: ${trace.render.evidenceListSent}`);
  sections.push(`defaultCinematic: ${/\bcinematic\b/i.test(prompt)}`);
  sections.push('');
  sections.push('FINAL OPENAI PROMPT:');
  sections.push(prompt);
  sections.push('');
}

const out = sections.join('\n');
writeFileSync('runtime-v5-render-report.txt', out, 'utf8');
console.log(out);
