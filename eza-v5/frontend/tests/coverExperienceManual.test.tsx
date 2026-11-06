import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoverExperience } from '@/components/saina/business-studio/CoverExperience';
import type { BrandAsset } from '@/lib/eza/businessYansi';

const mocks = vi.hoisted(() => ({
  fetchCoverJob: vi.fn(),
  fetchCoverJobById: vi.fn(),
  requestCoverSegment: vi.fn(),
  retryCoverJob: vi.fn(),
  retryCoverJobById: vi.fn(),
  uploadBrandImage: vi.fn(),
  uploadBrandVideo: vi.fn(),
  businessRequest: vi.fn(),
  fetchBrandVideoPreview: vi.fn(async () => 'blob:stored-video'),
}));

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>('@/lib/eza/businessYansi');
  return { ...actual, ...mocks };
});

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
  links: [],
};

beforeEach(() => {
  mocks.fetchCoverJob.mockReset();
  mocks.fetchCoverJobById.mockReset();
  mocks.requestCoverSegment.mockReset();
  mocks.retryCoverJob.mockReset();
  mocks.retryCoverJobById.mockReset();
  mocks.uploadBrandImage.mockReset();
  mocks.uploadBrandVideo.mockReset();
  mocks.businessRequest.mockReset();
  mocks.fetchCoverJob.mockRejectedValue(new Error('cover_job_not_found'));
  mocks.fetchCoverJobById.mockRejectedValue(new Error('cover_job_not_found'));
});

function coverJob(status: string, resultAssetId: string | null = null, jobId = 'job-1') {
  return { jobId, status, resultAssetId, errorCode: status === 'failed' ? 'cover_encode_failed' : null, startSeconds: 0, endSeconds: 8 };
}

