'use client';

import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import { isMirrorDevToolsEnabled } from '@/lib/eza/mirror/devTools';

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p className="text-xs text-stone-700">{value || '—'}</p>
    </div>
  );
}

function DebugBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <pre className="max-h-40 overflow-auto rounded-lg border border-stone-200/80 bg-stone-50/90 p-2.5 text-[11px] leading-relaxed text-stone-600 whitespace-pre-wrap break-words">
        {value || '—'}
      </pre>
    </div>
  );
}

export type MirrorVisualPromptDebugProps = {
  visual?: MirrorVisualPromptPayload;
};

/**
 * Development-only collapsible panel for Sprint 6 visual prompt QA.
 * Not rendered in production builds.
 */
export default function MirrorVisualPromptDebug({ visual }: MirrorVisualPromptDebugProps) {
  if (!isMirrorDevToolsEnabled()) {
    return null;
  }

  return (
    <details className="mt-4 rounded-xl border border-dashed border-amber-200/80 bg-amber-50/40 text-left">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-amber-900/90 marker:content-none [&::-webkit-details-marker]:hidden">
        Visual Prompt Debug
        <span className="ml-2 font-normal text-amber-800/70">(dev only)</span>
      </summary>
      <div className="space-y-3 border-t border-amber-200/60 px-4 py-3">
        {!visual ? (
          <p className="text-xs text-stone-500">No visual payload on this card.</p>
        ) : (
          <>
            <DebugRow label="topic" value={visual.topicLabel} />
            <DebugRow label="atmosphere" value={visual.atmosphereLabel} />
            <DebugRow label="emotion" value={visual.emotionLabel} />
            <DebugRow label="seed" value={visual.seedHint} />
            <DebugRow label="style" value={visual.stylePreset} />
            <DebugRow
              label="qualityHints"
              value={visual.qualityHints?.length ? visual.qualityHints.join(' · ') : '—'}
            />
            <DebugRow label="character" value={`${visual.characterName} (${visual.characterId})`} />
            <DebugRow label="sceneImageUrl" value={visual.sceneImageUrl ?? '—'} />
            <DebugRow label="sceneImageStatus" value={visual.sceneImageStatus ?? '—'} />
            <DebugBlock label="prompt" value={visual.prompt} />
            <DebugBlock label="negativePrompt" value={visual.negativePrompt} />
          </>
        )}
      </div>
    </details>
  );
}
