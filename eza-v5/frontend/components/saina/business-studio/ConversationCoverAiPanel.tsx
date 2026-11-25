'use client';

/**
 * Thin V2 Cover AI strip for Yansı Oluştur — reuses Business Cover AI APIs.
 * Not a separate cover studio. Explicit generate / confirm / regenerate only.
 */

import { useEffect, useRef, useState } from 'react';
import type { CoverImageSuggestion, YansiV2ConversationDraftDto } from '@/lib/eza/businessYansi';
import {
  confirmYansiV2CoverImageSuggestion,
  fetchYansiV2CoverImageSuggestion,
  isBusinessApiError,
  requestYansiV2CoverImageSuggestion,
  yansiV2CoverImageSuggestionPreviewUrl,
} from '@/lib/eza/businessYansi';
import {
  beginNewCoverImageSuggestionAttempt,
  coverImageSuggestionIdempotencyKey,
  resolveCoverImageSuggestionAttempt,
} from '@/lib/eza/business/coverSuggestionAttempt';
import { getAuthToken } from '@/lib/eza/authTokenStore';

const SUGGESTION_ERROR: Record<string, string> = {
  cover_ai_disabled: 'AI kapak şu an kapalı.',
  cover_ai_pricing_not_configured: 'AI kapak fiyatı ayarlı değil.',
  cover_ai_budget_not_configured: 'AI kapak bütçesi ayarlı değil.',
  cover_ai_request_ceiling: 'Bu istek bütçe sınırını aşıyor.',
  cover_ai_daily_budget: 'Günlük AI kapak sınırı doldu.',
  cover_ai_provider_not_configured: 'AI kapak sağlayıcısı ayarlı değil.',
  cover_ai_provider_failed: 'Kapak görseli üretilemedi.',
  cover_ai_draft_incomplete: 'AI kapak için başlık ve en az bir soru-cevap gerekli.',
  cover_ai_draft_stale: 'Taslak değişti. Bu öneri artık seçilemez.',
  cover_ai_preview_expired: 'Önizlemenin süresi doldu. Yeniden oluşturun.',
  cover_ai_preview_unavailable: 'Önizleme hazır değil.',
  cover_ai_confirm_unavailable: 'Bu öneri onaylanamaz.',
  cover_ai_links_required: 'Kapak için taslağa bağlı bilgi kaynağı gerekir.',
  cover_ai_public_required: 'Keşfet için kapakta herkese açık kullanım izni gerekli.',
  draft_immutable: 'Yayımlanmış taslak düzenlenemez.',
  draft_not_editable: 'Bu taslak durumunda AI kapak üretilemez.',
  revision_conflict: 'Taslak sürümü değişti. Sayfayı yenileyip tekrar deneyin.',
};

function suggestionError(code: string | null | undefined, fallback?: string) {
  if (code && SUGGESTION_ERROR[code]) return SUGGESTION_ERROR[code];
  return fallback || 'Kapak önerisi hazırlanamadı.';
}

type Props = {
  businessId: string;
  draftId: string;
  draftRevision: number;
  knowledgeVersionIds: string[];
  enabled: boolean;
  locked?: boolean;
  onBound: (draft: YansiV2ConversationDraftDto) => void;
  onAssetsChanged?: () => Promise<void> | void;
};