describe('manual cover confirmation', () => {
  it('does not create a cover job until the interval is confirmed', async () => {
    const onConfirm = vi.fn();
    render(
      <CoverExperience
        businessId="biz-1"
        assets={[film]}
        kind="video"
        confirmedId=""
        onKind={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(mocks.fetchCoverJob).not.toHaveBeenCalled();
    expect(mocks.fetchCoverJobById).not.toHaveBeenCalled();
    expect(mocks.requestCoverSegment).not.toHaveBeenCalled();
    expect(screen.getByText('Kesit henüz onaylanmadı.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kapak başlangıcı'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Kapak bitişi'), { target: { value: '10' } });
    mocks.requestCoverSegment.mockResolvedValue(coverJob('awaiting_encode', null, 'job-window'));
    mocks.fetchCoverJobById.mockResolvedValue(coverJob('awaiting_encode', null, 'job-window'));
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    await waitFor(() => expect(mocks.requestCoverSegment).toHaveBeenCalledWith('biz-1', film.id, 2, 10));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazırlanıyor');
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
  });

  it('does not approve a failed derivative', async () => {
    mocks.requestCoverSegment.mockResolvedValue({
      jobId: 'job-failed',
      status: 'failed',
      resultAssetId: null,
      errorCode: 'cover_derivative_too_large',
      startSeconds: 0,
      endSeconds: 8,
    });
    const onConfirm = vi.fn();
    render(
      <CoverExperience
        businessId="biz-1"
        assets={[film]}
        kind="video"
        confirmedId=""
        onKind={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    await waitFor(() => expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazırlanamadı'));
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
    expect(mocks.fetchCoverJob).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('previews the cropped output and reuses the upload when linking fails', async () => {
    const onConfirm = vi.fn();
    const seen: Blob[] = [];
    let preview = 0;
    URL.createObjectURL = (blob: Blob) => {
      seen.push(blob);
      preview += 1;
      return `blob:crop-${preview}`;
    };
    URL.revokeObjectURL = () => undefined;
    const bitmap = { width: 800, height: 600, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback?.(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
    });
    mocks.uploadBrandImage.mockResolvedValue({ ...film, id: 'img-crop', asset_type: 'image', title: 'Yansı kapağı', revision: 1 });
    mocks.businessRequest.mockRejectedValueOnce(new Error('link_failed')).mockResolvedValueOnce({});
    render(
      <CoverExperience
        businessId="biz-1"
        assets={[]}
        kind="image"
        confirmedId=""
        linkVersionIds={['kb-1']}
        onKind={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const file = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Kapak görseli'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('biz-cover-crop-preview')).toHaveAttribute('src', 'blob:crop-1'));
    expect(seen[0]?.type).toBe('image/jpeg');
    expect(mocks.uploadBrandImage).not.toHaveBeenCalled();
    const next = new File([new Uint8Array([9])], 'other.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Kapak görseli'), { target: { files: [next] } });
    await waitFor(() => expect(screen.getByTestId('biz-cover-crop-preview')).toHaveAttribute('src', 'blob:crop-2'));
    fireEvent.change(screen.getByLabelText('Kapak görseli'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Kapak yakınlaştırma'), { target: { value: '2' } });
    await waitFor(() => expect(screen.getByTestId('biz-cover-crop-preview')).toHaveAttribute('src', 'blob:crop-3'));
    fireEvent.click(screen.getByRole('button', { name: 'Bu kapağı kullan' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Kaynak bağlantısı'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Bu kapağı kullan' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('image', 'img-crop'));
    expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(1);
    expect(mocks.businessRequest).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenCalled();
  });

  it('uploads a manual video without creating a cover job', async () => {
    mocks.uploadBrandVideo.mockResolvedValue(film);
    render(
      <CoverExperience
        businessId="biz-1"
        assets={[]}
        kind="video"
        confirmedId=""
        onKind={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const file = new File([new Uint8Array([1])], 'atolye.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Video dosyası'), { target: { files: [file] } });
    await waitFor(() => expect(mocks.uploadBrandVideo).toHaveBeenCalled());
    expect(mocks.uploadBrandVideo.mock.calls[0][2]).toMatchObject({ coverPreparation: 'manual' });
    expect(mocks.requestCoverSegment).not.toHaveBeenCalled();
    expect(mocks.businessRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Kesit henüz onaylanmadı.')).toBeInTheDocument();
  });

  it('links a manual video before it can be selected and retries the link without uploading again', async () => {
    const onConfirm = vi.fn();
    mocks.uploadBrandVideo.mockResolvedValue(film);
    mocks.businessRequest.mockRejectedValueOnce(new Error('link_failed')).mockResolvedValueOnce({ ...film, revision: 2 });
    render(
      <CoverExperience
        businessId="biz-1"
        assets={[]}
        kind="video"
        confirmedId=""
        linkVersionIds={['kb-1']}
        onKind={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const file = new File([new Uint8Array([1])], 'atolye.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Video dosyası'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Kaynak bağlantısı'));
    expect(mocks.uploadBrandVideo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: film.title })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kesiti onayla' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Video dosyası'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: film.title })).toBeInTheDocument());
    expect(mocks.uploadBrandVideo).toHaveBeenCalledTimes(1);
    expect(mocks.businessRequest).toHaveBeenCalledTimes(2);
    expect(mocks.businessRequest.mock.calls[1][0]).toBe(`/biz-1/assets/${film.id}/links`);
    expect(screen.getByRole('button', { name: 'Kesiti onayla' })).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores a stale crop and uploads only the preview that is still on screen', async () => {
    const onConfirm = vi.fn();
    const gates: Array<(bitmap: { width: number; height: number; close: () => void }) => void> = [];
    const bitmap = { width: 800, height: 600, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise((resolve) => {
      gates.push(resolve);
    })));
    URL.createObjectURL = () => `blob:crop-${gates.length}`;
    URL.revokeObjectURL = () => undefined;
    const blobs: Blob[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      const blob = new Blob([new Uint8Array([blobs.length + 1])], { type: 'image/jpeg' });
      blobs.push(blob);
      callback?.(blob);
    });
    mocks.uploadBrandImage.mockResolvedValue({ ...film, id: 'img-crop', asset_type: 'image', title: 'Yansı kapağı', revision: 1 });
    mocks.businessRequest.mockResolvedValue({});
    render(
      <CoverExperience
        businessId="biz-1"
        assets={[]}
        kind="image"
        confirmedId=""
        linkVersionIds={['kb-1']}
        onKind={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const first = new File([new Uint8Array([1])], 'one.png', { type: 'image/png' });
    const second = new File([new Uint8Array([2])], 'two.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Kapak görseli'), { target: { files: [first] } });
    fireEvent.change(screen.getByLabelText('Kapak yakınlaştırma'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Kapak görseli'), { target: { files: [second] } });
    expect(screen.getByRole('button', { name: 'Bu kapağı kullan' })).toBeDisabled();
    expect(screen.queryByTestId('biz-cover-crop-preview')).not.toBeInTheDocument();
    await act(async () => {
      gates.slice(0, -1).forEach((resolve) => resolve(bitmap));
    });
    expect(screen.getByRole('button', { name: 'Bu kapağı kullan' })).toBeDisabled();
    expect(screen.queryByTestId('biz-cover-crop-preview')).not.toBeInTheDocument();
    await act(async () => {
      gates[gates.length - 1]?.(bitmap);
    });
    await waitFor(() => expect(screen.getByTestId('biz-cover-crop-preview')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Bu kapağı kullan' })).toBeEnabled();
    const rendersBeforeUpload = blobs.length;
    fireEvent.click(screen.getByRole('button', { name: 'Bu kapağı kullan' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('image', 'img-crop'));
    expect(blobs).toHaveLength(rendersBeforeUpload);
    const uploaded = mocks.uploadBrandImage.mock.calls[0][1] as File;
    expect(uploaded.size).toBe(blobs[blobs.length - 1].size);
    expect(mocks.uploadBrandImage).toHaveBeenCalledTimes(1);
  });
});

describe('cover job polling', () => {
  const other: BrandAsset = { ...film, id: '33333333-3333-4333-8333-333333333333', title: 'Ikinci film' };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls the confirmed job until it is ready and does not adopt the latest job', async () => {
    const onConfirm = vi.fn();
    mocks.fetchCoverJob.mockResolvedValue(coverJob('ready', 'deriv-a', 'job-a'));
    mocks.requestCoverSegment.mockResolvedValue(coverJob('awaiting_encode', null, 'job-b'));
    mocks.fetchCoverJobById
      .mockResolvedValueOnce(coverJob('awaiting_encode', null, 'job-b'))
      .mockResolvedValue(coverJob('ready', 'deriv-b', 'job-b'));
    render(
      <CoverExperience businessId="biz-1" assets={[film]} kind="video" confirmedId="" onKind={vi.fn()} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazırlanıyor');
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
    expect(mocks.fetchCoverJobById).toHaveBeenCalledWith('biz-1', film.id, 'job-b');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Bu kapağı kullan' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bu kapağı kullan' }));
    expect(onConfirm).toHaveBeenCalledWith('video', 'deriv-b');
    const calls = mocks.fetchCoverJobById.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(mocks.fetchCoverJobById).toHaveBeenCalledTimes(calls);
    expect(mocks.fetchCoverJob).not.toHaveBeenCalled();
  });

  it('drops a selectable result when the interval changes and ignores a late job', async () => {
    const onConfirm = vi.fn();
    let releaseFirst: (job: ReturnType<typeof coverJob>) => void = () => undefined;
    let releasePoll: (job: ReturnType<typeof coverJob>) => void = () => undefined;
    mocks.requestCoverSegment
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValueOnce(coverJob('awaiting_encode', null, 'job-b'));
    mocks.fetchCoverJobById.mockImplementation((_business: string, _asset: string, jobId: string) => {
      if (jobId === 'job-b') return new Promise((resolve) => { releasePoll = resolve; });
      return Promise.resolve(coverJob('ready', 'deriv-a', 'job-a'));
    });
    mocks.fetchCoverJob.mockResolvedValue(coverJob('ready', 'deriv-a', 'job-a'));
    render(
      <CoverExperience businessId="biz-1" assets={[film]} kind="video" confirmedId="" onKind={vi.fn()} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    fireEvent.change(screen.getByLabelText('Kapak bitişi'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazırlanıyor');
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
    await act(async () => {
      releaseFirst(coverJob('ready', 'deriv-a', 'job-a'));
    });
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
    await act(async () => {
      releasePoll(coverJob('ready', 'deriv-b', 'job-b'));
    });
    expect(screen.getByRole('button', { name: 'Bu kapağı kullan' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bu kapağı kullan' }));
    expect(onConfirm).toHaveBeenCalledWith('video', 'deriv-b');
    expect(mocks.fetchCoverJob).not.toHaveBeenCalled();
  });

  it('hides the previous ready result as soon as a new interval is requested', async () => {
    mocks.requestCoverSegment
      .mockResolvedValueOnce(coverJob('ready', film.id, 'job-a'))
      .mockImplementationOnce(() => new Promise(() => undefined));
    const onConfirm = vi.fn();
    render(
      <CoverExperience businessId="biz-1" assets={[film]} kind="video" confirmedId="" onKind={vi.fn()} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('button', { name: 'Bu kapağı kullan' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kapak bitişi'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores a ready response after the source changes', async () => {
    let release: (job: ReturnType<typeof coverJob>) => void = () => undefined;
    mocks.requestCoverSegment.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    render(
      <CoverExperience businessId="biz-1" assets={[film, other]} kind="video" confirmedId="" onKind={vi.fn()} onConfirm={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ikinci film' }));
    await act(async () => {
      release(coverJob('ready', 'stale-ready', 'job-a'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
    expect(screen.getByText('Kesit henüz onaylanmadı.')).toBeInTheDocument();
    expect(mocks.fetchCoverJob).not.toHaveBeenCalled();
  });

  it('retries the failed job that was confirmed', async () => {
    mocks.fetchCoverJob.mockResolvedValue(coverJob('ready', 'deriv-a', 'job-a'));
    mocks.requestCoverSegment.mockResolvedValue(coverJob('failed', null, 'job-b'));
    mocks.retryCoverJobById.mockResolvedValue(coverJob('awaiting_encode', null, 'job-b'));
    mocks.fetchCoverJobById.mockResolvedValue(coverJob('awaiting_encode', null, 'job-b'));
    render(
      <CoverExperience businessId="biz-1" assets={[film]} kind="video" confirmedId="" onKind={vi.fn()} onConfirm={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kesiti onayla' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.retryCoverJobById).toHaveBeenCalledWith('biz-1', film.id, 'job-b');
    expect(mocks.retryCoverJob).not.toHaveBeenCalled();
    expect(screen.getByTestId(`biz-cover-status-${film.id}`)).toHaveTextContent('Kapak hazırlanıyor');
    expect(screen.queryByRole('button', { name: 'Bu kapağı kullan' })).not.toBeInTheDocument();
    expect(mocks.fetchCoverJob).not.toHaveBeenCalled();
  });
});
