/**
 * prepareDirectorDraft response unwrap — FastAPI body vs apiClient nested data.
 */

import { describe, expect, it } from 'vitest';
import { unwrapPrepareDirectorResult } from '@/lib/eza/mirror/prepareDirectorDraftApi';

describe('unwrapPrepareDirectorResult', () => {
  it('reads nested data when present (chat-style envelope)', () => {
    const prepared = {
      directorEnabled: true,
      usedDirector: true,
      directorMode: 'FULL',
      applyPrompt: true,
      mappedPrompt: { prompt: 'VISUAL NARRATIVE:\nx' },
    };
    const out = unwrapPrepareDirectorResult({
      ok: true,
      data: prepared,
    });
    expect(out?.usedDirector).toBe(true);
    expect(out?.directorMode).toBe('FULL');
  });

  it('reads FastAPI response_model fields spread onto res when data is undefined', () => {
    // Reproduces production bug: apiClient set data: data.data → undefined
    // while spreading directorEnabled/usedDirector onto the response object.
    const out = unwrapPrepareDirectorResult({
      ok: true,
      data: undefined,
      directorEnabled: true,
      usedDirector: true,
      directorMode: 'FULL',
      applyTitle: true,
      applyPrompt: true,
      mappedPrompt: {
        title: "Mardin's Quiet Corners",
        prompt: 'VISUAL NARRATIVE:\nyellow stone',
        promptContract: 'saina_mirror_v5_minimal',
      },
      promptSource: 'interpretation_v5_mapper',
    });
    expect(out).not.toBeNull();
    expect(out?.usedDirector).toBe(true);
    expect(out?.mappedPrompt?.prompt).toContain('VISUAL NARRATIVE');
    expect(out?.directorMode).toBe('FULL');
  });

  it('returns null for empty/invalid envelopes', () => {
    expect(unwrapPrepareDirectorResult({ ok: true, data: undefined })).toBeNull();
    expect(unwrapPrepareDirectorResult({ ok: true, data: {} })).toBeNull();
  });
});
