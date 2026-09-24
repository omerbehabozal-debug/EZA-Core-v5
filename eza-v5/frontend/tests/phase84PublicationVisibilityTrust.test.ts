/**
 * Phase 8.4 — publication visibility & trust UI contracts.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  YANSI_REPORT_REASONS,
  type YansiReportReason,
} from '@/lib/eza/mirror-network/yansiTrustActions';

describe('Phase 8.4 trust actions', () => {
  it('exposes a small report reason taxonomy', () => {
    const ids = YANSI_REPORT_REASONS.map((r) => r.id);
    expect(ids).toEqual(['inappropriate', 'misleading', 'privacy', 'other']);
    const sample: YansiReportReason = 'privacy';
    expect(ids).toContain(sample);
  });

  it('landing wires secondary trust actions on Reel chrome', () => {
    const landing = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorLandingExperience.tsx'),
      'utf8'
    );
    const chain = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorYansiChainExperience.tsx'),
      'utf8'
    );
    expect(landing).toContain('MirrorYansiChainExperience');
    expect(landing).not.toContain('mirror-experience-start');
    expect(chain).toContain('YansiTrustActions');
  });

  it('trust actions keep report + owner unpublish as secondary controls', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/mirror-landing/YansiTrustActions.tsx'),
      'utf8'
    );
    expect(src).toContain('yansi-report-open');
    expect(src).toContain('yansi-unpublish');
    expect(src).toContain('yansi-set-unlisted');
    expect(src).toContain('Bildir');
    expect(src).toContain('Yayından kaldır');
  });

  it('client helpers post to canonical Phase 8.4 endpoints', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror-network/yansiTrustActions.ts'),
      'utf8'
    );
    expect(src).toContain('/report');
    expect(src).toContain('/unpublish');
    expect(src).toContain('/visibility');
    expect(src).not.toContain('experienceStartedCount');
    expect(src).not.toContain('strong_curiosity');
  });
});
