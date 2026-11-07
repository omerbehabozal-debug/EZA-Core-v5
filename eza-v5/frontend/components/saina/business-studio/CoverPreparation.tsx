'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  fetchBrandVideoPreview,
  fetchCoverJob,
  requestCoverSegment,
  retryCoverJob,
  type CoverJob,
} from '@/lib/eza/businessYansi';

const PREPARING = new Set(['queued', 'running', 'awaiting_encode']);

function releaseUrl(url: string) {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}

const COPY: Record<string, string> = {
  cover_segment_rejected: 'Kesit videonun içinde kalmalı ve 20 saniyeyi geçmemeli.',
  cover_job_busy: 'Kapak şu anda hazırlanıyor. Biraz sonra tekrar deneyin.',
  cover_retry_rejected: 'Kapak zaten hazırlanıyor.',
  cover_job_not_found: 'Bu video için kapak hazırlığı yok.',
};

function messageOf(error: unknown) {
  const text = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
  return COPY[text] || text;
}

export function coverStatusCopy(status: string) {
  if (status === 'ready') return 'Kapak hazır';
  if (status === 'failed') return 'Kapak hazırlanamadı';
  if (PREPARING.has(status)) return 'Kapak hazırlanıyor';
  return '';
}

export function AuthorizedVideo({
  businessId,
  assetId,
  label,
  onDuration,
}: {
  businessId: string;
  assetId: string;
  label: string;
  onDuration?: (seconds: number) => void;
}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    let active = true;
    fetchBrandVideoPreview(businessId, assetId)
      .then((next) => {
        url = next;
        if (active) setSrc(next);
        else releaseUrl(next);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
      releaseUrl(url);
    };
  }, [assetId, businessId]);
  if (!src) return <div className="biz-asset-placeholder">{label}</div>;
  return (
    <video
      className="biz-asset-preview"
      src={src}
      controls
      playsInline
      preload="metadata"
      aria-label={label}
      data-testid={`biz-video-${assetId}`}
      onLoadedMetadata={(event) => onDuration?.(event.currentTarget.duration)}
    />
  );
}

export function CoverPreparation({ businessId, assetId }: { businessId: string; assetId: string }) {
  const [job, setJob] = useState<CoverJob | null>(null);
  const [watch, setWatch] = useState(0);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('20');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      fetchCoverJob(businessId, assetId)
        .then((next) => {
          if (!active) return;
          setUnavailable(false);
          setJob(next);
          if (PREPARING.has(next.status)) timer = setTimeout(look, 2000);
        })
        .catch(() => {
          if (!active) return;
          setJob(null);
          setUnavailable(true);
        });
    };
    look();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [assetId, businessId, watch]);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      setJob(await retryCoverJob(businessId, assetId));
      setWatch((value) => value + 1);
    } catch (error) {
      setNote(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function changeSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      setJob(await requestCoverSegment(businessId, assetId, Number(start), Number(end)));
      setWatch((value) => value + 1);
      setNote('Kesit alındı. Kapak yeniden hazırlanıyor.');
    } catch (error) {
      setNote(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  if (!job) {
    return unavailable ? <p className="biz-card-meta">Kapak durumu şu an görülemiyor.</p> : null;
  }
  const label = coverStatusCopy(job.status);
  const readyId = job.status === 'ready' ? job.resultAssetId : null;
  return (
    <div className="biz-cover-prep" data-testid={`biz-cover-prep-${assetId}`}>
      {label ? <p className="biz-card-meta" data-testid={`biz-cover-status-${assetId}`}>{label}. Kesit onayından sonra hazırlanır.</p> : null}
      {job.status === 'failed' ? (
        <button type="button" className="biz-btn-ghost" onClick={() => void retry()} disabled={busy}>
          Yeniden dene
        </button>
      ) : null}
      {readyId ? <AuthorizedVideo businessId={businessId} assetId={readyId} label="Hazır kapak" /> : null}
      <button type="button" className="biz-btn-ghost" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Kesiti değiştirmek isterseniz
      </button>
      {open ? (
        <form className="biz-form" onSubmit={(event) => void changeSegment(event)}>
          <p className="biz-card-meta">Zorunlu değil. Videonun kendisi değişmez.</p>
          <label>
            Başlangıç (saniye)
            <input aria-label="Kapak başlangıcı" inputMode="decimal" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            Bitiş (saniye)
            <input aria-label="Kapak bitişi" inputMode="decimal" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
          <button type="submit" className="biz-btn-primary" disabled={busy}>Kesiti güncelle</button>
        </form>
      ) : null}
      {note ? <p className="biz-card-meta">{note}</p> : null}
    </div>
  );
}
