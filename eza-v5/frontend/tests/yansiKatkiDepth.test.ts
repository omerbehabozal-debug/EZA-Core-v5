import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/apiClient';
import {
  closedKatkiDepth,
  escapeKatki,
  katkiOwnsWheel,
  openKatkiChoose,
  openKatkiList,
  openKatkiTypeChoice,
  returnKatkiToTypeChoice,
  selectKatkiType,
} from '@/lib/eza/mirror-network/katkiDepth';
import {
  KATKI_EMPTY_COPY_FORBIDDEN,
  KATKI_CREATE_ORDER,
  buildKatkiCreatePayload,
  createPublicKatki,
  fetchPublicKatki,
  formatKatkiReelCount,
  groupVisibleKatki,
  katkiCreateErrorMessage,
  katkiReelSignal,
  mergeCreatedKatki,
  validateKatkiDraft,
  type PublicKatkiContribution,
} from '@/lib/eza/mirror-network/katkiPublic';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function row(
  overrides: Partial<PublicKatkiContribution> & Pick<PublicKatkiContribution, 'contributionId' | 'type'>
): PublicKatkiContribution {
  return {
    body: 'Bu satır yeterince uzun bir katkı metnidir.',
    sourceNote: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    contributor: {
      displayName: 'Ada',
      publicAvatarUrl: '/api/public/profile-avatars/ada.png',
      publicAvatarRevision: 3,
    },
    ...overrides,
  };
}

describe('katki depth state', () => {
  it('walks reel to contributions to composer and back', () => {
    const opened = openKatkiList('Yansi-A', 4);
    expect(opened.stage).toBe('list');
    expect(opened.slug).toBe('yansi-a');
    expect(opened.journeyVersion).toBe(4);

    const choosing = openKatkiTypeChoice(opened);
    expect(choosing.stage).toBe('choose');

    const composing = selectKatkiType(choosing, 'correction');
    expect(composing.stage).toBe('compose');
    expect(composing.selectedType).toBe('correction');

    const backToChoice = returnKatkiToTypeChoice(composing);
    expect(backToChoice.stage).toBe('choose');
    expect(backToChoice.selectedType).toBe('correction');

    const backToList = escapeKatki(backToChoice);
    expect(backToList.stage).toBe('list');

    expect(escapeKatki(backToList)).toEqual(closedKatkiDepth());
  });

  it('keeps composer and conversation from sharing a stage', () => {
    const list = openKatkiList('yansi-a', 2);
    expect(katkiOwnsWheel('closed')).toBe(false);
    expect(katkiOwnsWheel(list.stage)).toBe(true);
    expect(katkiOwnsWheel('compose')).toBe(true);
    expect(escapeKatki(list).stage).toBe('closed');
  });

  it('opens type choice directly for the reel zero state', () => {
    const chosen = openKatkiChoose('Yansi-A', 4);
    expect(chosen.stage).toBe('choose');
    expect(chosen.slug).toBe('yansi-a');
    expect(chosen.journeyVersion).toBe(4);
    expect(escapeKatki(chosen).stage).toBe('closed');
    expect(selectKatkiType(chosen, 'verify').stage).toBe('choose');
  });

  it('returns from a text composer to type choice without closing', () => {
    const listed = openKatkiTypeChoice(openKatkiList('yansi-a', 2));
    const extra = selectKatkiType(listed, 'additional_information');
    const back = escapeKatki(extra);
    expect(back.stage).toBe('choose');
    const other = selectKatkiType(back, 'different_perspective');
    expect(other.stage).toBe('compose');
    expect(other.selectedType).toBe('different_perspective');
  });

  it('clears a draft when reel travel closes the depth', () => {
    const dirty = {
      ...selectKatkiType(openKatkiTypeChoice(openKatkiList('yansi-a', 2)), 'correction'),
      body: 'taslak metin burada duruyor',
      sourceNote: 'eski not',
    };
    expect(escapeKatki(escapeKatki(escapeKatki(dirty)))).toEqual(closedKatkiDepth());
  });
});

