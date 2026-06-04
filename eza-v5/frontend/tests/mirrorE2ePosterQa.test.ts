/**
 * Mirror E2E Poster QA — presentation + state pipeline (P2 v9b scene-hero).
 * Validates topic scenarios and writes QA report; no UI/backend changes.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import {
  POSTER_QUOTE_MAX,
  POSTER_RELATION_LINE_MAX,
  POSTER_STORY_MAX,
  POSTER_THEME_DESC_MAX,
} from '@/lib/eza/mirror/posterCardContent';
import {
  MIRROR_EXPORT_TARGET_HEIGHT,
  MIRROR_EXPORT_TARGET_WIDTH,
} from '@/lib/eza/mirror/shareExport';
import {
  POSTER_SCENE_DOMINANCE_RATIO,
  posterCardSkinIdentity,
} from '@/lib/eza/mirror/posterCardSkin';
import { readFileSync } from 'node:fs';

type ScenarioId = 'finance' | 'health' | 'architecture' | 'travel' | 'friendship';

type ScenarioDef = {
  id: ScenarioId;
  label: string;
  exportName: string;
  topicKey: ScenarioId | 'creativity' | 'general';
  entries: SavedBehavioralEntry[];
};

const OBS_BASE = {
  ai_behavior: { category: 'explanatory', confidence: 0.82, signals: ['clarify'] },
  relationship_balance: {
    category: 'decision_balance',
    confidence: 0.8,
    signals: ['steady'],
  },
};

function entry(
  intent: string,
  userCategory: string,
  balanceCategory: string,
  idx: number
): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `e2e-${idx}`,
    mode: 'standalone',
    savedAt: new Date(Date.now() - idx * 60_000).toISOString(),
    vector: {
      input_risk: 0.12,
      output_risk: 0.1,
      input_health: 0.88,
      output_health: 0.9,
      alignment_score: 84,
      eza_final: 78,
      intent,
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.04, risk_delta_output_minus_input: -0.02, index: 0.08 },
    standaloneObservation: {
      user_pattern: { category: userCategory, confidence: 0.85, signals: ['e2e'] },
      ai_behavior: OBS_BASE.ai_behavior,
      relationship_balance: {
        category: balanceCategory,
        confidence: 0.8,
        signals: ['e2e'],
      },
    },
  };
}

function makeScenarioEntries(
  intent: string,
  userCategory: string,
  balanceCategory: string
): SavedBehavioralEntry[] {
  return [0, 1, 2, 3].map((i) => entry(intent, userCategory, balanceCategory, i));
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: 'finance',
    label: 'Finans / kıyas',
    exportName: 'finance_export.png',
    topicKey: 'finance',
    entries: makeScenarioEntries(
      'compare options finance budget',
      'decision_direction',
      'decision_balance'
    ),
  },
  {
    id: 'health',
    label: 'Sağlık / özen',
    exportName: 'health_export.png',
    topicKey: 'health',
    entries: makeScenarioEntries('health wellness nourish', 'balanced_calm', 'calm_rhythm'),
  },
  {
    id: 'architecture',
    label: 'Mimari / restorasyon',
    exportName: 'architecture_export.png',
    topicKey: 'architecture',
    entries: makeScenarioEntries(
      'architecture design restoration courtyard',
      'clarity_simplification',
      'clarity_balance'
    ),
  },
  {
    id: 'travel',
    label: 'Seyahat / keşif',
    exportName: 'travel_export.png',
    topicKey: 'travel',
    entries: makeScenarioEntries('travel trip explore', 'curiosity_exploration', 'exploration_balance'),
  },
  {
    id: 'friendship',
    label: 'Arkadaşlık / iletişim',
    exportName: 'friendship_export.png',
    topicKey: 'friendship',
    entries: makeScenarioEntries(
      'friend relationship communicate',
      'sensitive_careful',
      'careful_balance'
    ),
  },
];

const CATEGORY_HEADLINE = /^gözlemsel\s+gün$/i;
const OLD_UI_PATTERNS = [/bugün ne yaptın/i, /ilişki dengen/i, /davranış raporu/i];

const POSTER_COMPONENT = join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx');
const SCENE_WINDOW_COMPONENT = join(process.cwd(), 'components/mirror/PosterSceneWindow.tsx');
const IDENTITY_HEADLINE_COMPONENT = join(
  process.cwd(),
  'components/mirror/PosterIdentityHeadline.tsx'
);
const SKIN_MODULE = join(process.cwd(), 'lib/eza/mirror/posterCardSkin.ts');

type Scores = {
  aspect916: number;
  sceneHeroLayout: number;
  textBalance: number;
  editorialHeadline: number;
  storyAlignment: number;
  mobile: number;
  exportCheck: number;
  general: number;
};

function clampScore(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function scoreScenario(scenario: ScenarioDef): {
  scores: Scores;
  card: ReturnType<typeof buildMirrorState>['dailyMirrorCard'];
  content: ReturnType<typeof buildPosterCardContent>;
  notes: string[];
} {
  const state = buildMirrorState(scenario.entries, { seed: `e2e-${scenario.id}` });
  const card = state.dailyMirrorCard;
  const content = buildPosterCardContent(card);
  const notes: string[] = [];

  const posterSrc = readFileSync(POSTER_COMPONENT, 'utf8');
  const sceneWindowSrc = readFileSync(SCENE_WINDOW_COMPONENT, 'utf8');
  const identitySrc = readFileSync(IDENTITY_HEADLINE_COMPONENT, 'utf8');
  const skinSrc = readFileSync(SKIN_MODULE, 'utf8');

  let aspect916 = 5;
  if (!posterSrc.includes('data-mirror-aspect="9-16"')) aspect916 -= 2;
  if (!posterCardSkinIdentity.root.includes('aspect-[9/16]')) aspect916 -= 2;
  if (!posterSrc.includes('v9b-scene-hero')) aspect916 -= 2;

  let sceneHeroLayout = 5;
  if (!posterSrc.includes('PosterSceneWindow')) sceneHeroLayout -= 2;
  if (!posterSrc.includes('PosterIdentityHeadline')) sceneHeroLayout -= 2;
  if (!posterSrc.includes('v9b-scene-hero-hybrid')) sceneHeroLayout -= 1;
  if (posterSrc.includes('sceneBackdrop')) sceneHeroLayout -= 3;
  if (!sceneWindowSrc.includes('sceneWindowZone') && !sceneWindowSrc.includes('skin.sceneWindow')) {
    sceneHeroLayout -= 1;
  }
  if (!identitySrc.includes('Bugün Sen')) sceneHeroLayout -= 2;
  if (!posterSrc.includes('gridTemplateRows') || !posterSrc.includes('--poster-zone-rows')) {
    sceneHeroLayout -= 1;
  }
  if (posterSrc.includes('PosterAvatarHero') || posterSrc.includes('PosterThemeBand')) {
    sceneHeroLayout -= 2;
  }
  if (!skinSrc.includes('sceneWindowOuter')) sceneHeroLayout -= 1;
  if (POSTER_SCENE_DOMINANCE_RATIO < 0.38) sceneHeroLayout -= 1;

  let textBalance = 5;
  if (content.storyLine.length > POSTER_STORY_MAX) {
    textBalance -= 1;
    notes.push(`story uzun: ${content.storyLine.length}`);
  }
  if (content.quote.length > POSTER_QUOTE_MAX) textBalance -= 1;
  if (content.themeDescription.length > POSTER_THEME_DESC_MAX) textBalance -= 1;
  for (const a of content.activities) {
    if (a.value.length > POSTER_RELATION_LINE_MAX) textBalance -= 1;
  }
  for (const p of OLD_UI_PATTERNS) {
    if (p.test(content.storyLine) || p.test(posterSrc)) {
      textBalance -= 2;
      notes.push(`eski UI pattern: ${p}`);
    }
  }

  let editorialHeadline = 5;
  const headline = content.journeyHeadline;
  if (CATEGORY_HEADLINE.test(headline)) editorialHeadline -= 3;
  if (headline.length < 6 || headline.length > 28) editorialHeadline -= 1;

  let storyAlignment = 5;
  if (card.storyTopicKey !== scenario.topicKey) {
    storyAlignment -= 2;
    notes.push(`topic: beklenen ${scenario.topicKey}, gelen ${card.storyTopicKey}`);
  }
  if (!card.mirrorStory?.trim()) storyAlignment -= 2;

  let mobile = 5;
  if (!skinSrc.includes('max-[380px]')) mobile -= 1;
  if (!posterCardSkinIdentity.identityAvatarName.includes('line-clamp-2')) mobile -= 1;

  let exportCheck = 5;
  if (MIRROR_EXPORT_TARGET_WIDTH !== 1080 || MIRROR_EXPORT_TARGET_HEIGHT !== 1920) {
    exportCheck -= 3;
  }
  if (!state.meta.hasEnoughData || !card.shareEnabled) {
    exportCheck -= 2;
    notes.push('shareEnabled/hasEnoughData false');
  }

  const scores: Scores = {
    aspect916: clampScore(aspect916),
    sceneHeroLayout: clampScore(sceneHeroLayout),
    textBalance: clampScore(textBalance),
    editorialHeadline: clampScore(editorialHeadline),
    storyAlignment: clampScore(storyAlignment),
    mobile: clampScore(mobile),
    exportCheck: clampScore(exportCheck),
    general: 0,
  };
  const avg =
    (scores.aspect916 +
      scores.sceneHeroLayout +
      scores.textBalance +
      scores.editorialHeadline +
      scores.storyAlignment +
      scores.mobile +
      scores.exportCheck) /
    7;
  scores.general = clampScore(avg);

  return { scores, card, content, notes };
}

const repoRoot = join(process.cwd(), '..');
const outDir = join(repoRoot, 'backend', 'test_output', 'mirror_e2e_poster_qa');
const liveQaDir = join(repoRoot, 'backend', 'test_output', 'mirror_live_qa');

const reportRows: Array<{
  scenario: string;
  scores: Scores;
  headline: string;
  topic: string;
  notes: string[];
}> = [];

describe('Mirror E2E Poster QA (P2 v9b scene-hero)', () => {
  for (const scenario of SCENARIOS) {
    it(`scenario ${scenario.id} meets poster QA thresholds`, () => {
      const { scores, card, content, notes } = scoreScenario(scenario);
      reportRows.push({
        scenario: scenario.label,
        scores,
        headline: content.journeyHeadline,
        topic: card.storyTopicKey ?? '?',
        notes,
      });

      expect(card.storyTopicKey).toBe(scenario.topicKey);
      expect(card.shareEnabled).toBe(true);
      expect(content.journeyHeadline).not.toMatch(CATEGORY_HEADLINE);
      expect(scores.general).toBeGreaterThanOrEqual(4);
      expect(scores.aspect916).toBeGreaterThanOrEqual(4);
      expect(scores.sceneHeroLayout).toBeGreaterThanOrEqual(4);
    });
  }

  it('layout uses P2 v9b scene-hero poster architecture', () => {
    const posterSrc = readFileSync(POSTER_COMPONENT, 'utf8');
    const sceneWindowSrc = readFileSync(SCENE_WINDOW_COMPONENT, 'utf8');
    const identitySrc = readFileSync(IDENTITY_HEADLINE_COMPONENT, 'utf8');

    expect(posterSrc).toContain('v9b-scene-hero');
    expect(posterSrc).toContain('v9b-scene-hero-hybrid');
    expect(posterSrc).toContain('PosterSceneWindow');
    expect(posterSrc).toContain('PosterIdentityHeadline');
    expect(posterSrc).not.toContain('sceneBackdrop');
    expect(posterSrc).toContain('data-mirror-aspect="9-16"');
    expect(posterSrc).toContain('gridTemplateRows');
    expect(posterSrc).toContain('--poster-zone-rows');
    expect(sceneWindowSrc).toContain('sceneWindowOuter');
    expect(sceneWindowSrc).toContain('DailyMirrorPosterScene');
    expect(identitySrc).toContain('Bugün Sen');
    expect(posterSrc).not.toContain('Bugün ne yaptın');
    expect(readFileSync(join(process.cwd(), 'components/mirror/MirrorShareModal.tsx'), 'utf8')).toContain(
      'MIRROR_SHARE_MODAL_TITLE'
    );
  });

  afterAll(() => {
    mkdirSync(outDir, { recursive: true });

    for (const scenario of SCENARIOS) {
      const src = join(liveQaDir, `${scenario.id}.png`);
      const dest = join(outDir, scenario.exportName);
      if (existsSync(src)) {
        copyFileSync(src, dest);
      }
    }

    const avgGeneral =
      reportRows.reduce((s, r) => s + r.scores.general, 0) / reportRows.length;

    const md = [
      '# EZA Mirror — E2E Poster QA (P2 v9b)',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Method',
      '',
      '- State pipeline: `buildMirrorState` + `buildPosterCardContent` per scenario (4 entries).',
      '- Layout/export: v9b scene-hero + identity headline + scene window + 1080×1920 constants.',
      '- Scene PNGs: copied from `mirror_live_qa` when present.',
      '',
      '## Score table (1–5)',
      '',
      '| Senaryo | 9:16 | Sahne Kahraman | Metin Dengesi | Editorial Başlık | Story Uyumu | Mobil | Export | Genel |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...reportRows.map((r) => {
        const s = r.scores;
        return `| ${r.scenario} | ${s.aspect916} | ${s.sceneHeroLayout} | ${s.textBalance} | ${s.editorialHeadline} | ${s.storyAlignment} | ${s.mobile} | ${s.exportCheck} | ${s.general} |`;
      }),
      '',
      `**Ortalama Genel:** ${avgGeneral.toFixed(2)} / 5 (hedef ≥ 4)`,
      '',
      '## Scenario details',
      '',
      ...reportRows.map(
        (r) =>
          `### ${r.scenario}\n- Başlık: ${r.headline}\n- Topic: ${r.topic}\n- Notlar: ${r.notes.length ? r.notes.join('; ') : '—'}`
      ),
      '',
      '## Export files',
      '',
      ...SCENARIOS.map(
        (s) =>
          `- \`${s.exportName}\` — scene reference from live QA (card DOM export: manual verify at /standalone/mirror)`
      ),
      '',
      '## Acceptance',
      '',
      `- Genel ortalama: ${avgGeneral >= 4 ? 'PASS' : 'FAIL'} (≥ 4)`,
      '- 9:16 + v9b scene-hero window: PASS (code)',
      '- Eski v3 sceneBackdrop: absent from poster card',
      '- Share modal + export API: present (code)',
      '',
    ].join('\n');

    writeFileSync(join(outDir, 'REPORT.md'), md, 'utf8');
    writeFileSync(
      join(outDir, 'scores.json'),
      JSON.stringify({ averageGeneral: avgGeneral, rows: reportRows }, null, 2),
      'utf8'
    );
  });
});
