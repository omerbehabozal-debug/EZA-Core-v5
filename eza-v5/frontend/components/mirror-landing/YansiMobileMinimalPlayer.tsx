'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useYansiExperienceSession } from '@/components/mirror-landing/YansiExperienceSession';
import { YANSI_RHYTHM_LABELS } from '@/lib/eza/mirror/yansiRhythm';

/**
 * Compact listening chip while speech is active — sits above composer area.
 */
export default function YansiMobileMinimalPlayer({
  onOpenSheet,
}: {
  onOpenSheet: () => void;
}) {
  const session = useYansiExperienceSession();
  if (!session?.audioOn || !session.speechSupported) return null;

  return (
    <div className="yansi-mobile-minimal-player" data-testid="yansi-mobile-minimal-player">
      <button
        type="button"
        className="yansi-mobile-minimal-player__pause"
        aria-label="Dinlemeyi durdur"
        data-testid="yansi-mobile-minimal-player-pause"
        onClick={() => session.setAudioOn(false)}
      >
        <VolumeX size={14} aria-hidden />
      </button>
      <button
        type="button"
        className="yansi-mobile-minimal-player__meta"
        onClick={onOpenSheet}
        aria-label="Ses ayarlarını aç"
      >
        <Volume2 size={14} aria-hidden />
        <span>{YANSI_RHYTHM_LABELS[session.rhythm]}</span>
      </button>
      <button
        type="button"
        className="yansi-mobile-minimal-player__close"
        aria-label="Kapat"
        data-testid="yansi-mobile-minimal-player-close"
        onClick={() => session.setAudioOn(false)}
      >
        ×
      </button>
    </div>
  );
}
