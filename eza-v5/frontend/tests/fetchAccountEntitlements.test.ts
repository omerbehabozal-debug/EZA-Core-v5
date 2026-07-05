import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchAccountEntitlements } from '@/lib/eza/plan/fetchAccountEntitlements';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';
import { MIRROR_GUEST_TOKEN_KEY } from '@/lib/eza/mirror-network/sohbetTypes';

const apiGet = vi.fn();

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGet(...args),
  },
}));

describe('fetchAccountEntitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('sends guest token header when not authenticated', async () => {
    localStorage.setItem(MIRROR_GUEST_TOKEN_KEY, 'guest-token-abcdefghijklmnop');
    apiGet.mockResolvedValue({
      ok: true,
      tier: 'guest',
      label: 'SAINA Guest',
      entitlements: {
        tier: 'guest',
        dailyMessageLimit: 10,
        maxMessageChars: 500,
        mirrorCooldownHours: null,
        dailyMirrorLimit: 1,
        dailyDiscoverStartLimit: 1,
        relationshipMapAccess: 'locked',
        imageQuality: 'medium',
        priorityGeneration: false,
      },
      usage: {
        dailyMessagesUsed: 2,
        dailyMessagesLimit: 10,
        dailyDiscoverStartsUsed: 0,
        dailyDiscoverStartsLimit: 1,
        nextVisualAvailableAt: null,
      },
    });

    const result = await fetchAccountEntitlements();

    expect(apiGet).toHaveBeenCalledWith('/api/account/entitlements', {
      auth: false,
      headers: { [GUEST_TOKEN_HEADER]: 'guest-token-abcdefghijklmnop' },
    });
    expect(result?.usage.dailyMessagesUsed).toBe(2);
  });

  it('uses auth without guest header when logged in', async () => {
    localStorage.setItem('eza_token', 'jwt-token');
    apiGet.mockResolvedValue({
      ok: true,
      tier: 'free',
      label: 'SAINA Free',
      entitlements: {
        tier: 'free',
        dailyMessageLimit: 20,
        maxMessageChars: 500,
        mirrorCooldownHours: null,
        dailyMirrorLimit: 0,
        dailyDiscoverStartLimit: 1,
        relationshipMapAccess: 'locked',
        imageQuality: 'medium',
        priorityGeneration: false,
      },
      usage: {
        dailyMessagesUsed: 0,
        dailyMessagesLimit: 20,
        dailyDiscoverStartsUsed: 0,
        dailyDiscoverStartsLimit: 1,
        nextVisualAvailableAt: null,
      },
    });

    await fetchAccountEntitlements();

    expect(apiGet).toHaveBeenCalledWith('/api/account/entitlements', {
      auth: true,
      headers: {},
    });
  });
});
