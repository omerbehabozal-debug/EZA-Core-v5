import { afterEach, describe, expect, it } from 'vitest';
import { getAuthToken, setMemoryAuthToken } from '@/lib/eza/authTokenStore';
import { publicIdentitySaveErrorMessage } from '@/lib/eza/plan/fetchAuthMe';

describe('auth token store', () => {
  afterEach(() => {
    setMemoryAuthToken(null);
    localStorage.clear();
  });

  it('prefers the in-memory session token over a wiped localStorage key', () => {
    setMemoryAuthToken('live-session');
    localStorage.removeItem('eza_token');
    expect(getAuthToken()).toBe('live-session');
  });
});

describe('publicIdentitySaveErrorMessage', () => {
  it('asks the owner to sign in again on auth_required', () => {
    expect(publicIdentitySaveErrorMessage('auth_required')).toContain('Tekrar giriş');
  });
});
