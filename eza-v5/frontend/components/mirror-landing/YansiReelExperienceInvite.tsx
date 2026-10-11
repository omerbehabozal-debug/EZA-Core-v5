'use client';

import { loadFrozenReplayProgress } from '@/lib/eza/mirror/journey/frozenReplaySession';
import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { parsePublicFrozenJourneyArtifact, type PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

/** One invitation for the existing Reel depth handler; no replay state. */
export default function YansiReelExperienceInvite({ artifact, onOpenChat }: {
  artifact: PublicFrozenJourneyArtifact;
  onOpenChat?: () => void;
}) {
  const replay = parsePublicFrozenJourneyArtifact(artifact);
  const [completedIdentity, setCompletedIdentity] = useState<string | null>(null);
  const identity = replay ? `${replay.slug}:${replay.journeyVersion}:${replay.steps.length}` : null;
  useEffect(() => {
    const history = replay ? loadFrozenReplayProgress(replay.slug, replay.journeyVersion) : null;
    setCompletedIdentity(replay && history?.historicalCompletedStepCount === replay.steps.length ? identity : null);
  }, [artifact, identity]);
  const previouslyCompleted = identity !== null && completedIdentity === identity;
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
