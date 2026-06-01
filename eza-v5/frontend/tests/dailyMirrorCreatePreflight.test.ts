import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

describe('Daily Mirror create preflight', () => {
  it('checks sample count before daily quota and reveal', () => {
    const samplesIdx = experienceSrc.indexOf('MIRROR_MIN_SAMPLES');
    const quotaIdx = experienceSrc.indexOf('canCreateFreeMirrorToday');
    const revealIdx = experienceSrc.indexOf("setDailyStatus('revealing')");
    expect(samplesIdx).toBeGreaterThan(-1);
    expect(quotaIdx).toBeGreaterThan(samplesIdx);
    expect(revealIdx).toBeGreaterThan(quotaIdx);
  });

  it('marks free quota only after successful ready in commitMirrorReady', () => {
    expect(experienceSrc).toMatch(/saveDailyMirrorSnapshot/);
    expect(experienceSrc).toMatch(
      /setDailyStatus\('ready'\);\s*\r?\n\s*saveDailyMirrorSnapshot[\s\S]*?if \(!isPlus\) \{\s*\r?\n\s*markFreeMirrorUsedToday/
    );
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
