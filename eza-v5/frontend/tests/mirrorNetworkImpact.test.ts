import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatShareImpactContinuation,
  formatShareImpactYansi,
  SHARE_IMPACT_EMPTY,
} from '@/lib/eza/mirror-share/shareExperienceCopy';
import {
  fetchMirrorImpact,
  isMirrorImpactStats,
} from '@/lib/eza/mirror-network/fetchMirrorImpact';
import { resolveMirrorPublishLineage } from '@/lib/eza/mirror-share/resolveMirrorPublishLineage';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('@/lib/standaloneChatArchive', () => ({
  getChatArchive: vi.fn(),
}));

import { apiClient } from '@/lib/apiClient';
import { getChatArchive } from '@/lib/standaloneChatArchive';

describe('mirror network impact (Faz 2)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(getChatArchive).mockReset();
  });

  it('fetchMirrorImpact calls owner impact endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        mirrorId: 'parent-slug',
        publicSlug: 'parent-slug',
        shareUrl: 'https://saina.app/m/parent-slug',
        continuationStarts: 18,
        continuationStartsVerified: false,
        yansiCount: 3,
        landingViews: 10,
      },
    });

    const result = await fetchMirrorImpact('parent-slug');
    expect(result.ok).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith('/api/mirror-network/parent-slug/impact', {
      auth: true,
      timeoutMs: 15_000,
    });
  });

  it('fetchMirrorImpact rejects extra response keys', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ok: true,
      data: {
        mirrorId: 'parent-slug',
        publicSlug: 'parent-slug',
        shareUrl: 'https://saina.app/m/parent-slug',
        continuationStarts: 0,
        continuationStartsVerified: false,
        yansiCount: 1,
        landingViews: 0,
        userId: 'leak',
      },
    });

    const result = await fetchMirrorImpact('parent-slug');
    expect(result.ok).toBe(false);
  });

  it('isMirrorImpactStats enforces allowlist', () => {
    expect(
      isMirrorImpactStats({
        mirrorId: 'a',
        publicSlug: 'a',
        shareUrl: 'https://saina.app/m/a',
        continuationStarts: 0,
        continuationStartsVerified: false,
        yansiCount: 0,
        landingViews: 0,
      })
    ).toBe(true);
    expect(
      isMirrorImpactStats({
        mirrorId: 'a',
        publicSlug: 'a',
        shareUrl: 'https://saina.app/m/a',
        continuationStarts: 0,
        continuationStartsVerified: false,
        yansiCount: 0,
        landingViews: 0,
        conversationId: 'x',
      })
    ).toBe(false);
  });

  it('hides continuation line unless verified', () => {
    const shareSrc = readFileSync(
      join(process.cwd(), 'components/mirror/MirrorShareExperience.tsx'),
      'utf8'
    );
    expect(shareSrc).toContain('continuationStartsVerified');
    expect(shareSrc).toContain('showContinuation');
    expect(shareSrc).not.toMatch(/continuationStarts\s*>\s*0\s*\?/);
  });

  it('shows only yansi line when continuation is unverified', () => {
    const shareSrc = readFileSync(
      join(process.cwd(), 'components/mirror/MirrorShareExperience.tsx'),
      'utf8'
    );
    expect(shareSrc).toContain('showYansi');
    expect(shareSrc).toContain('formatShareImpactYansi');
  });

  it('share impact copy uses calm Ayna language', () => {
    expect(SHARE_IMPACT_EMPTY).toBe('Yansılar burada görünecek.');
    expect(formatShareImpactContinuation(18)).toBe("Bu Ayna'dan 18 sohbet başladı.");
    expect(formatShareImpactYansi(3)).toBe('3 Yansı oluştu.');
    expect(SHARE_IMPACT_EMPTY.toLowerCase()).not.toContain('viral');
    expect(SHARE_IMPACT_EMPTY.toLowerCase()).not.toContain('tebrik');
  });

  it('resolveMirrorPublishLineage prefers startedFromMirrorId', () => {
    vi.mocked(getChatArchive).mockReturnValue({
      id: 'chat-1',
      title: 't',
      preview: 'p',
      savedAt: 'now',
      messageCount: 1,
      messages: [],
      mirrorOrigin: {
        startedFromMirrorId: 'parent-slug',
        parentMirrorId: 'parent-slug',
        rootMirrorId: 'root-slug',
        seedTopic: 't',
        seedCategory: 'travel',
        seedMood: 'discovery',
        isGuestSession: true,
      },
    });

    const lineage = resolveMirrorPublishLineage({ conversationId: 'chat-1' });
    expect(lineage.parentSlug).toBe('parent-slug');
    expect(lineage.parentMirrorId).toBe('parent-slug');
    expect(lineage.rootMirrorId).toBe('root-slug');
  });

  it('public Ayna page does not render share impact block', () => {
    const landingSrc = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorLandingExperience.tsx'),
      'utf8'
    );
    expect(landingSrc).not.toContain('mirror-share-impact');
    expect(landingSrc).not.toContain('fetchMirrorImpact');
  });

  it('MirrorShareExperience hides impact on fetch failure', () => {
    const shareSrc = readFileSync(
      join(process.cwd(), 'components/mirror/MirrorShareExperience.tsx'),
      'utf8'
    );
    expect(shareSrc).toContain('setImpactFailed(true)');
    expect(shareSrc).toContain('data-testid="mirror-share-impact"');
  });
});
