import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ezaExperience,
  EXPERIENCE_EVENT_ALLOWLIST,
  postExperienceEvent,
} from '@/lib/eza/analytics/ezaExperienceAdapter';
import {
  trackMirrorBirthSuggested,
  MIRROR_BIRTH_SUGGESTED_EVENT,
} from '@/lib/eza/mirror-birth/mirrorBirthAnalytics';
import {
  trackBranchCardClicked,
  BRANCH_CARD_CLICKED_EVENT,
} from '@/lib/eza/conversation-tree/conversationTreeAnalytics';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import { apiClient } from '@/lib/apiClient';

describe('ezaExperienceAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allowlist covers sprint event names', () => {
    expect(EXPERIENCE_EVENT_ALLOWLIST.has('mirror_birth_suggested')).toBe(true);
    expect(EXPERIENCE_EVENT_ALLOWLIST.has('branch_opened')).toBe(true);
    expect(EXPERIENCE_EVENT_ALLOWLIST.has('relationship_pattern_viewed')).toBe(true);
  });

  it('fire-and-forget posts to observation endpoint', async () => {
    await postExperienceEvent('mirror_created', {
      conversationId: 'chat-1',
      context: { surface: 'mirror' },
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/eza/experience-events',
      expect.objectContaining({
        body: expect.objectContaining({
          productId: 'saina',
          eventType: 'mirror_created',
          conversationId: 'chat-1',
        }),
      })
    );
  });

  it('adapter errors do not throw', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network'));
    expect(() => ezaExperience.track('landing_viewed', { mirrorId: 'slug-1' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it('mirror birth track preserves CustomEvent and posts observation event', () => {
    const handler = vi.fn();
    window.addEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, handler);

    trackMirrorBirthSuggested('chat-analytics');

    expect(handler).toHaveBeenCalledTimes(1);
    ezaExperience.track('mirror_birth_suggested', { conversationId: 'chat-analytics' });
    expect(apiClient.post).toHaveBeenCalled();

    window.removeEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, handler);
  });

  it('branch opened maps to observation event while keeping CustomEvent', () => {
    const handler = vi.fn();
    window.addEventListener(BRANCH_CARD_CLICKED_EVENT, handler);

    trackBranchCardClicked('chat-branch', 'Yeni keşif');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/eza/experience-events',
      expect.objectContaining({
        body: expect.objectContaining({
          eventType: 'branch_opened',
          conversationId: 'chat-branch',
        }),
      })
    );

    window.removeEventListener(BRANCH_CARD_CLICKED_EVENT, handler);
  });
});
