'use client';

import SainaCinematicScene from './SainaCinematicScene';

/** Layout-level scene — never remounts on chat ↔ pattern navigation. */
export default function SainaPersistentScene() {
  return (
    <div className="saina-persistent-scene" aria-hidden data-testid="saina-persistent-scene">
      <SainaCinematicScene />
    </div>
  );
}
