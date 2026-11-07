'use client';

import { useEffect, useRef, useState } from 'react';
import type { BrandAsset, CoverImageSuggestion, CoverJob, CoverSuggestion } from '@/lib/eza/businessYansi';
import {
  businessRequest,
  confirmCoverImageSuggestion,
  coverImageSuggestionPreviewUrl,
  fetchCoverImageSuggestion,
  fetchCoverJobById,
  fetchCoverSuggestion,
  isBusinessApiError,
  requestCoverImageSuggestions,
  requestCoverSegment,
  requestCoverSuggestions,
  retryCoverJobById,
  uploadBrandImage,
  uploadBrandVideo,
} from '@/lib/eza/businessYansi';
import { coverInterval, coverOutputKey, renderSquareCover } from '@/lib/eza/business/coverExperience';
import {
  beginNewCoverImageSuggestionAttempt,
  beginNewCoverSuggestionAttempt,
  coverImageSuggestionIdempotencyKey,
  coverSuggestionIdempotencyKey,
  readCoverSuggestionAttemptId,
  resolveCoverImageSuggestionAttempt,
  resolveCoverSuggestionAttempt,
} from '@/lib/eza/business/coverSuggestionAttempt';
import { getAuthToken } from '@/lib/eza/authTokenStore';
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
  aiEnabled?: boolean;
  draftId?: string;
  draftRevision?: number;
  onKind: (kind: Kind) => void;
  onConfirm: (kind: Kind, assetId: string) => void;
};

const SUGGESTION_ERROR: Record<string, string> = {
  cover_ai_disabled: 'Öneri kapak şu an kapalı.',
  cover_ai_pricing_not_configured: 'Öneri fiyatı ayarlı değil.',
  cover_ai_budget_not_configured: 'Öneri bütçesi ayarlı değil.',
  cover_ai_request_ceiling: 'Bu öneri istek sınırını aşıyor.',
  cover_ai_daily_budget: 'Günlük öneri sınırı doldu.',
  cover_ai_provider_not_configured: 'Öneri sağlayıcısı ayarlı değil.',
  cover_ai_provider_failed: 'Öneri hazırlanamadı.',
  cover_ai_intervals_rejected: 'Öneri hazırlanamadı.',
  cover_ai_frames_rejected: 'Video kareleri okunamadı.',
  cover_ai_frames_unavailable: 'Video kareleri okunamadı.',
  cover_source_not_stored: 'Kayıtlı video dosyası gerekir.',
  cover_source_unmeasured: 'Video süresi ölçülemedi.',
  cover_ai_idempotency_conflict: 'Bu öneri isteği önceki istekle uyuşmuyor.',
  cover_ai_credentials_missing: 'Öneri kimlik bilgisi ayarlı değil.',
  cover_ai_model_unsupported: 'Seçilen öneri modeli desteklenmiyor.',
  cover_ai_model_pricing_missing: 'Model fiyatı ayarlı değil.',
  cover_ai_cancelled: 'Öneri isteği iptal edildi.',
  cover_ai_provider_timeout: 'Öneri zaman aşımına uğradı.',
  cover_ai_provider_uncertain: 'Öneri sonucu belirsiz kaldı.',
  cover_ai_lease_expired: 'Öneri süresi doldu.',
  cover_ai_draft_stale: 'Taslak değişti. Bu öneri artık seçilemez.',
  cover_ai_preview_expired: 'Öneri önizlemesinin süresi doldu.',
  cover_ai_preview_unavailable: 'Öneri önizlemesi hazır değil.',
  cover_ai_confirm_unavailable: 'Bu öneri onaylanamaz.',
  cover_ai_links_required: 'Kapak önerisini onaylamak için en az bir bilgi kaynağı gerekir.',
  cover_ai_link_not_in_draft: 'Seçilen bilgi kaynağı bu taslakta yok.',
  archived_asset: 'Bu video arşivlendi.',
};

function suggestionError(code: string | null | undefined) {
  if (code && SUGGESTION_ERROR[code]) return SUGGESTION_ERROR[code];
  return 'Öneri hazırlanamadı.';
}

