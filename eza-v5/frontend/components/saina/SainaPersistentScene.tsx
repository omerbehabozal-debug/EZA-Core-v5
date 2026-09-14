'use client';

import { usePathname } from 'next/navigation';
import { resolveSainaAppView } from '@/lib/eza/sainaRoutes';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import { resolveChromeDisplaySceneUrl } from '@/lib/eza/mirror/journey/resolveSelectedYansiDisplayScene';
import SainaCinematicScene from './SainaCinematicScene';

/** Shared route-level scene — chat uses conversation identity; Keşfet/EZA stay locked. */
export default function SainaPersistentScene() {
  const pathname = usePathname();
  const view = resolveSainaAppView(pathname);
  const conversationSceneUrl = useSainaChromeStore((s) => s.conversationSceneUrl);
  const selectedYansiSceneUrl = useSainaChromeStore((s) => s.selectedYansiSceneUrl);
  const focalX = useSainaChromeStore((s) => s.conversationSceneFocalX);
  const focalY = useSainaChromeStore((s) => s.conversationSceneFocalY);

  if (view === 'discover' || view === 'pattern') {
    return <SainaCinematicScene atmosphere="analysis" />;
  }

  const displaySceneUrl = resolveChromeDisplaySceneUrl(
    conversationSceneUrl,
    selectedYansiSceneUrl
  );

  return (
    <SainaCinematicScene
      sceneImageUrl={displaySceneUrl}
      focalX={focalX}
      focalY={focalY}
    />
  );
}
