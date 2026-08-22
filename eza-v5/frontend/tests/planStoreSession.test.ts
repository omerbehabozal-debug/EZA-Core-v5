import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateAuthSession = vi.fn();

vi.mock('@/lib/eza/plan/fetchAuthMe', () => ({
  validateAuthSession: (...args: unknown[]) => validateAuthSession(...args),
  fetchAuthMe: vi.fn(),
}));

describe('hydratePlanFromServer session handling', () => {
  beforeEach(() => {
    localStorage.clear();
    validateAuthSession.mockReset();
    vi.resetModules();
  });

  it('does not wipe the token when /me is unavailable', async () => {
    localStorage.setItem('eza_token', 'keep-me');
    localStorage.setItem('eza_user', JSON.stringify({ user_id: 'u1' }));
    validateAuthSession.mockResolvedValue({ status: 'unavailable' });
    const { hydratePlanFromServer, getPlanSourceSnapshot } = await import(
      '@/lib/eza/plan/planStore'
    );
    await hydratePlanFromServer();
    expect(localStorage.getItem('eza_token')).toBe('keep-me');
    expect(getPlanSourceSnapshot()).not.toBe('session_invalid');
  });

  it('clears the token only when /me says the session is invalid', async () => {
    localStorage.setItem('eza_token', 'drop-me');
    validateAuthSession.mockResolvedValue({ status: 'invalid' });
    const { hydratePlanFromServer, getPlanSourceSnapshot } = await import(
      '@/lib/eza/plan/planStore'
    );
    await hydratePlanFromServer();
    expect(localStorage.getItem('eza_token')).toBeNull();
    expect(getPlanSourceSnapshot()).toBe('session_invalid');
  });
});
