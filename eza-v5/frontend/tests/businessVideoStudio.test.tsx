import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessAssetLibrary from '@/components/saina/business-studio/BusinessAssetLibrary';
import BusinessYansiStudio from '@/components/saina/business-studio/BusinessYansiStudio';
import type { BrandAsset, CoverJob, Draft, Knowledge } from '@/lib/eza/businessYansi';

const mocks = vi.hoisted(() => ({
  businessRequest: vi.fn(),
  uploadBrandVideo: vi.fn(),
  fetchCoverJob: vi.fn(),
  retryCoverJob: vi.fn(),
  requestCoverSegment: vi.fn(),
  fetchBrandVideoPreview: vi.fn(async () => 'blob:stored-video'),
  fetchBrandAssetPreview: vi.fn(async () => 'blob:image'),
}));

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>('@/lib/eza/businessYansi');
  return { ...actual, ...mocks };
});

const knowledge: Knowledge = {
  id: 'kb-1',
  item_id: 'item-1',
  title: 'Menü hikâyesi',
  category: 'ürün',
  content: 'Zeytinyağlı yaprak dolması…',
  source: 'Marka kitabı',
  public_allowed: true,
  status: 'published',
  version: 2,
  revision: 1,
};

const link = {
  id: 'link-1',
  item_id: 'item-1',
  confirmed_version_id: 'kb-1',
  status: 'active',
  knowledge_title: 'Menü hikâyesi',
  knowledge_status: 'published',
  current_published_version_id: 'kb-1',
  confirmation_current: true,
};

const film: BrandAsset = {
  id: '22222222-2222-4222-8222-222222222222',
  business_id: 'biz-1',
  asset_type: 'video',
  title: 'Atolye filmi',
  caption: '',
  locator_kind: 'storage',
  locator: null,
  latitude: null,
  longitude: null,
  public_allowed: true,
  status: 'active',
  revision: 1,
  links: [link],
};

const image: BrandAsset = {
  ...film,
  id: '11111111-1111-4111-8111-111111111111',
  asset_type: 'image',
  title: 'Atolye gorseli',
  locator_kind: 'storage',
};

function job(status: string, resultAssetId: string | null = null): CoverJob {
  return { status, resultAssetId, errorCode: status === 'failed' ? 'cover_derivative_too_large' : null, startSeconds: 0, endSeconds: 20 };
}

