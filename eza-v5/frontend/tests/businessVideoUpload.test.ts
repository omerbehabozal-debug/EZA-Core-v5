import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMemoryAuthToken } from '@/lib/eza/authTokenStore';
import { fetchBrandVideoPreview, uploadBrandVideo } from '@/lib/eza/businessYansi';

class FakeRequest {
  static last: FakeRequest | null = null;
  upload = { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  status = 201;
  responseText = JSON.stringify({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    locator_kind: 'storage',
    locator: null,
  });
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: FormData | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: FormData) {
    this.body = body;
    FakeRequest.last = this;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 40 });
    this.onload?.();
  }
}

beforeEach(() => {
  setMemoryAuthToken('studio-token');
  FakeRequest.last = null;
  vi.stubGlobal('XMLHttpRequest', FakeRequest);
});

describe('stored video upload and preview', () => {
  it('uploads the original with progress and does not send a storage key', async () => {
    const seen: number[] = [];
    const file = new File([new Uint8Array(40)], 'atolye.mp4', { type: 'video/mp4' });
    const saved = await uploadBrandVideo('biz-1', file, { title: 'Atolye', caption: '', publicAllowed: true }, (ratio) => {
      seen.push(ratio);
    });
    expect(saved.locator).toBeNull();
    expect(seen).toEqual([0.25]);
    const sent = FakeRequest.last;
    expect(sent?.method).toBe('POST');
    expect(sent?.url).toContain('/biz-1/assets/video');
    expect(sent?.url).not.toContain('brand-videos');
    expect(sent?.headers.Authorization).toBe('Bearer studio-token');
    expect(sent?.body?.get('purpose')).toBe('step');
    expect(sent?.body?.get('file')).toBeInstanceOf(File);
  });

  it('mints a ticketed stream URL instead of downloading a full video blob', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          streamPath: '/api/business-yansi/biz-1/assets/asset-1/video?ticket=abc',
          expiresAt: Math.floor(Date.now() / 1000) + 600,
          expiresIn: 600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const url = await fetchBrandVideoPreview('biz-1', 'asset-1');
    expect(url).toContain('/api/business-yansi/biz-1/assets/asset-1/video?ticket=abc');
    expect(url).not.toContain('brand-videos');
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toContain('/biz-1/assets/asset-1/video-stream');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer studio-token');
  });
});
