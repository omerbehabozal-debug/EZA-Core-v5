'use client';

/**
 * Phase 8.4 — minimal report / owner unpublish controls on public Yansı surfaces.
 * Secondary actions only — never compete with the primary experience CTA.
 */

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  reportYansi,
  unpublishYansi,
  setYansiVisibility,
  YANSI_REPORT_REASONS,
  type YansiReportReason,
} from '@/lib/eza/mirror-network/yansiTrustActions';
import {
  applyOwnerYansiUnpublishedLocally,
  demoteMirrorJourneyArtifactsByPublishedSlug,
  noteOwnerYansiSlugPublication,
} from '@/lib/eza/mirror/journey';

export type YansiTrustActionsProps = {
  slug: string;
  authorUserId?: string | null;
  className?: string;
};

type Panel = 'closed' | 'report' | 'owner' | 'done';

export default function YansiTrustActions({
  slug,
  authorUserId,
  className,
}: YansiTrustActionsProps) {
  const { isAuthenticated, user, isAuthReady } = useAuth();
  const [panel, setPanel] = useState<Panel>('closed');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<YansiReportReason>('inappropriate');

  if (!isAuthReady) return null;

  const isOwner =
    Boolean(isAuthenticated && user?.user_id && authorUserId) &&
    user!.user_id === authorUserId;

  const onReport = async () => {
    if (!isAuthenticated) {
      setMessage('Bildirmek için giriş yapmalısın.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await reportYansi(slug, reason);
    setBusy(false);
    if (!result.ok) {
      setMessage('Bildirim gönderilemedi. Biraz sonra tekrar dene.');
      return;
    }
    setPanel('done');
    setMessage(
      result.status === 'already_reported'
        ? 'Bu Yansı için daha önce bildirim gönderilmiş.'
        : 'Bildirimin alındı. Teşekkürler.'
    );
  };

  const onUnpublish = async () => {
    setBusy(true);
    setMessage(null);
    const result = await unpublishYansi(slug);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.code === 'forbidden'
          ? 'Bu Yansı için yetkin yok.'
          : 'Yayından kaldırılamadı. Biraz sonra tekrar dene.'
      );
      return;
    }
    applyOwnerYansiUnpublishedLocally(slug);
    demoteMirrorJourneyArtifactsByPublishedSlug(slug);
    setPanel('done');
    setMessage(
      result.status === 'already_unpublished'
        ? 'Bu Yansı zaten yayından kaldırılmış.'
        : 'Yansı yayından kaldırıldı. Eski linkler artık açılamaz.'
    );
  };

  const onHideFromDiscover = async () => {
    setBusy(true);
    setMessage(null);
    const result = await setYansiVisibility(slug, 'unlisted');
    setBusy(false);
    if (!result.ok) {
      setMessage('Keşfet görünürlüğü değiştirilemedi.');
      return;
    }
    setPanel('done');
    setMessage('Keşfet’ten gizlendi. Linki olanlar hâlâ açabilir.');
  };

  return (
    <div
      className={className}
      data-testid="yansi-trust-actions"
      style={{ fontSize: '12px' }}
    >
      {panel === 'closed' ? (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[#a89880]">
          {isOwner ? (
            <button
              type="button"
              className="underline-offset-2 hover:underline"
              onClick={() => {
                setMessage(null);
                setPanel('owner');
              }}
              data-testid="yansi-owner-controls-open"
            >
              Yayın ayarları
            </button>
          ) : (
            <button
              type="button"
              className="underline-offset-2 hover:underline"
              onClick={() => {
                setMessage(null);
                setPanel('report');
              }}
              data-testid="yansi-report-open"
            >
              Bildir
            </button>
          )}
        </div>
      ) : null}

      {panel === 'report' ? (
        <div
          className="mx-auto mt-2 max-w-sm space-y-3 rounded-xl border border-white/10 bg-black/30 p-3 text-[#e8dfd0]"
          data-testid="yansi-report-panel"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#a89880]">
            Yansı bildir
          </p>
          <div className="flex flex-col gap-2">
            {YANSI_REPORT_REASONS.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="yansi-report-reason"
                  checked={reason === item.id}
                  onChange={() => setReason(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onReport()}
              className="rounded-full border border-[#e8d5b5]/35 px-3 py-1.5 text-xs"
              data-testid="yansi-report-submit"
            >
              Gönder
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPanel('closed')}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#a89880]"
            >
              Vazgeç
            </button>
          </div>
          {message ? (
            <p className="text-xs text-[#c9bba8]" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}

      {panel === 'owner' ? (
        <div
          className="mx-auto mt-2 max-w-sm space-y-3 rounded-xl border border-white/10 bg-black/30 p-3 text-[#e8dfd0]"
          data-testid="yansi-owner-panel"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#a89880]">
            Yayın ayarları
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onHideFromDiscover()}
            className="block w-full rounded-full border border-white/15 px-3 py-2 text-left text-xs"
            data-testid="yansi-set-unlisted"
          >
            Keşfet’ten gizle (link açık kalsın)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onUnpublish()}
            className="block w-full rounded-full border border-red-300/30 px-3 py-2 text-left text-xs text-[#f0cfc0]"
            data-testid="yansi-unpublish"
          >
            Yayından kaldır
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPanel('closed')}
            className="text-xs text-[#a89880]"
          >
            Kapat
          </button>
          {message ? (
            <p className="text-xs text-[#c9bba8]" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}

      {panel === 'done' && message ? (
        <p
          className="mt-2 text-center text-xs text-[#c9bba8]"
          role="status"
          data-testid="yansi-trust-status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