const steps = Array.from({ length: 8 }, (_, index) => ({
  question: `Soru ${index + 1}?`,
  answer: 'Zeytinyağlı yaprak dolması…',
  sources: ['kb-1'],
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.businessRequest.mockReset();
  mocks.uploadBrandVideo.mockReset();
  mocks.fetchCoverJob.mockReset();
  mocks.retryCoverJob.mockReset();
  mocks.requestCoverSegment.mockReset();
  mocks.fetchBrandVideoPreview.mockClear();
  mocks.fetchCoverJob.mockResolvedValue(job('ready', film.id));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('business studio video experience', () => {
  it('shows upload progress and does not ask for a storage key', async () => {
    let release: (asset: BrandAsset) => void = () => undefined;
    mocks.uploadBrandVideo.mockImplementation(async (_business, _file, _fields, onProgress) => {
      onProgress?.(0.4);
      return new Promise<BrandAsset>((resolve) => {
        release = resolve;
      });
    });
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[]}
        knowledge={[]}
        canEdit
        busy={false}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Yeni içerik' }));
    fireEvent.change(screen.getByLabelText('İçerik türü'), { target: { value: 'video' } });
    fireEvent.change(screen.getByLabelText('İçerik başlığı'), { target: { value: 'Atolye filmi' } });
    const file = new File([new Uint8Array(8)], 'atolye.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Video dosyası'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(screen.getByTestId('biz-video-progress')).toHaveTextContent('Yükleniyor… 40%');
    expect(screen.queryByLabelText('Video adresi')).not.toBeInTheDocument();
    expect(mocks.businessRequest).not.toHaveBeenCalled();
    await act(async () => {
      release({ ...film });
    });
  });

  it('moves from preparing to a ready cover without a confirmation button', async () => {
    mocks.fetchCoverJob
      .mockResolvedValueOnce(job('awaiting_encode'))
      .mockResolvedValueOnce(job('ready', '33333333-3333-4333-8333-333333333333'));
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[film]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazırlanıyor');
    expect(screen.queryByRole('button', { name: /hazırlanan kapağı kullan/i })).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazır');
    expect(screen.getByLabelText('Hazır kapak')).toBeInTheDocument();
    expect(screen.getByLabelText('Yüklenen video')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('brand-videos');
    expect(mocks.businessRequest).not.toHaveBeenCalled();
  });

  it('retries a failed cover and sends a segment without saving a draft', async () => {
    mocks.fetchCoverJob.mockResolvedValue(job('failed'));
    mocks.retryCoverJob.mockResolvedValue(job('queued'));
    mocks.requestCoverSegment.mockResolvedValue(job('awaiting_encode'));
    const onChanged = vi.fn();
    render(
      <BusinessAssetLibrary
        businessId="biz-1"
        assets={[film]}
        knowledge={[knowledge]}
        canEdit
        busy={false}
        onChanged={onChanged}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazırlanamadı');
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.retryCoverJob).toHaveBeenCalledWith('biz-1', film.id);
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti değiştirmek isterseniz' }));
    fireEvent.change(screen.getByLabelText('Kapak başlangıcı'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Kapak bitişi'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti güncelle' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.requestCoverSegment).toHaveBeenCalledWith('biz-1', film.id, 5, 15);
    expect(onChanged).not.toHaveBeenCalled();
    expect(mocks.businessRequest).not.toHaveBeenCalled();
  });

  it('keeps an explicit cover and still saves an automatic draft as null', async () => {
    const editDraft: Draft = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      title: 'Atolye',
      summary: 'Atolye ozeti',
      steps,
      status: 'draft',
      revision: 1,
      conversation_id: null,
      media_plan: { coverAssetId: film.id, blocks: [], seal: null, coverMode: 'automatic' },
    };
    mocks.businessRequest.mockResolvedValue({});
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={[knowledge]}
        canEdit
        editDraft={editDraft}
        assets={[image, film]}
        onDraftSaved={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const choice = screen.getByTestId('biz-studio-cover-choice');
    expect(choice).toHaveValue('');
    expect(screen.getByTestId('biz-studio-selected-cover')).toHaveTextContent('otomatik öneri');
    expect(screen.queryByRole('button', { name: /hazırlanan kapağı kullan/i })).not.toBeInTheDocument();
    fireEvent.change(choice, { target: { value: image.id } });
    expect(screen.getByTestId('biz-studio-explicit-cover')).toHaveTextContent('Seçtiğiniz kapak duruyor.');
    mocks.fetchCoverJob.mockResolvedValue(job('ready', '33333333-3333-4333-8333-333333333333'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId('biz-studio-cover-choice')).toHaveValue(image.id);
    fireEvent.change(choice, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('biz-studio-save-draft'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.businessRequest).toHaveBeenCalled();
    const body = mocks.businessRequest.mock.calls.at(-1)?.[2] as { coverAssetId: string | null };
    expect(body.coverAssetId).toBeNull();
  });

  it('leaves coverAssetId out of a revision that does not touch an explicit cover', async () => {
    const editDraft: Draft = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      title: 'Atolye',
      summary: 'Atolye ozeti',
      steps,
      status: 'draft',
      revision: 1,
      conversation_id: null,
      media_plan: { coverAssetId: image.id, blocks: [], seal: null, coverMode: 'explicit' },
    };
    mocks.businessRequest.mockResolvedValue({});
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={[knowledge]}
        canEdit
        editDraft={editDraft}
        assets={[image, film]}
        onDraftSaved={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('biz-studio-cover-choice')).toHaveValue(image.id);
    fireEvent.click(screen.getByTestId('biz-studio-save-draft'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const body = mocks.businessRequest.mock.calls.at(-1)?.[2] as { coverAssetId?: string | null };
    expect(body).not.toHaveProperty('coverAssetId');
  });
});
