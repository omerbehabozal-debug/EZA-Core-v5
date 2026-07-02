import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import * as sainaCopy from '@/lib/eza/sainaCopy';
import * as mirrorCopy from '@/lib/eza/mirror/copy';
import * as shareExperienceCopy from '@/lib/eza/mirror-share/shareExperienceCopy';
import * as mirrorBirthCopy from '@/lib/eza/mirror-birth/mirrorBirthCopy';
import MirrorLandingNotFound from '@/components/mirror-landing/MirrorLandingNotFound';

const MIRROR_WORD_RE = /\bmirror\b/i;
const LANDING_WORD_RE = /\blanding\b/i;

const PUBLIC_COPY_MODULES: Record<string, unknown>[] = [
  sainaCopy,
  mirrorCopy,
  shareExperienceCopy,
  mirrorBirthCopy,
];

function isUserFacingCopyEntry(key: string, value: string): boolean {
  if (value.startsWith('/')) return false;
  if (key.endsWith('_ROUTE')) return false;
  if (key.endsWith('_IMAGE')) return false;
  if (key.endsWith('_DURATION_MS')) return false;
  if (key.endsWith('_MS')) return false;
  return true;
}

function collectUserFacingStrings(module: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(module)) {
    if (typeof value === 'string' && isUserFacingCopyEntry(key, value)) {
      out.push(value);
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') out.push(item);
      }
    }
  }
  return out;
}

describe('ayna public copy regression (Faz 1)', () => {
  it('public copy constants do not contain the word Mirror', () => {
    for (const mod of PUBLIC_COPY_MODULES) {
      for (const text of collectUserFacingStrings(mod)) {
        expect(text, `unexpected Mirror in: ${text}`).not.toMatch(MIRROR_WORD_RE);
      }
    }
  });

  it('public copy constants do not contain the word Landing', () => {
    for (const mod of PUBLIC_COPY_MODULES) {
      for (const text of collectUserFacingStrings(mod)) {
        expect(text, `unexpected Landing in: ${text}`).not.toMatch(LANDING_WORD_RE);
      }
    }
  });

  it('share experience subtitle uses Ayna language', () => {
    expect(shareExperienceCopy.SHARE_EXPERIENCE_SUBTITLE).toContain('Ayna hazır');
  });

  it('mirror birth CTA uses Ayna language', () => {
    expect(mirrorBirthCopy.MIRROR_BIRTH_SUGGESTION_CTA).toBe('Ayna oluştur');
  });

  it('public not-found page does not show Mirror or Landing', () => {
    render(MirrorLandingNotFound());
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toMatch(/Bu Ayna bulunamadı/);
    expect(bodyText).not.toMatch(MIRROR_WORD_RE);
    expect(bodyText).not.toMatch(LANDING_WORD_RE);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bu Ayna bulunamadı');
  });

  it('share export and lightbox fallbacks use Ayna language', () => {
    const shareSrc = readFileSync(join(process.cwd(), 'lib/eza/mirror/shareExport.ts'), 'utf8');
    const lightboxSrc = readFileSync(
      join(process.cwd(), 'components/mirror/MirrorPosterLightbox.tsx'),
      'utf8'
    );
    const sohbetSrc = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorSohbetOpening.tsx'),
      'utf8'
    );
    expect(shareSrc).toContain("'EZA Ayna'");
    expect(lightboxSrc).toContain("'SAINA Ayna posteri'");
    expect(sohbetSrc).toMatch(/>\s*Ayna\s*</);
    expect(sohbetSrc).not.toMatch(/>\s*Mirror\s*</);
  });
});
