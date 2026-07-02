import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildMirrorCuriosityPipeline } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { SHARE_INVITATION_CONTINUE_QUESTIONS } from '@/lib/eza/mirror-share/shareExperienceCopy';
import {
  applyShareUrlToCard,
  publishMirrorToNetwork,
} from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import { resolveMirrorShareCaption } from '@/lib/eza/mirror-share/resolveMirrorShareCaption';
import { buildShareBlueprint } from '@/lib/eza/mirror-share/buildShareBlueprint';

const BASE_PAYLOAD = {
  mirrorTitle: 'Sokak Lambaları',
  mirrorText: 'internal only',
  sceneMetaphor: 'kyoto street lamps at dusk',
  topic: 'travel',
  storyTopicId: 'travel',
  safetyLevel: 'normal',
  conversationEvidence: [
    { label: 'Japonya seyahati', visualHint: 'kyoto evening street', weight: 1 },
  ],
} as unknown as SainaMirrorV3Payload;

function buildTestCard(): DailyMirrorCardModel {
  const pipeline = buildMirrorCuriosityPipeline(BASE_PAYLOAD);
  const payload = { ...BASE_PAYLOAD, curiosityBundle: pipeline };
  return {
    date: '2026-05-31',
    dayLabel: '31 Mayıs',
    headline: 'Sokak Lambaları',
    characterName: 'SAINA',
    personaFamilyId: 'balanced_calm',
    shortInsight: '',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: '',
    energyLabel: '',
    energyScore: null,
    shareEnabled: true,
    privacyText: '',
    mirrorV3Payload: payload,
    mirrorShare: {
      blueprint: buildShareBlueprint(pipeline, 'japonya kyoto travel'),
      shareVoice: pipeline.shareVoice!,
      shareUrl: null,
    },
  };
}

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('@/lib/standaloneChatArchive', () => ({
  getChatArchive: vi.fn(),
}));

import { apiClient } from '@/lib/apiClient';
import { getChatArchive } from '@/lib/standaloneChatArchive';

describe('Mirror Network Publish (Stage 4C)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(getChatArchive).mockReturnValue(null);
  });

  it('publishMirrorToNetwork calls backend with curiosity bundle only in public path', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      slug: 'sokak-lambalari-abc123',
      shareUrl: 'https://saina.app/m/sokak-lambalari-abc123',
      cardTitle: 'Sokak Lambaları',
    });

    const card = buildTestCard();
    const result = await publishMirrorToNetwork({
      card,
      conversationId: 'conv-1',
      sceneImageUrl: 'https://cdn.example/scene.jpg',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.shareUrl).toContain('saina.app/m/');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/mirror-network/publish',
      expect.objectContaining({
        auth: true,
        body: expect.objectContaining({
          cardTitle: 'Sokak Lambaları',
          conversationId: 'conv-1',
          curiosityBundle: expect.any(Object),
          intelligencePrivate: expect.objectContaining({
            mirrorBody: 'internal only',
          }),
        }),
      })
    );

    const body = vi.mocked(apiClient.post).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('conversationId', undefined);
  });

  it('publishMirrorToNetwork sends parentSlug from conversation lineage', async () => {
    vi.mocked(getChatArchive).mockReturnValue({
      id: 'chat-lineage',
      title: 't',
      preview: 'p',
      savedAt: 'now',
      messageCount: 1,
      messages: [],
      treeMetadata: {
        groupId: 'g1',
        sourceType: 'mirror',
        startedFromMirrorId: 'parent-slug-xyz',
        parentMirrorId: 'parent-slug-xyz',
        rootMirrorId: 'root-slug-xyz',
      },
    });

    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      slug: 'child-slug-abc',
      shareUrl: 'https://saina.app/m/child-slug-abc',
      cardTitle: 'Sokak Lambaları',
    });

    await publishMirrorToNetwork({
      card: buildTestCard(),
      conversationId: 'chat-lineage',
    });

    const body = vi.mocked(apiClient.post).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.parentSlug).toBe('parent-slug-xyz');
  });

  it('applyShareUrlToCard sets shareUrl for caption layer 3', () => {
    const card = buildTestCard();
    const updated = applyShareUrlToCard(
      card,
      'https://saina.app/m/sokak-lambalari-abc123',
      'sokak-lambalari-abc123'
    );

    expect(updated.mirrorShare?.shareUrl).toBe('https://saina.app/m/sokak-lambalari-abc123');
    const caption = resolveMirrorShareCaption(updated);
    expect(caption).toContain('→ Buradan devam et.');
    expect(caption).toContain('saina.app/m/sokak-lambalari-abc123');
    expect(caption).toContain(SHARE_INVITATION_CONTINUE_QUESTIONS);
  });

  it('publish failure returns quiet fallback message', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: false,
      error: {
        error_code: 'publish_failed',
        error_message: 'Paylaşım bağlantısı hazırlanamadı.',
      },
    });

    const result = await publishMirrorToNetwork({ card: buildTestCard() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('hazırlanamadı');
  });
});
