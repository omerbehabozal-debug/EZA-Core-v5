'use client';

import { useEffect, useState } from 'react';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import { buildMirrorIntentDebugSnapshot } from '@/lib/eza/mirror/mirrorIntentContext';
import { isMirrorDevToolsEnabled } from '@/lib/eza/mirror/devTools';
import {
  resolveMirrorRenderMode,
} from '@/lib/eza/mirror/mirrorRenderMode';
import type { MirrorLayoutDebug } from '@/lib/eza/mirror/mirrorPosterLayout';

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">
        {label}
      </p>
      <p className="break-words text-xs text-stone-800">{value || '—'}</p>
    </div>
  );
}

function DebugBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">
        {label}
      </p>
      <pre className="max-h-36 overflow-auto rounded-lg border border-amber-200/70 bg-white/80 p-2 text-[11px] leading-relaxed text-stone-700 whitespace-pre-wrap break-words">
        {value || '—'}
      </pre>
    </div>
  );
}

export type MirrorLiveDebugPanelProps = {
  card: DailyMirrorCardModel | null;
  entries: SavedBehavioralEntry[];
  meta?: MirrorStateMeta | null;
  posterVersion?: string;
  renderMode?: string;
  layoutDebug?: MirrorLayoutDebug | null;
  hybridTextFallback?: boolean;
  onForceBmwMercedes?: () => void;
  onToggleHybridMode?: () => void;
};

/**
 * Sprint 13C live debug — hybrid poster diagnostics (development only).
 */
export default function MirrorLiveDebugPanel({
  card,
  entries,
  meta,
  posterVersion = 'v8c-scene-contract',
  renderMode = 'scene_only',
  layoutDebug = null,
  hybridTextFallback = false,
  onForceBmwMercedes,
  onToggleHybridMode,
}: MirrorLiveDebugPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isMirrorDevToolsEnabled() || !mounted) {
    return null;
  }

  const snap = buildMirrorIntentDebugSnapshot({
    card,
    entries,
    meta,
    posterVersion,
  });

  const showHybridWarning =
    hybridTextFallback ||
    snap.hybridTextFallback === 'true' ||
    (snap.renderMode === 'hybrid_middle' &&
      (snap.mockSceneImage.startsWith('YES') ||
        snap.hybridPromptMarkersOk === 'NO' ||
        snap.hybridOcrProbe.includes('fail')));

  return (
    <details className="mt-4 w-full rounded-xl border border-dashed border-amber-300/90 bg-amber-50/50 text-left">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-amber-950 marker:content-none [&::-webkit-details-marker]:hidden">
        Mirror Live Debug (13C Hybrid)
        <span className="ml-2 font-normal text-amber-800/80">dev only</span>
      </summary>
      <div className="space-y-3 border-t border-amber-200/70 px-4 py-3">
        {showHybridWarning ? (
          <p className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs font-medium text-rose-950">
            Hybrid typography generation failed — fallback overlay active
          </p>
        ) : null}

        {snap.liveVsCardMismatch ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50/90 px-2.5 py-2 text-xs text-rose-900">
            {snap.staleSceneWarning}
          </p>
        ) : snap.staleSceneWarning ? (
          <p className="rounded-lg border border-amber-200 bg-amber-100/60 px-2.5 py-2 text-xs text-amber-950">
            {snap.staleSceneWarning}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <DebugRow label="renderMode (card)" value={snap.renderMode} />
          <DebugRow
            label="effectiveRenderMode"
            value={layoutDebug?.effectiveRenderMode ?? snap.renderMode}
          />
          <DebugRow
            label="usedLayout"
            value={layoutDebug?.usedLayout ?? '—'}
          />
          <DebugRow
            label="frontendMiddleOverlayHidden"
            value={
              layoutDebug
                ? String(layoutDebug.frontendMiddleOverlayHidden)
                : '—'
            }
          />
          <DebugRow label="hybridEnabled" value={snap.hybridEnabled} />
          <DebugRow label="usedPromptType" value={snap.usedPromptType} />
          <DebugRow label="imageProvider" value={snap.imageProvider} />
          <DebugRow
            label="sceneImageUrl"
            value={
              layoutDebug?.sceneImageUrl == null
                ? 'null'
                : String(layoutDebug.sceneImageUrl || snap.sceneImageUrl || '—')
            }
          />
          <DebugRow
            label="sceneImageStatus"
            value={layoutDebug?.sceneImageStatus ?? snap.sceneImageStatus}
          />
          <DebugRow label="mockSceneImage" value={snap.mockSceneImage} />
          <DebugRow
            label="hybridTextFallback"
            value={
              hybridTextFallback
                ? 'true (active overlay fallback)'
                : snap.hybridTextFallback
            }
          />
          <DebugRow label="promptLength" value={snap.promptLength} />
          <DebugRow label="promptTruncated (>4000)" value={snap.promptTruncated} />
          <DebugRow label="hybridPromptMarkersOk" value={snap.hybridPromptMarkersOk} />
          <DebugRow label="hybridPromptMarkersMissing" value={snap.hybridPromptMarkersMissing} />
          <DebugRow label="hybridOcrProbe" value={snap.hybridOcrProbe} />
          <DebugRow label="data-mirror-poster" value={snap.posterVersion} />
          <DebugRow label="hybrid env" value={snap.hybridEnvDebug} />
          <DebugRow label="selected primary intent (live)" value={snap.selectedPrimaryIntent} />
          <DebugRow label="lockedIntent (live)" value={snap.lockedIntent} />
          <DebugRow label="sceneIntentLabel (card)" value={snap.sceneIntentLabel} />
          <DebugRow label="intent fingerprint (live)" value={snap.intentFingerprint} />
          <DebugRow label="intent fingerprint (card)" value={snap.cardIntentFingerprint} />
          <DebugRow label="poster palette" value={snap.posterPalette} />
        </div>

        <DebugBlock label="promptPreview (first 800)" value={snap.promptPreview} />
        <DebugBlock label="visual.prompt (first 800 legacy)" value={snap.visualPromptPreview} />

        <div className="flex flex-col gap-2 sm:flex-row">
          {onToggleHybridMode ? (
            <button
              type="button"
              onClick={onToggleHybridMode}
              className="flex-1 rounded-lg border border-amber-400 bg-amber-100/90 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-200/80"
            >
              Toggle hybrid ({resolveMirrorRenderMode() === 'hybrid_middle' ? 'ON' : 'OFF'})
            </button>
          ) : null}
          {onForceBmwMercedes ? (
            <button
              type="button"
              onClick={onForceBmwMercedes}
              className="flex-1 rounded-lg border border-violet-300 bg-violet-100/80 px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-200/80"
            >
              Force BMW/Mercedes Intent
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}
