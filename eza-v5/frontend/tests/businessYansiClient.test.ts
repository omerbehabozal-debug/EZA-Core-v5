import { describe, expect, it } from 'vitest';
import { BusinessApiError } from '@/lib/eza/businessYansi';

describe('BusinessApiError classification', () => {
  it('maps feature-flag detail not_found to unavailable copy', () => {
    const err = new BusinessApiError(404, 'not_found');
    expect(err.kind).toBe('unavailable');
    expect(err.message).toBe('BiligN Business şu anda kullanıma hazırlanıyor.');
  });

  it('maps empty 404 bodies to unavailable', () => {
    const err = new BusinessApiError(404, null);
    expect(err.kind).toBe('unavailable');
  });

  it('keeps resource 404 codes distinct from service unavailable', () => {
    const err = new BusinessApiError(404, { code: 'business_not_found' });
    expect(err.kind).toBe('not_found');
    expect(err.code).toBe('business_not_found');
  });

  it('classifies 401 / 403 / 5xx / network separately', () => {
    expect(new BusinessApiError(401, null).kind).toBe('unauthorized');
    expect(new BusinessApiError(403, 'business_access_denied').kind).toBe('forbidden');
    expect(new BusinessApiError(500, null).kind).toBe('server');
    expect(new BusinessApiError(0, 'network_error').kind).toBe('network');
  });
});
