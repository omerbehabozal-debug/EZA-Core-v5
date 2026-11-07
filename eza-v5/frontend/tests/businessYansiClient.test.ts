import { describe, expect, it } from 'vitest';
import { BusinessApiError, revisionCoverPayload } from '@/lib/eza/businessYansi';

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

  it('maps recognized video 5xx codes to clear Turkish copy', () => {
    const quota = new BusinessApiError(503, { code: 'video_quota_unavailable' });
    expect(quota.kind).toBe('server');
    expect(quota.code).toBe('video_quota_unavailable');
    expect(quota.message).toBe(
      'Video yükleme kontrolü şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin.',
    );

    expect(new BusinessApiError(503, { code: 'video_storage_unconfigured' }).message).toBe(
      'Video depolama servisi şu anda kullanılamıyor.',
    );
    expect(new BusinessApiError(503, { code: 'video_probe_unavailable' }).message).toBe(
      'Video işleme servisi şu anda kullanılamıyor.',
    );
    expect(new BusinessApiError(502, { code: 'video_storage_failed' }).message).toBe(
      'Video kaydedilemedi. Lütfen biraz sonra tekrar deneyin.',
    );
    expect(new BusinessApiError(503, null).message).toBe(
      'Business servisinde geçici bir sorun oluştu. Biraz sonra tekrar dene.',
    );
  });

  it('omits an untouched cover and sends null only for an explicit automatic choice', () => {
    expect(revisionCoverPayload('asset-1', false)).toEqual({});
    expect(revisionCoverPayload('', false)).toEqual({});
    expect(revisionCoverPayload('', true)).toEqual({ coverAssetId: null });
    expect(revisionCoverPayload('asset-1', true)).toEqual({ coverAssetId: 'asset-1' });
  });
});
