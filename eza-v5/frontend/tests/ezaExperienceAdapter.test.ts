import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ezaExperience,
  EXPERIENCE_EVENT_ALLOWLIST,
  isExperienceEventLoggingEnabled,
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
  const prevFlag = process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED = 'true';
  });

  afterEach(() => {
    if (prevFlag === undefined) {
      delete process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED = prevFlag;
    }
    vi.restoreAllMocks();
  });

  it('logging flag defaults off unless explicitly enabled', () => {
    delete process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED;
    expect(isExperienceEventLoggingEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED = 'true';
    expect(isExperienceEventLoggingEnabled()).toBe(true);
  });

  it('allowlist covers sprint event names', () => {
    expect(EXPERIENCE_EVENT_ALLOWLIST.has('mirror_birth_suggested')).toBe(true);
    expect(EXPERIENCE_EVENT_ALLOWLIST.has('branch_opened')).toBe(true);
    expect(EXPERIENCE_EVENT_ALLOWLIST.has('relationship_pattern_viewed')).toBe(true);
  });

  it('does not POST when logging flag is disabled', async () => {
    process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED = 'false';
    await postExperienceEvent('mirror_created', { conversationId: 'chat-1' });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('fire-and-forget posts to observation endpoint when enabled', async () => {
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

  it('mirror birth track preserves CustomEvent and posts observation event when enabled', () => {
    const handler = vi.fn();
    window.addEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, handler);

    trackMirrorBirthSuggested('chat-analytics');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalled();

    window.removeEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, handler);
  });

  it('mirror birth track preserves CustomEvent without POST when flag disabled', () => {
    process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED = 'false';
    const handler = vi.fn();
    window.addEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, handler);

    trackMirrorBirthSuggested('chat-analytics');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(apiClient.post).not.toHaveBeenCalled();

    window.removeEventListener(MIRROR_BIRTH_SUGGESTED_EVENT, handler);
  });

  it('branch opened maps to observation event while keeping CustomEvent when enabled', () => {
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
