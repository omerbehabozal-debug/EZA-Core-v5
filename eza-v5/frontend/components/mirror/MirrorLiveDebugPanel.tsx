'use client';

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import { buildMirrorIntentDebugSnapshot } from '@/lib/eza/mirror/mirrorIntentContext';
import { isMirrorDevToolsEnabled } from '@/lib/eza/mirror/devTools';

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
  onForceBmwMercedes?: () => void;
};

/**
 * Sprint 12B live intent debug — development only.
 */
export default function MirrorLiveDebugPanel({
  card,
  entries,
  meta,
  posterVersion = 'v8b-intent-lock',
  onForceBmwMercedes,
}: MirrorLiveDebugPanelProps) {
  if (!isMirrorDevToolsEnabled()) {
    return null;
  }

  const snap = buildMirrorIntentDebugSnapshot({
    card,
    entries,
    meta,
    posterVersion,
  });

  return (
    <details className="mt-4 w-full rounded-xl border border-dashed border-amber-300/90 bg-amber-50/50 text-left">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-amber-950 marker:content-none [&::-webkit-details-marker]:hidden">
        Mirror Live Debug (12B)
        <span className="ml-2 font-normal text-amber-800/80">dev only</span>
      </summary>
      <div className="space-y-3 border-t border-amber-200/70 px-4 py-3">
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
          <DebugRow label="selected primary intent (live)" value={snap.selectedPrimaryIntent} />
          <DebugRow label="lockedIntent (live)" value={snap.lockedIntent} />
          <DebugRow label="sceneIntentLabel (card)" value={snap.sceneIntentLabel} />
          <DebugRow label="storyVariant" value={snap.storyVariant} />
          <DebugRow label="microMood" value={snap.microMood} />
          <DebugRow label="reflectionTone" value={snap.reflectionTone} />
          <DebugRow label="contextualHighlight.kind" value={snap.contextualHighlightKind} />
          <DebugRow label="left label" value={snap.contextualHighlightLeft} />
          <DebugRow label="right label" value={snap.contextualHighlightRight} />
          <DebugRow label="data-mirror-poster" value={snap.posterVersion} />
          <DebugRow label="card date / id" value={`${snap.cardDate} · ${snap.cardId}`} />
          <DebugRow label="entries count" value={String(snap.entriesCount)} />
          <DebugRow label="seedHint" value={snap.seedHint} />
          <DebugRow label="intent fingerprint (live)" value={snap.intentFingerprint} />
          <DebugRow label="intent fingerprint (card)" value={snap.cardIntentFingerprint} />
          <DebugRow label="sceneImageStatus" value={snap.sceneImageStatus} />
          <DebugRow label="sceneImageUrl" value={snap.sceneImageUrl} />
          <DebugRow label="vehicle labels (live)" value={snap.detectedVehicleLabels} />
        </div>

        <DebugBlock label="conversation cue blob (live, 400ch)" value={snap.conversationCueBlob} />
        <DebugBlock label="forbidden phrases" value={snap.forbiddenPhrases} />
        <DebugBlock label="visual.prompt (first 800)" value={snap.visualPromptPreview} />

        {onForceBmwMercedes ? (
          <button
            type="button"
            onClick={onForceBmwMercedes}
            className="w-full rounded-lg border border-violet-300 bg-violet-100/80 px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-200/80"
          >
            Force BMW/Mercedes Intent
          </button>
        ) : null}
      </div>
    </details>
  );
}
