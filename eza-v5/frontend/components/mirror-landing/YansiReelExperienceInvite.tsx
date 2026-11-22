'use client';

import { loadFrozenReplayProgress } from '@/lib/eza/mirror/journey/frozenReplaySession';
import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { parsePublicFrozenJourneyArtifact, type PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

/** V1 artifacts re-validate via 6–8 parser; V2 mapped artifacts skip that gate. */
function resolveInviteArtifact(
  artifact: PublicFrozenJourneyArtifact
): PublicFrozenJourneyArtifact | null {
  if (artifact.sourceKind === 'v2_publication') {
    if (artifact.replayReady !== true) return null;
    if (artifact.contentKind === 'image') return artifact;
    if (artifact.steps.length < 1 || artifact.steps.length > 8) return null;
    return artifact;
  }
  return parsePublicFrozenJourneyArtifact(artifact);
}

/** One invitation for the existing Reel depth handler; no replay state. */
export default function YansiReelExperienceInvite({ artifact, onOpenChat }: {
  artifact: PublicFrozenJourneyArtifact;
  onOpenChat?: () => void;
}) {
  const replay = resolveInviteArtifact(artifact);
  const isImageOnly = replay?.contentKind === 'image' || (replay != null && replay.steps.length === 0);
  const canLiveContinue = replay?.liveContinuationAvailable !== false;
  const [completedIdentity, setCompletedIdentity] = useState<string | null>(null);
  const identity = replay ? `${replay.slug}:${replay.journeyVersion}:${replay.steps.length}` : null;
  useEffect(() => {
    const history = replay ? loadFrozenReplayProgress(replay.slug, replay.journeyVersion) : null;
    setCompletedIdentity(replay && history?.historicalCompletedStepCount === replay.steps.length ? identity : null);
  }, [artifact, identity, replay]);
  const previouslyCompleted = identity !== null && completedIdentity === identity;
  // Image-only V2 with live continuation: open chat depth for in-place /answer (no fake Q/A).
  if (isImageOnly) {
    if (!canLiveContinue) {
      return (
        <div
          className="yansi-reel-experience-invite"
          data-testid="yansi-reel-experience-invite"
          data-yansi-content-kind="image"
        >
          <span className="yansi-reel-experience-invite__steps">Görsel Yansı</span>
        </div>
      );
    }
    return (
      <div
        className="yansi-reel-experience-invite"
        data-testid="yansi-reel-experience-invite"
        data-yansi-content-kind="image"
      >
        <button
          type="button"
          className="yansi-reel-experience-invite__button"
          disabled={!onOpenChat}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenChat?.();
          }}
        >
          <Play size={16} aria-hidden="true" strokeWidth={1.7} />
          <span>Soru sor</span>
        </button>
        <span className="yansi-reel-experience-invite__steps">Görsel Yansı</span>
      </div>
    );
  }
  return <div className="yansi-reel-experience-invite" data-testid="yansi-reel-experience-invite">
    <button type="button" className="yansi-reel-experience-invite__button"
      disabled={!replay || !onOpenChat} aria-busy={!replay || undefined}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onOpenChat?.(); }}>
      <Play size={16} aria-hidden="true" strokeWidth={1.7} />
      <span>{replay ? (previouslyCompleted ? 'Yeniden Deneyimle' : 'Deneyime Başla') : 'Deneyim hazırlanıyor…'}</span>
    </button>
    {replay ? <span className="yansi-reel-experience-invite__steps">{replay.steps.length} soruluk sohbet</span> : null}
  </div>;
}
