import { describe, expect, it } from 'vitest';
import {
  isQuotaLimitReason,
  resolveChatLimitMessage,
  resolveDiscoverLimitMessage,
} from '@/lib/eza/plan/sainaQuotaMessages';
import {
  SAINA_CHAT_LIMIT_REACHED,
  SAINA_DISCOVER_LIMIT_REACHED,
  SAINA_GUEST_CHAT_LIMIT_REACHED,
  SAINA_GUEST_DISCOVER_LIMIT_REACHED,
} from '@/lib/eza/sainaCopy';

describe('sainaQuotaMessages', () => {
  it('detects message quota reasons', () => {
    expect(isQuotaLimitReason('daily_message_limit_reached')).toBe(true);
    expect(isQuotaLimitReason('guest_message_limit_reached')).toBe(true);
    expect(isQuotaLimitReason('daily_discover_limit_reached')).toBe(true);
    expect(isQuotaLimitReason('guest_discover_limit_reached')).toBe(true);
    expect(isQuotaLimitReason('mirror_cooldown')).toBe(false);
  });

  it('resolves tier-specific limit copy', () => {
    expect(resolveChatLimitMessage('guest')).toBe(SAINA_GUEST_CHAT_LIMIT_REACHED);
    expect(resolveChatLimitMessage('free')).toBe(SAINA_CHAT_LIMIT_REACHED);
    expect(resolveDiscoverLimitMessage('guest')).toBe(SAINA_GUEST_DISCOVER_LIMIT_REACHED);
    expect(resolveDiscoverLimitMessage('free')).toBe(SAINA_DISCOVER_LIMIT_REACHED);
  });
});
