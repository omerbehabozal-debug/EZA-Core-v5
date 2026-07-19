import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

describe('Daily Mirror create preflight', () => {
  it('checks sample count before reveal', () => {
    const samplesIdx = experienceSrc.indexOf('MIRROR_MIN_SAMPLES');
    const revealIdx = experienceSrc.indexOf("setDailyStatus('revealing')");
    expect(samplesIdx).toBeGreaterThan(-1);
    expect(revealIdx).toBeGreaterThan(samplesIdx);
  });

  it('gates visual create on account entitlements before generate-scene', () => {
    expect(experienceSrc).toContain('canCreateVisual');
    expect(experienceSrc).toContain('canCreateVisualFromEntitlements');
    const canIdx = experienceSrc.indexOf('if (!canCreateVisual) return');
    const generateIdx = experienceSrc.indexOf('generateMirrorScene(');
    expect(canIdx).toBeGreaterThan(-1);
    expect(generateIdx).toBeGreaterThan(canIdx);
  });

  it('arms auto scene generation only on explicit create/update paths', () => {
    expect(experienceSrc).toContain('allowAutoSceneGenerationRef');
    expect(experienceSrc).toContain('shouldAutoGenerateMirrorScene');
    expect(experienceSrc).toMatch(
      /allowAutoSceneGenerationRef\.current = true[\s\S]*setDailyStatus\('ready'\)/
    );
  });

  it('defers network publish until scene exists', () => {
    expect(experienceSrc).toContain('Defer network publish until scene exists');
    const commitIdx = experienceSrc.indexOf('const commitMirrorReady');
    const commitBlock = experienceSrc.slice(commitIdx, commitIdx + 1800);
    expect(commitBlock).not.toMatch(/void prepareMirrorShareLink\(card\)/);
  });

  it('uses daily_limit and DailyLimitUpgrade for free quota', () => {
    expect(experienceSrc).toContain('daily_limit');
    expect(experienceSrc).toContain('DailyLimitUpgrade');
    expect(experienceSrc).not.toContain('MonthlyLimitUpgrade');
    expect(experienceSrc).not.toContain('canCreateFreeMirrorThisMonth');
  });

  it('uses snapshot refresh actions instead of Yeni Ayna Oluştur', () => {
    expect(experienceSrc).toContain('DailyMirrorRefreshActions');
    expect(experienceSrc).toContain('saveDailyMirrorSnapshot');
    expect(experienceSrc).not.toContain('FREE_MIRROR_CREATE_ANOTHER');
    expect(experienceSrc).not.toContain('MiniMirrorCard');
  });
});
