'use client';

import SainaCinematicScene from './SainaCinematicScene';

/** Scene inside the main canvas — persists across chat ↔ pattern; clipped by the app frame. */
export default function SainaPersistentScene() {
  return (
    <div className="saina-persistent-scene" aria-hidden data-testid="saina-persistent-scene">
      <SainaCinematicScene />
    </div>
  );
}
