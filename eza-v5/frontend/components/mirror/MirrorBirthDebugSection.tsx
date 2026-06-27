'use client';

import { useEffect, useState } from 'react';
import {
  getMirrorBirthDebugState,
  subscribeMirrorBirthDebug,
} from '@/lib/eza/mirror-birth/mirrorBirthDebugState';

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

export default function MirrorBirthDebugSection() {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeMirrorBirthDebug(() => setTick((value) => value + 1)), []);

  const evaluation = getMirrorBirthDebugState();
  void tick;

  if (!evaluation) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-200/70 bg-white/70 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-950/80">
          Mirror Birth
        </p>
        <DebugRow label="Status" value="Not Ready" />
        <DebugRow label="Reason" value="Need more conversation" />
      </div>
    );
  }

  const { reasons, summary, detailLines, userMessageCount, assistantMessageCount } = evaluation;

  return (
    <div className="space-y-2 rounded-lg border border-amber-200/70 bg-white/70 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-950/80">
        Mirror Birth
      </p>
      <DebugRow label="Ready" value={evaluation.ready ? '✓' : '—'} />
      <DebugRow label="Reason" value={summary} />
      <DebugRow
        label="Counts"
        value={`user ${userMessageCount} · assistant ${assistantMessageCount}`}
      />
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">
          Checks
        </p>
        <ul className="space-y-0.5 text-xs text-stone-700">
          <li>{reasons.minUserMessages ? '✓' : '·'} Minimum messages reached</li>
          <li>{reasons.minAssistantMessages ? '✓' : '·'} Assistant responses sufficient</li>
          <li>{reasons.lastMessageAssistant ? '✓' : '·'} Last message assistant</li>
          <li>{reasons.notStreaming ? '✓' : '·'} Streaming idle</li>
          <li>{reasons.topicStable ? '✓' : '·'} Topic stable</li>
          <li>{reasons.safetyPassed ? '✓' : '·'} Safety passed</li>
          <li>{reasons.recommendationNotShownBefore ? '✓' : '·'} Recommendation not shown before</li>
          <li>{reasons.notDismissed ? '✓' : '·'} Not dismissed</li>
          <li>{reasons.mirrorNotCreated ? '✓' : '·'} Mirror not created</li>
          <li>{reasons.inactivityElapsed ? '✓' : '·'} Editorial pause elapsed</li>
        </ul>
      </div>
      {detailLines.length ? (
        <pre className="max-h-28 overflow-auto rounded-lg border border-amber-200/70 bg-white/80 p-2 text-[11px] leading-relaxed text-stone-700 whitespace-pre-wrap">
          {detailLines.join('\n')}
        </pre>
      ) : null}
    </div>
  );
}