describe('katki read model', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('requests the exact slug and journey version', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        slug: 'yansi-a',
        journeyVersion: 4,
        totalVisibleCount: 0,
        countsByType: {
          verify: 0,
          correction: 0,
          additional_information: 0,
          different_perspective: 0,
        },
        contributions: [],
      },
    });
    const result = await fetchPublicKatki('Yansi-A', 4);
    expect(result.ok).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/mirror-network/yansi-a/contributions',
      {
        auth: false,
        timeoutMs: 15_000,
        params: { journeyVersion: '4' },
      }
    );
  });

  it('refuses a read without a journey version', async () => {
    const result = await fetchPublicKatki('yansi-a', 0);
    expect(result.ok).toBe(false);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('does not invent a count from the contribution list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        slug: 'yansi-a',
        journeyVersion: 4,
        contributions: [{ contributionId: 'x' }],
      },
    });
    const missing = await fetchPublicKatki('yansi-a', 4);
    expect(missing.ok).toBe(false);

    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        slug: 'yansi-a',
        journeyVersion: 9,
        totalVisibleCount: 7,
        contributions: [],
      },
    });
    const otherVersion = await fetchPublicKatki('yansi-a', 4);
    expect(otherVersion.ok).toBe(false);
  });

  it('treats a missing verify flag as false and ignores aggregate counts', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        slug: 'yansi-a',
        journeyVersion: 4,
        totalVisibleCount: 3,
        countsByType: {
          verify: 3,
          correction: 0,
          additional_information: 0,
          different_perspective: 0,
        },
        contributions: [],
      },
    });
    const missing = await fetchPublicKatki('yansi-a', 4);
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.data.viewerHasActiveVerify).toBe(false);

    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        slug: 'yansi-a',
        journeyVersion: 4,
        totalVisibleCount: 0,
        countsByType: {
          verify: 0,
          correction: 0,
          additional_information: 0,
          different_perspective: 0,
        },
        contributions: [],
        viewerHasActiveVerify: 'yes',
      },
    });
    const invalid = await fetchPublicKatki('yansi-a', 4);
    expect(invalid.ok).toBe(true);
    if (invalid.ok) expect(invalid.data.viewerHasActiveVerify).toBe(false);
    expect(KATKI_CREATE_ORDER.map((group) => group.label)).toEqual([
      'Düzeltme',
      'Ek Bilgi',
      'Farklı Bakış',
    ]);
  });

  it('orders groups and omits empty ones', () => {
    const groups = groupVisibleKatki([
      row({ contributionId: 'p', type: 'different_perspective', createdAt: '2026-10-03T00:00:00.000Z' }),
      row({ contributionId: 'v', type: 'verify', body: null, createdAt: '2026-10-01T00:00:00.000Z' }),
      row({ contributionId: 'a', type: 'additional_information', createdAt: '2026-10-02T00:00:00.000Z' }),
    ]);
    expect(groups.map((group) => group.type)).toEqual([
      'verify',
      'additional_information',
      'different_perspective',
    ]);
  });

  it('inserts a created row once in backend order', () => {
    const existing = row({
      contributionId: 'b',
      type: 'verify',
      createdAt: '2026-10-02T00:00:00.000Z',
    });
    const created = row({
      contributionId: 'a',
      type: 'correction',
      createdAt: '2026-10-02T00:00:00.000Z',
    });
    const once = mergeCreatedKatki(null, created, 'yansi-a', 2);
    const again = mergeCreatedKatki(once, created, 'yansi-a', 2);
    expect(again.contributions).toHaveLength(1);
    const withExisting = mergeCreatedKatki(
      { ...once, contributions: [existing, created], totalVisibleCount: 2, countsByType: once.countsByType },
      created,
      'yansi-a',
      2
    );
    expect(withExisting.contributions.map((item) => item.contributionId)).toEqual(['b', 'a']);
  });
});

