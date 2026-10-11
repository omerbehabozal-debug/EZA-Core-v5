'use client';

import { Play } from 'lucide-react';
import { parsePublicFrozenJourneyArtifact, type PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

/** One invitation for the existing Reel depth handler; no replay state. */
export default function YansiReelExperienceInvite({ artifact, onOpenChat }: {
  artifact: PublicFrozenJourneyArtifact;
  onOpenChat?: () => void;
}) {
  const replay = parsePublicFrozenJourneyArtifact(artifact);
  return <div className="yansi-reel-experience-invite" data-testid="yansi-reel-experience-invite">
    <button type="button" className="yansi-reel-experience-invite__button"
      disabled={!replay || !onOpenChat} aria-busy={!replay || undefined}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onOpenChat?.(); }}>
      <Play size={16} aria-hidden="true" strokeWidth={1.7} />
      <span>{replay ? 'Deneyime Başla' : 'Deneyim hazırlanıyor…'}</span>
    </button>
    {replay ? <span className="yansi-reel-experience-invite__steps">{replay.steps.length} adımlık deneyim</span> : null}
  </div>;
}
