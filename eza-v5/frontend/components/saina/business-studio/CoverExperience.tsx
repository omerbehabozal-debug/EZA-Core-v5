'use client';

import { useEffect, useRef, useState } from 'react';
import type { BrandAsset, CoverJob } from '@/lib/eza/businessYansi';
import {
  businessRequest,
  fetchCoverJobById,
  requestCoverSegment,
  retryCoverJobById,
  uploadBrandImage,
  uploadBrandVideo,
} from '@/lib/eza/businessYansi';
import { coverInterval, coverOutputKey, renderSquareCover } from '@/lib/eza/business/coverExperience';
import { AuthorizedVideo, coverStatusCopy } from './CoverPreparation';

type Kind = 'video' | 'image';
type TrackedJob = { assetId: string; job: CoverJob };
type StoredCrop = { key: string; asset: BrandAsset };
type StoredVideo = { key: string; asset: BrandAsset };
type CropPreview = { key: string; url: string; blob: Blob };

type Props = {
  businessId: string;
  assets: BrandAsset[];
  kind: Kind | null;
  confirmedId: string;
  linkVersionIds?: string[];
  busy?: boolean;
  onKind: (kind: Kind) => void;
  onConfirm: (kind: Kind, assetId: string) => void;
};

const PREPARING = new Set(['queued', 'running', 'awaiting_encode']);

