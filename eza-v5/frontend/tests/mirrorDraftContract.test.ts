import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MIRROR_ART_DIRECTION_IDS,
  MIRROR_DRAFT_REQUIRED_FIELDS,
  MIRROR_DRAFT_SCHEMA_VERSION,
  MIRROR_DIRECTOR_REVIEW_SCHEMA_VERSION,
} from '@/lib/eza/mirror/director/mirrorDraftTypes';

describe('Mirror Draft contract parity (PR B)', () => {
  it('schema version literals match backend', () => {
    expect(MIRROR_DRAFT_SCHEMA_VERSION).toBe('mirror-draft-v1');
    expect(MIRROR_DIRECTOR_REVIEW_SCHEMA_VERSION).toBe('mirror-director-review-v1');
  });

  it('art direction allowlist matches season registry set', () => {
    expect([...MIRROR_ART_DIRECTION_IDS].sort()).toEqual(
      [
        'bright_cinematic',
        'editorial_magazine',
        'film_poster',
        'golden_hour',
        'night_discovery',
        'quiet_luxury',
      ].sort()
    );
  });

  it('Python draft schema file declares the same version + art directions', () => {
    const pyPath = join(
      process.cwd(),
      '..',
      'backend',
      'core',
      'schemas',
      'mirror_draft.py'
    );
    const src = readFileSync(pyPath, 'utf8');
    expect(src).toContain('mirror-draft-v1');
    expect(src).toContain('mirror-director-review-v1');
    for (const id of MIRROR_ART_DIRECTION_IDS) {
      expect(src).toContain(`"${id}"`);
    }
    for (const field of MIRROR_DRAFT_REQUIRED_FIELDS) {
      expect(src).toContain(field);
    }
  });

  it('chat stream hook does not import Director draft modules', () => {
    const chatInner = readFileSync(
      join(process.cwd(), 'components', 'standalone', 'StandaloneChatInner.tsx'),
      'utf8'
    );
    const stream = readFileSync(join(process.cwd(), 'hooks', 'useStreamResponse.ts'), 'utf8');
    const banned = /mirrorDraftTypes|mirror_director_orchestrator|mirror_draft_generation/;
    expect(chatInner).not.toMatch(banned);
    expect(stream).not.toMatch(banned);
  });
});