const PREPARING = new Set(['queued', 'running', 'awaiting_encode']);

export function CoverExperience({
  businessId,
  assets,
  kind,
  confirmedId,
  linkVersionIds = [],
  busy,
  aiEnabled = false,
  draftId = '',
  draftRevision = 1,
  onKind,
  onConfirm,
}: Props) {
  const videos = assets.filter((asset) => asset.asset_type === 'video');
  const images = assets.filter((asset) => asset.asset_type === 'image');
  const [localVideos, setLocalVideos] = useState<BrandAsset[]>([]);
  const [localImages, setLocalImages] = useState<BrandAsset[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(20);
  const [duration, setDuration] = useState(0);
  const [tracked, setTracked] = useState<TrackedJob | null>(null);
  const [confirmedJobId, setConfirmedJobId] = useState<string | null>(null);
  const [watch, setWatch] = useState(0);
  const [note, setNote] = useState('');
  const [suggestion, setSuggestion] = useState<(CoverSuggestion & { assetId: string }) | null>(null);
  const [suggestionAttemptId, setSuggestionAttemptId] = useState<string | null>(null);
  const [imageSuggestion, setImageSuggestion] = useState<CoverImageSuggestion | null>(null);
  const [imageAttemptId, setImageAttemptId] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
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
  const shownImages = [...localImages, ...images.filter((asset) => !localImages.some((item) => item.id === asset.id))];
  const source = shownVideos.find((asset) => asset.id === sourceId) || shownVideos[0] || null;
  sourceRef.current = source?.id || '';
  const confirmed = [...assets, ...localVideos, ...localImages].find((asset) => asset.id === confirmedId) || null;
  const imageSuggestionPending = Boolean(
    imageSuggestion && (imageSuggestion.status === 'reserved' || imageSuggestion.status === 'running'),
  );
  const imageSuggestionReady = Boolean(
    imageSuggestion
      && imageSuggestion.status === 'succeeded'
      && imageSuggestion.previewReady
      && imageSuggestion.sourceCurrent !== false
      && !imageSuggestion.confirmedAssetId,
  );
  const draftRef = useRef(draftId);
  draftRef.current = draftId;
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
    setSuggestion(null);
    // Restore a stored attempt for this source. Never mint here — only on explicit ask/regen.
    setSuggestionAttemptId(
      source ? readCoverSuggestionAttemptId(businessId, source.id, source.revision) : null,
    );
  }, [businessId, source?.id, source?.revision]);

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
    setImageSuggestion(null);
    setImageAttemptId(null);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [businessId, draftId, draftRevision]);

  useEffect(() => {
    if (!aiEnabled || !source || suggestion?.assetId !== source.id) return;
    if (suggestion.status !== 'reserved' && suggestion.status !== 'running') return;
    const assetId = source.id;
    const proposalId = suggestion.proposalId;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      fetchCoverSuggestion(businessId, assetId, proposalId)
        .then((next) => {
          if (!active || sourceRef.current !== assetId) return;
          setSuggestion({ ...next, assetId });
          if (next.status === 'failed' || next.status === 'expired') setNote(suggestionError(next.errorCode));
          if (next.sourceCurrent === false) setNote('Video değişti. Öneriler artık seçilemez.');
          if (next.status === 'reserved' || next.status === 'running') timer = setTimeout(look, 2000);
        })
        .catch(() => {
          if (active && sourceRef.current === assetId) timer = setTimeout(look, 2000);
        });
    };
    timer = setTimeout(look, 2000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [aiEnabled, businessId, source?.id, suggestion?.assetId, suggestion?.proposalId, suggestion?.status]);

  useEffect(() => {
    if (!aiEnabled || !draftId || !imageSuggestion) return;
    if (imageSuggestion.status !== 'reserved' && imageSuggestion.status !== 'running') return;
    const proposalId = imageSuggestion.proposalId;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      fetchCoverImageSuggestion(businessId, draftId, proposalId)
        .then(async (next) => {
          if (!active || draftRef.current !== draftId) return;
          setImageSuggestion(next);
          if (next.status === 'failed' || next.status === 'expired') setNote(suggestionError(next.errorCode));
          if (next.sourceCurrent === false) setNote('Taslak değişti. Öneri artık seçilemez.');
          if (next.status === 'reserved' || next.status === 'running') timer = setTimeout(look, 2000);
          if (next.status === 'succeeded' && next.previewReady) {
            setNote('Öneri hazır. Onaylamadan kapak değişmez.');
            try {
              await loadImagePreviewBytes(next.proposalId);
            } catch {
              setNote('Öneri önizlemesi açılamadı.');
            }
          }
        })
        .catch(() => {
          if (active && draftRef.current === draftId) timer = setTimeout(look, 2000);
        });
    };
    timer = setTimeout(look, 2000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [aiEnabled, businessId, draftId, imageSuggestion?.proposalId, imageSuggestion?.status]);

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
      // Reassignment after linking widens `saved` back to BrandAsset | null; keep a definite asset.
      if (!saved) throw new Error('Video yüklenemedi.');
      let asset: BrandAsset = saved;
      if (linkVersionIds.length) {
        const linked = await businessRequest<BrandAsset>(`/${businessId}/assets/${asset.id}/links`, 'POST', {
          knowledgeVersionIds: linkVersionIds,
          revision: asset.revision,
        });
        asset = linked?.id ? { ...asset, ...linked } : asset;
        videoUploadRef.current = { key, asset };
        setLinkedVideoIds((current) => (current.includes(asset.id) ? current : [...current, asset.id]));
      }
      setLocalVideos((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setSourceId(asset.id);
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

  async function askSuggestions(attemptId?: string) {
    if (!aiEnabled || !source || source.locator_kind !== 'storage' || working) return;
    const assetId = source.id;
    const revision = source.revision;
    const resolved = attemptId
      || resolveCoverSuggestionAttempt(businessId, assetId, revision, suggestionAttemptId);
    setSuggestionAttemptId(resolved);
    setWorking(true);
    setNote('');
    try {
      const next = await requestCoverSuggestions(
        businessId,
        assetId,
        coverSuggestionIdempotencyKey(assetId, revision, resolved),
      );
      if (sourceRef.current !== assetId) return;
      setSuggestion({ ...next, assetId });
      if (next.status === 'failed' || next.status === 'expired') setNote(suggestionError(next.errorCode));
      else if (next.sourceCurrent === false) setNote('Video değişti. Öneriler artık seçilemez.');
      else if (next.status === 'reserved' || next.status === 'running') setNote('Öneriler hazırlanıyor.');
    } catch (error) {
      if (sourceRef.current !== assetId) return;
      setNote(isBusinessApiError(error) ? suggestionError(error.code) : 'Öneri hazırlanamadı.');
    } finally {
      setWorking(false);
    }
  }

  function requestNewPaidSuggestion() {
    if (!source) return;
    const accepted = typeof window !== 'undefined'
      ? window.confirm('Yeni öneri isteği ücretli olabilir. Devam edilsin mi?')
      : false;
    if (!accepted) return;
    const nextId = beginNewCoverSuggestionAttempt(businessId, source.id, source.revision);
    setSuggestionAttemptId(nextId);
    void askSuggestions(nextId);
  }

  async function loadImagePreviewBytes(proposalId: string) {
    const token = getAuthToken();
    if (!token || !draftId) return;
    const response = await fetch(coverImageSuggestionPreviewUrl(businessId, draftId, proposalId), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Öneri önizlemesi açılamadı.');
    const blob = await response.blob();
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
  }

  async function askImageSuggestions(attemptId?: string) {
    if (!aiEnabled || !draftId || working) return;
    const revision = draftRevision;
    const resolved = attemptId
      || resolveCoverImageSuggestionAttempt(businessId, draftId, revision, imageAttemptId);
    setImageAttemptId(resolved);
    setWorking(true);
    setNote('');
    try {
      const next = await requestCoverImageSuggestions(
        businessId,
        draftId,
        coverImageSuggestionIdempotencyKey(draftId, revision, resolved),
      );
      if (draftRef.current !== draftId) return;
      setImageSuggestion(next);
      if (next.status === 'failed' || next.status === 'expired') setNote(suggestionError(next.errorCode));
      else if (next.sourceCurrent === false) setNote('Taslak değişti. Öneri artık seçilemez.');
      else if (next.status === 'reserved' || next.status === 'running') setNote('Öneri kapak görseli hazırlanıyor.');
      else if (next.previewReady) {
        setNote('Öneri hazır. Onaylamadan kapak değişmez.');
        await loadImagePreviewBytes(next.proposalId);
      }
    } catch (error) {
      if (draftRef.current !== draftId) return;
      setNote(isBusinessApiError(error) ? suggestionError(error.code) : 'Öneri hazırlanamadı.');
    } finally {
      setWorking(false);
    }
  }

  function requestNewPaidImageSuggestion() {
    if (!draftId) return;
    const accepted = typeof window !== 'undefined'
      ? window.confirm('Yeni görsel önerisi ücretli olabilir. Devam edilsin mi?')
      : false;
    if (!accepted) return;
    const nextId = beginNewCoverImageSuggestionAttempt(businessId, draftId, draftRevision);
    setImageAttemptId(nextId);
    void askImageSuggestions(nextId);
  }

  async function confirmImageAiSuggestion() {
    if (!draftId || !imageSuggestion?.proposalId || !imageSuggestionReady || working) return;
    const proposalId = imageSuggestion.proposalId;
    setWorking(true);
    setNote('');
    try {
      const asset = await confirmCoverImageSuggestion(businessId, draftId, proposalId, linkVersionIds);
      if (draftRef.current !== draftId) return;
      setLocalImages((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setPickedImageId(asset.id);
      setImageSuggestion({ ...imageSuggestion, confirmedAssetId: asset.id, previewReady: false });
      onConfirm('image', asset.id);
      setNote('Öneri onaylandı. Kapak seçildi; Yansı otomatik yayımlanmaz.');
    } catch (error) {
      if (draftRef.current !== draftId) return;
      setNote(isBusinessApiError(error) ? suggestionError(error.code) : 'Öneri onaylanamadı.');
    } finally {
      setWorking(false);
    }
  }

  function previewInterval(startAt = start, endAt = end) {
    const node = document.querySelector<HTMLVideoElement>(`[data-testid="biz-video-${source?.id}"]`);
    if (!node) return;
    const window = coverInterval(node.duration || duration || endAt, startAt, endAt);
    if ('error' in window) {
      setNote(window.error);
      return;
    }
    node.currentTime = window.start;
    try {
      const pending = node.play();
      if (pending && typeof pending.catch === 'function') void pending.catch(() => undefined);
    } catch {
      // Seeking already shows the interval when playback is unavailable.
    }
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
  const suggestionForSource = suggestion && source && suggestion.assetId === source.id ? suggestion : null;
  const suggestionPending = suggestionForSource?.status === 'reserved' || suggestionForSource?.status === 'running';
  const suggestionSelectable = Boolean(
    suggestionForSource?.status === 'succeeded'
      && suggestionForSource.sourceCurrent !== false
      && (suggestionForSource.assetRevision == null || suggestionForSource.assetRevision === source?.revision)
      && suggestionForSource.intervals.length,
  );
  // Succeeded/failed/expired/stale all end the current attempt; a new paid try needs confirm.
  const suggestionTerminal = suggestionForSource?.status === 'failed'
    || suggestionForSource?.status === 'expired'
    || suggestionForSource?.status === 'succeeded'
    || suggestionForSource?.sourceCurrent === false;

  return (
    <section className="biz-studio-hint" data-testid="biz-studio-cover-choice">
      <p className="biz-card-meta">Kapak türü</p>
      <button type="button" className="biz-btn-ghost" disabled={busy} onClick={() => onKind('video')}>Video</button>
      <button type="button" className="biz-btn-ghost" disabled={busy} onClick={() => onKind('image')}>Görsel</button>
      <button
        type="button"
        className="biz-btn-ghost"
        disabled={!aiEnabled || busy || working || suggestionPending || source?.locator_kind !== 'storage'}
        onClick={() => void askSuggestions()}
      >
        {aiEnabled ? 'Öneri kapak videosu oluştur' : 'Yakında'}
      </button>
      {aiEnabled && suggestionTerminal ? (
        <button
          type="button"
          className="biz-btn-ghost"
          disabled={busy || working || source?.locator_kind !== 'storage'}
          onClick={requestNewPaidSuggestion}
        >
          Yeni öneri iste
        </button>
      ) : null}
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
          <button type="button" className="biz-btn-ghost" onClick={() => previewInterval()}>Kesiti önizle</button>
          {suggestionPending ? <p data-testid="biz-cover-suggestion-pending">Öneriler hazırlanıyor.</p> : null}
          {suggestionSelectable ? (
            <div data-testid="biz-cover-suggestions">
              {suggestionForSource!.intervals.map((interval) => (
                <button
                  key={`${interval.startSeconds}-${interval.endSeconds}`}
                  type="button"
                  className="biz-btn-ghost"
                  onClick={() => {
                    if (suggestionForSource?.sourceCurrent === false) {
                      setNote('Video değişti. Öneriler artık seçilemez.');
                      return;
                    }
                    if (
                      suggestionForSource?.assetRevision != null
                      && source
                      && suggestionForSource.assetRevision !== source.revision
                    ) {
                      setNote('Video değişti. Öneriler artık seçilemez.');
                      return;
                    }
                    setStart(interval.startSeconds);
                    setEnd(interval.endSeconds);
                    previewInterval(interval.startSeconds, interval.endSeconds);
                  }}
                >
                  {`Önerilen kesit ${interval.startSeconds}–${interval.endSeconds} sn`}
                </button>
              ))}
            </div>
          ) : null}
          {suggestionForSource?.status === 'succeeded' && !suggestionSelectable ? (
            <p>Uygun kesit bulunamadı.</p>
          ) : null}
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
          {shownImages.map((asset) => (
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
          <div data-testid="biz-cover-image-ai">
            <button
              type="button"
              className="biz-btn-ghost"
              data-testid="biz-cover-image-suggest"
              disabled={!aiEnabled || !draftId || busy || working || imageSuggestionPending}
              onClick={() => {
                if (!aiEnabled) return;
                if (imageSuggestion && (imageSuggestion.status === 'succeeded' || imageSuggestion.status === 'failed' || imageSuggestion.status === 'expired')) {
                  requestNewPaidImageSuggestion();
                  return;
                }
                void askImageSuggestions();
              }}
            >
              {aiEnabled ? (draftId ? 'Öneri kapak görseli oluştur' : 'Öneri için taslağı kaydedin') : 'Yakında'}
            </button>
            {aiEnabled && imageSuggestion && (imageSuggestion.status === 'succeeded' || imageSuggestion.status === 'failed' || imageSuggestion.status === 'expired') ? (
              <button
                type="button"
                className="biz-btn-ghost"
                data-testid="biz-cover-image-suggest-again"
                disabled={!draftId || busy || working}
                onClick={() => requestNewPaidImageSuggestion()}
              >
                Yeni öneri iste
              </button>
            ) : null}
            {imageSuggestionPending ? <p data-testid="biz-cover-image-suggestion-pending">Öneri kapak görseli hazırlanıyor.</p> : null}
            {imagePreviewUrl && imageSuggestionReady ? (
              <img src={imagePreviewUrl} alt="AI kapak önerisi önizlemesi" data-testid="biz-cover-image-ai-preview" />
            ) : null}
            {imageSuggestionReady ? (
              <button
                type="button"
                className="biz-btn-primary"
                data-testid="biz-cover-image-ai-confirm"
                disabled={busy || working}
                onClick={() => void confirmImageAiSuggestion()}
              >
                Öneriyi onayla ve kapak yap
              </button>
            ) : null}
            {imageSuggestion?.status === 'succeeded' && imageSuggestion.sourceCurrent === false ? (
              <p>Taslak değişti. Bu öneri artık seçilemez.</p>
            ) : null}
          </div>
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
