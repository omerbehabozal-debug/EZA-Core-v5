import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginNewCoverImageSuggestionAttempt,
  beginNewCoverSuggestionAttempt,
  coverImageSuggestionIdempotencyKey,
  coverSuggestionAttemptStorageKey,
  coverSuggestionIdempotencyKey,
  createCoverSuggestionAttemptId,
  readCoverSuggestionAttemptId,
  resolveCoverImageSuggestionAttempt,
  resolveCoverSuggestionAttempt,
  writeCoverSuggestionAttemptId,
} from '@/lib/eza/business/coverSuggestionAttempt';

describe('cover suggestion attempt identity', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates collision-resistant attempt ids that are not local counters', () => {
    const a = createCoverSuggestionAttemptId();
    const b = createCoverSuggestionAttemptId();
    expect(a).not.toEqual(b);
    expect(a).not.toMatch(/^a?\d+$/);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it('preserves the same attempt across remount resolve and network retry', () => {
    const first = resolveCoverSuggestionAttempt('biz-1', 'asset-1', 3, null);
    const remount = resolveCoverSuggestionAttempt('biz-1', 'asset-1', 3, null);
    const retry = resolveCoverSuggestionAttempt('biz-1', 'asset-1', 3, first);
    expect(remount).toBe(first);
    expect(retry).toBe(first);
    expect(readCoverSuggestionAttemptId('biz-1', 'asset-1', 3)).toBe(first);
  });

  it('page reload keeps the stored attempt for the same source revision', () => {
    writeCoverSuggestionAttemptId('biz-1', 'asset-1', 2, 'reload-attempt-abc');
    expect(readCoverSuggestionAttemptId('biz-1', 'asset-1', 2)).toBe('reload-attempt-abc');
    expect(resolveCoverSuggestionAttempt('biz-1', 'asset-1', 2, null)).toBe('reload-attempt-abc');
  });

  it('switching source assets uses independent attempt slots', () => {
    const film = resolveCoverSuggestionAttempt('biz-1', 'film-a', 1, null);
    const other = resolveCoverSuggestionAttempt('biz-1', 'film-b', 1, null);
    expect(film).not.toBe(other);
    expect(readCoverSuggestionAttemptId('biz-1', 'film-a', 1)).toBe(film);
    expect(readCoverSuggestionAttemptId('biz-1', 'film-b', 1)).toBe(other);
  });

  it('explicit regenerations mint a new attempt id', () => {
    const first = resolveCoverSuggestionAttempt('biz-1', 'asset-1', 1, null);
    const second = beginNewCoverSuggestionAttempt('biz-1', 'asset-1', 1);
    const third = beginNewCoverSuggestionAttempt('biz-1', 'asset-1', 1);
    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
    expect(readCoverSuggestionAttemptId('biz-1', 'asset-1', 1)).toBe(third);
  });

  it('idempotency keys embed the attempt id and revision', () => {
    const key = coverSuggestionIdempotencyKey('asset-9', 4, 'att-xyz');
    expect(key).toBe('cover-video-asset-9-r4-aatt-xyz');
    expect(coverSuggestionAttemptStorageKey('biz', 'asset-9', 4)).toContain('asset-9:r4');
  });

  it('does not invent a new id when current in-memory attempt already exists', () => {
    const created = beginNewCoverSuggestionAttempt('biz-1', 'asset-1', 1);
    const spy = vi.spyOn(crypto, 'randomUUID');
    const resolved = resolveCoverSuggestionAttempt('biz-1', 'asset-1', 1, created);
    expect(resolved).toBe(created);
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps image cover attempts separate from video attempts', () => {
    const video = resolveCoverSuggestionAttempt('biz-1', 'same-id', 1, null);
    const image = resolveCoverImageSuggestionAttempt('biz-1', 'same-id', 1, null);
    expect(image).not.toBe(video);
    expect(coverImageSuggestionIdempotencyKey('draft-9', 2, 'att-1')).toBe('cover-image-draft-9-r2-aatt-1');
    const again = beginNewCoverImageSuggestionAttempt('biz-1', 'same-id', 1);
    expect(again).not.toBe(image);
  });
});
