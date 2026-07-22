'use client';

import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import SainaCinematicScene from './SainaCinematicScene';

/** Shared route-level scene — reads active conversation visual identity from chrome store. */
export default function SainaPersistentScene() {
  const conversationSceneUrl = useSainaChromeStore((s) => s.conversationSceneUrl);
  const focalX = useSainaChromeStore((s) => s.conversationSceneFocalX);
  const focalY = useSainaChromeStore((s) => s.conversationSceneFocalY);
  return (
    <SainaCinematicScene
      sceneImageUrl={conversationSceneUrl}
      focalX={focalX}
      focalY={focalY}
    />
  );
}