export function CoverExperience({ businessId, assets, kind, confirmedId, linkVersionIds = [], busy, onKind, onConfirm }: Props) {
  const videos = assets.filter((asset) => asset.asset_type === 'video');
  const images = assets.filter((asset) => asset.asset_type === 'image');
  const [localVideos, setLocalVideos] = useState<BrandAsset[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(20);
  const [duration, setDuration] = useState(0);
  const [tracked, setTracked] = useState<TrackedJob | null>(null);
  const [confirmedJobId, setConfirmedJobId] = useState<string | null>(null);
  const [watch, setWatch] = useState(0);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [linkedVideoIds, setLinkedVideoIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<CropPreview | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pickedImageId, setPickedImageId] = useState('');
  const [zoom, setZoom] = useState(1);
  const sourceRef = useRef('');
  const trackedRef = useRef<TrackedJob | null>(null);
  const requestSerial = useRef(0);
  const cropGeneration = useRef(0);
  const previewRef = useRef<CropPreview | null>(null);
  const uploadedRef = useRef<StoredCrop | null>(null);
  const videoUploadRef = useRef<StoredVideo | null>(null);
  const shownVideos = [...localVideos, ...videos.filter((asset) => !localVideos.some((item) => item.id === asset.id))];
  const source = shownVideos.find((asset) => asset.id === sourceId) || shownVideos[0] || null;
  sourceRef.current = source?.id || '';
  const confirmed = [...assets, ...localVideos].find((asset) => asset.id === confirmedId) || null;
  const currentJob = tracked && source && tracked.assetId === source.id && tracked.job.jobId === confirmedJobId ? tracked.job : null;
  const sourceLinked = Boolean(
    source && (videos.some((item) => item.id === source.id) || linkedVideoIds.includes(source.id) || linkVersionIds.length === 0),
  );
  const cropKey = cropFile ? coverOutputKey(cropFile, zoom) : '';
  const previewReady = Boolean(preview && preview.key === cropKey);

  function remember(next: TrackedJob | null) {
    trackedRef.current = next;
    setTracked(next);
  }

  function replacePreview(next: CropPreview | null) {
    if (previewRef.current && previewRef.current.url !== next?.url) URL.revokeObjectURL(previewRef.current.url);
    previewRef.current = next;
    setPreview(next);
  }

  useEffect(() => {
    requestSerial.current += 1;
    setConfirmedJobId(null);
    remember(null);
    setDuration(0);
    setStart(0);
    setEnd(20);
  }, [source?.id]);

  useEffect(() => {
    const assetId = source?.id;
    const jobId = confirmedJobId;
    const trackedJob = trackedRef.current;
    if (kind !== 'video' || !assetId || !jobId || source?.locator_kind !== 'storage') return;
    if (!trackedJob || trackedJob.assetId !== assetId || trackedJob.job.jobId !== jobId || !PREPARING.has(trackedJob.job.status)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      fetchCoverJobById(businessId, assetId, jobId)
        .then((next) => {
          if (!active || sourceRef.current !== assetId || next.jobId !== jobId) return;
          remember({ assetId, job: next });
          if (PREPARING.has(next.status)) timer = setTimeout(look, 2000);
        })
        .catch(() => {
          if (!active || sourceRef.current !== assetId) return;
          const current = trackedRef.current;
          if (current?.assetId === assetId && current.job.jobId === jobId && PREPARING.has(current.job.status)) {
            timer = setTimeout(look, 2000);
          }
        });
    };
    look();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [businessId, kind, source?.id, source?.locator_kind, confirmedJobId, watch]);

  useEffect(() => {
    uploadedRef.current = null;
  }, [cropFile, zoom]);

  useEffect(() => {
    if (!cropFile) {
      cropGeneration.current += 1;
      replacePreview(null);
      return;
    }
    const key = coverOutputKey(cropFile, zoom);
    const generation = ++cropGeneration.current;
    let cancel = false;
    renderSquareCover(cropFile, zoom)
      .then((blob) => {
        if (cancel || generation !== cropGeneration.current) return;
        replacePreview({ key, url: URL.createObjectURL(blob), blob });
      })
      .catch((error: unknown) => {
        if (!cancel && generation === cropGeneration.current) {
          setNote(error instanceof Error ? error.message : 'Görsel kırpılamadı.');
        }
      });
    return () => {
      cancel = true;
    };
  }, [cropFile, zoom]);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
  }, []);

  async function confirmInterval() {
    if (!source || !sourceLinked) return;
    const window = coverInterval(duration || end, start, end);
    if ('error' in window) {
      setNote(window.error);
      return;
    }
    if (source.locator_kind !== 'storage') {
      setNote('Kayıtlı video dosyası için kesit onaylanır. Bu adresi kapak olarak ayrıca onaylayın.');
      return;
    }
    const assetId = source.id;
    const token = ++requestSerial.current;
    setConfirmedJobId(null);
    remember(null);
    setWorking(true);
    setNote('');
    try {
      const next = await requestCoverSegment(businessId, assetId, window.start, window.end);
      if (sourceRef.current !== assetId || token !== requestSerial.current || !next.jobId) return;
      setConfirmedJobId(next.jobId);
      remember({ assetId, job: next });
      setNote(next.status === 'ready' ? 'Kesit hazır. Kapağı ayrıca onaylayın.' : (coverStatusCopy(next.status) || 'Kesit alındı. Kapak hazırlanıyor.'));
      if (PREPARING.has(next.status)) setWatch((value) => value + 1);
    } catch (error) {
      if (sourceRef.current !== assetId || token !== requestSerial.current) return;
      setNote(error instanceof Error ? error.message : 'Kesit onaylanamadı.');
    } finally {
      if (token === requestSerial.current) setWorking(false);
    }
  }

  async function retry() {
    if (!source || !currentJob?.jobId || working) return;
    const assetId = source.id;
    const jobId = currentJob.jobId;
    const token = ++requestSerial.current;
    setWorking(true);
    setNote('');
    try {
      const next = await retryCoverJobById(businessId, assetId, jobId);
      if (sourceRef.current !== assetId || token !== requestSerial.current || next.jobId !== jobId) return;
      setConfirmedJobId(next.jobId);
      remember({ assetId, job: next });
      if (PREPARING.has(next.status)) setWatch((value) => value + 1);
    } catch (error) {
      if (sourceRef.current !== assetId || token !== requestSerial.current) return;
      setNote(error instanceof Error ? error.message : 'Kapak yeniden denenemedi.');
    } finally {
      if (token === requestSerial.current) setWorking(false);
    }
  }

  async function uploadManualVideo(file: File) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    setWorking(true);
    setNote('');
    try {
      let saved = videoUploadRef.current?.key === key ? videoUploadRef.current.asset : null;
      if (!saved) {
        saved = await uploadBrandVideo(businessId, file, {
          title: file.name.replace(/\.[^.]+$/, '') || 'Yansı videosu',
          caption: '',
          publicAllowed: true,
          coverPreparation: 'manual',
        });
        videoUploadRef.current = { key, asset: saved };
      }
      if (linkVersionIds.length) {
        const linked = await businessRequest<BrandAsset>(`/${businessId}/assets/${saved.id}/links`, 'POST', {
          knowledgeVersionIds: linkVersionIds,
          revision: saved.revision,
        });
        saved = linked?.id ? { ...saved, ...linked } : saved;
        videoUploadRef.current = { key, asset: saved };
        setLinkedVideoIds((current) => (current.includes(saved.id) ? current : [...current, saved.id]));
      }
      setLocalVideos((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSourceId(saved.id);
      requestSerial.current += 1;
      setConfirmedJobId(null);
      remember(null);
      setNote('Video yüklendi. Kesiti onaylayın.');
    } catch (error) {
      const kept = videoUploadRef.current?.key === key;
      setNote(kept && linkVersionIds.length
        ? 'Video yüklendi. Kaynak bağlantısı tamamlanamadı. Yeniden deneyin.'
        : (error instanceof Error ? error.message : 'Video yüklenemedi.'));
    } finally {
      setWorking(false);
    }
  }

  function previewInterval() {
    const node = document.querySelector<HTMLVideoElement>(`[data-testid="biz-video-${source?.id}"]`);
    if (!node) return;
    const window = coverInterval(node.duration || duration || end, start, end);
    if ('error' in window) {
      setNote(window.error);
      return;
    }
    node.currentTime = window.start;
    void node.play();
    const stop = () => {
      if (node.currentTime >= window.end) {
        node.pause();
        node.removeEventListener('timeupdate', stop);
      }
    };
    node.addEventListener('timeupdate', stop);
  }

  async function confirmCrop(file: File) {
    const key = coverOutputKey(file, zoom);
    const shown = previewRef.current;
    if (!shown || shown.key !== key) {
      setNote('Önizleme hazır değil.');
      return;
    }
    setWorking(true);
    setNote('');
    try {
      let saved = uploadedRef.current?.key === key ? uploadedRef.current.asset : null;
      if (!saved) {
        const cropped = new File([shown.blob], 'yansi-cover.jpg', { type: 'image/jpeg' });
        saved = await uploadBrandImage(businessId, cropped, {
          title: 'Yansı kapağı',
          caption: '',
          publicAllowed: true,
        });
        uploadedRef.current = { key, asset: saved };
      }
      if (linkVersionIds.length) {
        await businessRequest(`/${businessId}/assets/${saved.id}/links`, 'POST', {
          knowledgeVersionIds: linkVersionIds,
          revision: saved.revision,
        });
      }
      onConfirm('image', saved.id);
      setNote('Kırpılmış görsel kapak onaylandı.');
    } catch (error) {
      const kept = uploadedRef.current?.key === key;
      setNote(kept
        ? 'Görsel yüklendi. Kaynak bağlantısı tamamlanamadı. Yeniden deneyin.'
        : (error instanceof Error ? error.message : 'Görsel kaydedilemedi.'));
    } finally {
      setWorking(false);
    }
  }

  const readyResult = currentJob?.status === 'ready' ? currentJob.resultAssetId : null;

  return (
    <section className="biz-studio-hint" data-testid="biz-studio-cover-choice">
      <p className="biz-card-meta">Kapak türü</p>
      <button type="button" className="biz-btn-ghost" disabled={busy} onClick={() => onKind('video')}>Video</button>
      <button type="button" className="biz-btn-ghost" disabled={busy} onClick={() => onKind('image')}>Görsel</button>
      <button type="button" className="biz-btn-ghost" disabled>Yakında</button>
      <p className="biz-card-meta" data-testid="biz-studio-selected-cover">
        {confirmed
          ? `Seçilen kapak: ${confirmed.title} · ${confirmed.asset_type === 'video' ? 'video' : 'görsel'}`
          : 'Seçilen kapak: onay bekleniyor'}
      </p>
      {confirmedId ? <p className="biz-card-meta" data-testid="biz-studio-explicit-cover">Seçtiğiniz kapak duruyor.</p> : null}
      {kind === 'video' ? (
        <div>
          <label>
            Video dosyası
            <input
              aria-label="Video dosyası"
              type="file"
              accept="video/mp4"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadManualVideo(file);
              }}
            />
          </label>
          {shownVideos.map((asset) => (
            <button key={asset.id} type="button" className="biz-btn-ghost" onClick={() => setSourceId(asset.id)}>
              {asset.title}
            </button>
          ))}
          {source?.locator_kind === 'storage' ? (
            <AuthorizedVideo businessId={businessId} assetId={source.id} label={source.title} onDuration={setDuration} />
          ) : null}
          <label>
            Başlangıç
            <input aria-label="Kapak başlangıcı" type="range" min={0} max={Math.max(duration, end, 20)} step={0.1} value={start} onChange={(event) => setStart(Number(event.target.value))} />
          </label>
          <label>
            Bitiş
            <input aria-label="Kapak bitişi" type="range" min={0} max={Math.max(duration, 20)} step={0.1} value={end} onChange={(event) => setEnd(Number(event.target.value))} />
          </label>
          <button type="button" className="biz-btn-ghost" onClick={previewInterval}>Kesiti önizle</button>
          <button type="button" className="biz-btn-primary" disabled={busy || !sourceLinked} onClick={() => void confirmInterval()}>
            Kesiti onayla
          </button>
          {currentJob?.status === 'failed' ? (
            <button type="button" className="biz-btn-ghost" disabled={busy || working} onClick={() => void retry()}>Yeniden dene</button>
          ) : null}
          {currentJob ? <p className="biz-card-meta" data-testid={`biz-cover-status-${source?.id}`}>{coverStatusCopy(currentJob.status)}</p> : <p className="biz-card-meta">Kesit henüz onaylanmadı.</p>}
          {readyResult && currentJob?.jobId && sourceLinked ? (
            <button type="button" className="biz-btn-primary" onClick={() => onConfirm('video', readyResult)}>Bu kapağı kullan</button>
          ) : null}
          {source && source.locator_kind !== 'storage' ? (
            <button type="button" className="biz-btn-primary" onClick={() => onConfirm('video', source.id)}>Bu kapağı kullan</button>
          ) : null}
        </div>
      ) : null}
      {kind === 'image' ? (
        <div>
          {images.map((asset) => (
            <button key={asset.id} type="button" className="biz-btn-ghost" onClick={() => setPickedImageId(asset.id)}>
              {asset.title}
            </button>
          ))}
          <label>
            Kapak görseli
            <input
              aria-label="Kapak görseli"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setPickedImageId('');
                setCropFile(file);
              }}
            />
          </label>
          {previewReady && preview ? <img src={preview.url} alt="Kırpılmış kapak önizlemesi" data-testid="biz-cover-crop-preview" /> : null}
          <label>
            Yakınlaştırma
            <input aria-label="Kapak yakınlaştırma" type="range" min={1} max={3} step={0.1} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
          <button
            type="button"
            className="biz-btn-primary"
            disabled={busy || working || (cropFile ? !previewReady : !pickedImageId)}
            onClick={() => {
              if (cropFile) void confirmCrop(cropFile);
              else if (pickedImageId) onConfirm('image', pickedImageId);
            }}
          >
            Bu kapağı kullan
          </button>
        </div>
      ) : null}
      {note ? <p className="biz-alert" role="alert">{note}</p> : null}
    </section>
  );
}