describe('katki create payload', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('sends only version, type, body, and source note', () => {
    const payload = buildKatkiCreatePayload({
      journeyVersion: 4,
      type: 'verify',
      body: null,
      sourceNote: null,
    });
    expect(Object.keys(payload).sort()).toEqual(['body', 'journeyVersion', 'sourceNote', 'type']);
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('contributorUserId');
    expect(payload).not.toHaveProperty('scope');
    expect(payload).not.toHaveProperty('stepIndex');
    expect(payload).not.toHaveProperty('conversationId');
    expect(payload).not.toHaveProperty('messageId');
    expect(payload).not.toHaveProperty('sceneAssetId');
    expect(payload).not.toHaveProperty('generationId');
  });

  it('trims before send', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      data: row({ contributionId: 'new', type: 'correction' }),
    });
    await createPublicKatki({
      slug: 'Yansi-A',
      journeyVersion: 4,
      type: 'correction',
      body: '  bu metin yirmi karakteri asiyor  ',
      sourceNote: '  not  ',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/mirror-network/yansi-a/contributions',
      expect.objectContaining({
        auth: true,
        body: {
          journeyVersion: 4,
          type: 'correction',
          body: 'bu metin yirmi karakteri asiyor',
          sourceNote: 'not',
        },
      })
    );
  });

  it('allows an empty verify and blocks a short one', () => {
    expect(validateKatkiDraft('verify', '   ', '  ')).toEqual({
      ok: true,
      body: null,
      sourceNote: null,
    });
    expect(validateKatkiDraft('verify', 'kisa', '').ok).toBe(false);
    expect(validateKatkiDraft('correction', '', '').ok).toBe(false);
    expect(validateKatkiDraft('additional_information', 'on dokuz karakter..', '').ok).toBe(false);
    expect(validateKatkiDraft('different_perspective', 'x'.repeat(19), '').ok).toBe(false);
    expect(validateKatkiDraft('correction', 'x'.repeat(20), 'y'.repeat(501)).ok).toBe(false);
    expect(validateKatkiDraft('correction', 'x'.repeat(20), '  kaynak  ')).toEqual({
      ok: true,
      body: 'x'.repeat(20),
      sourceNote: 'kaynak',
    });
  });

  it('increments totalVisibleCount instead of recounting the local list', () => {
    const base = mergeCreatedKatki(null, row({ contributionId: 'a', type: 'verify' }), 'yansi-a', 2);
    const seeded = { ...base, totalVisibleCount: 7, countsByType: { ...base.countsByType, verify: 7 } };
    const next = mergeCreatedKatki(
      seeded,
      row({ contributionId: 'b', type: 'correction' }),
      'yansi-a',
      2
    );
    expect(next.totalVisibleCount).toBe(8);
    expect(next.countsByType.correction).toBe(1);
    expect(formatKatkiReelCount(next.totalVisibleCount)).toBe('8 katkı');
  });

  it('hides the reel signal until a real total exists', () => {
    expect(katkiReelSignal('loading', null)).toBe('hidden');
    expect(katkiReelSignal('loading', 0)).toBe('hidden');
    expect(katkiReelSignal('error', 0)).toBe('hidden');
    expect(katkiReelSignal('idle', 0)).toBe('hidden');
    expect(katkiReelSignal('ready', 0)).toBe('create');
    expect(katkiReelSignal('ready', 7)).toBe('count');
    expect(formatKatkiReelCount(7)).toBe('7 katkı');
  });

  it('maps errors without raw backend text', () => {
    expect(katkiCreateErrorMessage('auth_required')).toBe('auth');
    expect(katkiCreateErrorMessage('active_contribution_exists')).toContain('aktif bir katkın');
    expect(katkiCreateErrorMessage('katki_create_rate_limited')).toContain('sınırına');
    expect(katkiCreateErrorMessage('frozen_journey_not_found')).not.toContain('SQL');
    expect(katkiCreateErrorMessage('invalid_body')).not.toContain('{');
    expect(KATKI_EMPTY_COPY_FORBIDDEN).toEqual([
      '0 katkı',
      'Henüz katkı yok',
      'İlk katkıyı sen yap',
    ]);
  });
});