export default function ConversationCoverAiPanel({
  businessId,
  draftId,
  draftRevision,
  knowledgeVersionIds,
  enabled,
  locked = false,
  onBound,
  onAssetsChanged,
}: Props) {
  const [visualDirection, setVisualDirection] = useState('');
  const [publicAllowed, setPublicAllowed] = useState(false);
  const [suggestion, setSuggestion] = useState<CoverImageSuggestion | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewObjectRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (previewObjectRef.current) URL.revokeObjectURL(previewObjectRef.current);
    };
  }, []);

  // Reset private AI preview only when the draft identity changes.
  // Revision bumps (title/Q&A edits, confirm bind) must not wipe a ready preview;
  // confirm still sends expectedRevision and backend enforces stale/revision checks.
  useEffect(() => {
    setSuggestion(null);
    setError(null);
    setStatusLabel(null);
    setPublicAllowed(false);
    if (previewObjectRef.current) {
      URL.revokeObjectURL(previewObjectRef.current);
      previewObjectRef.current = null;
    }
    setPreviewUrl(null);
  }, [draftId]);

  async function loadPreview(proposalId: string) {
    const token = getAuthToken();
    if (!token) {
      setError('Önizleme için giriş gerekli.');
      return;
    }
    const res = await fetch(yansiV2CoverImageSuggestionPreviewUrl(businessId, draftId, proposalId), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      setError('Önizleme alınamadı.');
      return;
    }
    const blob = await res.blob();
    if (previewObjectRef.current) URL.revokeObjectURL(previewObjectRef.current);
    const url = URL.createObjectURL(blob);
    previewObjectRef.current = url;
    setPreviewUrl(url);
  }

  async function pollUntilReady(proposalId: string) {
    const poll = async () => {
      const next = await fetchYansiV2CoverImageSuggestion(businessId, draftId, proposalId);
      setSuggestion(next);
      if (next.status === 'reserved' || next.status === 'running') {
        setStatusLabel('Üretiliyor…');
        pollRef.current = setTimeout(() => {
          void poll();
        }, 1200);
        return;
      }
      if (next.status === 'succeeded' && next.previewReady) {
        setStatusLabel('Önizleme hazır');
        await loadPreview(proposalId);
        return;
      }
      setStatusLabel(null);
      setError(suggestionError(next.errorCode));
    };
    await poll();
  }

  async function generate(recreate: boolean) {
    if (locked || busy || !enabled) return;
    if (recreate) {
      const ok = window.confirm(
        'Yeniden oluşturma ayrı bir ücretli işlem olabilir. Devam edilsin mi?',
      );
      if (!ok) return;
      beginNewCoverImageSuggestionAttempt(businessId, draftId, draftRevision);
    }
    setBusy(true);
    setError(null);
    setStatusLabel('İstek gönderiliyor…');
    try {
      const attempt = resolveCoverImageSuggestionAttempt(
        businessId,
        draftId,
        draftRevision,
        null,
      );
      const key = coverImageSuggestionIdempotencyKey(draftId, draftRevision, attempt);
      const row = await requestYansiV2CoverImageSuggestion(businessId, draftId, {
        idempotencyKey: key,
        visualDirection,
      });
      setSuggestion(row);
      if (row.status === 'succeeded' && row.previewReady) {
        setStatusLabel('Önizleme hazır');
        await loadPreview(row.proposalId);
      } else if (row.status === 'reserved' || row.status === 'running') {
        await pollUntilReady(row.proposalId);
      } else {
        setError(suggestionError(row.errorCode));
        setStatusLabel(null);
      }
    } catch (err) {
      const code = isBusinessApiError(err) ? err.code : null;
      setError(suggestionError(code, err instanceof Error ? err.message : undefined));
      setStatusLabel(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAsCover() {
    if (!suggestion?.proposalId || locked || busy) return;
    if (!publicAllowed) {
      setError('Kapak olarak kullanmak için herkese açık kullanım iznini işaretleyin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await confirmYansiV2CoverImageSuggestion(
        businessId,
        draftId,
        suggestion.proposalId,
        {
          publicAllowed: true,
          knowledgeVersionIds,
          expectedRevision: draftRevision,
          bindCover: true,
        },
      );
      if (result.draft) onBound(result.draft);
      await onAssetsChanged?.();
      setSuggestion(null);
      setStatusLabel('Kapak taslağa bağlandı');
      if (previewObjectRef.current) {
        URL.revokeObjectURL(previewObjectRef.current);
        previewObjectRef.current = null;
      }
      setPreviewUrl(null);
    } catch (err) {
      const code = isBusinessApiError(err) ? err.code : null;
      setError(suggestionError(code, err instanceof Error ? err.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setSuggestion(null);
    setError(null);
    setStatusLabel(null);
    if (previewObjectRef.current) {
      URL.revokeObjectURL(previewObjectRef.current);
      previewObjectRef.current = null;
    }
    setPreviewUrl(null);
  }

  if (!enabled) {
    return (
      <p className="biz-card-meta" data-testid="biz-conv-cover-ai-disabled">
        AI kapak üretimi bu ortamda kapalı. Yükleme veya kütüphane seçimini kullanın.
      </p>
    );
  }

  return (
    <section className="biz-conv-cover-ai" data-testid="biz-conv-cover-ai">
      <h4>Yapay zekâ ile kapak oluştur</h4>
      <p className="biz-card-meta">
        Başlık, merak sorusu, özet ve sohbet içeriğinden beslenir. Üretim açık onayınız olmadan
        başlamaz. Görsele yazı/logo eklenmez — Keşfet kartı metni ayrıca gösterir.
      </p>
      <label>
        Görsel yönlendirme (isteğe bağlı)
        <input
          data-testid="biz-conv-cover-ai-direction"
          value={visualDirection}
          maxLength={400}
          disabled={locked || busy}
          placeholder="Örn. sakin atölye ışığı, yumuşak gölgeler"
          onChange={(e) => setVisualDirection(e.target.value)}
        />
      </label>
      <div className="biz-actions">
        <button
          type="button"
          className="biz-btn-secondary"
          data-testid="biz-conv-cover-ai-generate"
          disabled={locked || busy}
          onClick={() => void generate(Boolean(suggestion))}
        >
          {busy
            ? 'Üretiliyor…'
            : suggestion
              ? 'Yeniden oluştur'
              : 'AI ile kapak oluştur'}
        </button>
        {suggestion ? (
          <button
            type="button"
            className="biz-btn-ghost"
            data-testid="biz-conv-cover-ai-dismiss"
            disabled={busy}
            onClick={dismiss}
          >
            Vazgeç
          </button>
        ) : null}
      </div>
      {statusLabel ? (
        <p className="biz-notice" role="status" data-testid="biz-conv-cover-ai-status">
          {statusLabel}
        </p>
      ) : null}
      {previewUrl ? (
        <div className="biz-conv-cover-ai-preview" data-testid="biz-conv-cover-ai-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="AI kapak önizlemesi" />
          <label className="biz-conv-image-confirm">
            <input
              type="checkbox"
              data-testid="biz-conv-cover-ai-public"
              checked={publicAllowed}
              disabled={locked || busy}
              onChange={(e) => setPublicAllowed(e.target.checked)}
            />{' '}
            Bu görseli herkese açık kapak olarak kullanmayı onaylıyorum (Keşfet uygunluğu).
          </label>
          <button
            type="button"
            className="biz-btn-primary"
            data-testid="biz-conv-cover-ai-confirm"
            disabled={locked || busy || !publicAllowed}
            onClick={() => void confirmAsCover()}
          >
            Kapak olarak kullan
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="biz-error" role="alert" data-testid="biz-conv-cover-ai-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
