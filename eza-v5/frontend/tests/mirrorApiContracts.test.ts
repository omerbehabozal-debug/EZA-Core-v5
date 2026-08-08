import { describe, expect, it } from 'vitest';
import {
  API_CONTRACT_INVALID,
  MirrorApiContractError,
  validateDiscoverList,
  validateGenerateSceneResponse,
  validatePrepareDirectorResponse,
  validatePublicMirrorBySlug,
  validatePublishResponse,
} from '@/lib/eza/mirror/mirrorApiContracts';

describe('mirrorApiContracts', () => {
  it('accepts correct prepare director response', () => {
    const out = validatePrepareDirectorResponse({
      usedDirector: true,
      directorMode: 'FULL',
      mappedPrompt: { prompt: 'VISUAL NARRATIVE:\nstone courtyard' },
    });
    expect(out.usedDirector).toBe(true);
    expect(out.directorMode).toBe('FULL');
  });

  it('unwraps double-wrapped prepare payload', () => {
    const out = validatePrepareDirectorResponse({
      ok: true,
      data: {
        data: {
          usedDirector: false,
          directorMode: 'LEGACY',
        },
      },
    });
    expect(out.directorMode).toBe('LEGACY');
  });

  it('rejects malformed prepare missing usedDirector', () => {
    expect(() =>
      validatePrepareDirectorResponse({ directorMode: 'FULL' })
    ).toThrow(MirrorApiContractError);
    try {
      validatePrepareDirectorResponse({ directorMode: 'FULL' });
    } catch (err) {
      expect(err).toBeInstanceOf(MirrorApiContractError);
      expect((err as MirrorApiContractError).code).toBe(API_CONTRACT_INVALID);
    }
  });

  it('rejects D2 usedDirector without mappedPrompt or interpretation', () => {
    expect(() =>
      validatePrepareDirectorResponse({
        usedDirector: true,
        directorMode: 'SOFT',
      })
    ).toThrow(/mappedPrompt or finalInterpretation/);
  });

  it('requires sceneImageUrl for generate-scene', () => {
    const ok = validateGenerateSceneResponse({
      data: { sceneImageUrl: 'https://cdn.example/a.png', provider: 'mock' },
    });
    expect(ok.sceneImageUrl).toContain('cdn.example');
    expect(() => validateGenerateSceneResponse({ provider: 'mock' })).toThrow(
      /sceneImageUrl/
    );
  });

  it('requires slug and shareUrl for publish', () => {
    const ok = validatePublishResponse({
      slug: 'family-suv',
      shareUrl: 'https://saina.app/m/family-suv',
      publicTitle: 'Title',
      publicSummary: 'Summary',
    });
    expect(ok.slug).toBe('family-suv');
    expect(() => validatePublishResponse({ slug: 'x' })).toThrow(/shareUrl/);
  });

  it('requires slug and title for public mirror by slug', () => {
    const ok = validatePublicMirrorBySlug({
      slug: 'mardin',
      publicTitle: 'Mardin Terrace',
    });
    expect(ok.slug).toBe('mardin');
    expect(() => validatePublicMirrorBySlug({ slug: 'x' })).toThrow(/cardTitle/);
  });

  it('requires items array for discover list', () => {
    const ok = validateDiscoverList({ items: [], total: 0 });
    expect(ok.items).toEqual([]);
    expect(() => validateDiscoverList({ total: 0 })).toThrow(/items/);
  });
});
