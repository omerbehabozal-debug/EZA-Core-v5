'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DailyMirrorPosterCard from '@/components/mirror/DailyMirrorPosterCard';
import MirrorSceneGenerateButton from '@/components/mirror/MirrorSceneGenerateButton';
import { useAuth } from '@/context/AuthContext';
import {
  DEV_ITALY_DEMO_SCENE_URL,
  buildDevItalyPosterCard,
} from '@/lib/eza/mirror/devPosterFixtures';
import { generateMirrorScene, MirrorSceneError } from '@/lib/eza/mirror/generateSceneApi';
import { mergeDailyCardSceneVisual } from '@/lib/eza/mirror/mirrorSceneImage';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Varsayılan açık (localhost/dev); yalnızca prod + uzak host’ta kapat. */
function useDevMirrorPosterBlocked(): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const isDevEnv = process.env.NODE_ENV === 'development';
    const isLocal = isLocalDevHost(window.location.hostname);
    setBlocked(!isDevEnv && !isLocal);
  }, []);

  return blocked;
}

export default function DevMirrorPosterPage() {
  const devBlocked = useDevMirrorPosterBlocked();
  const { isAuthenticated } = useAuth();
  const { card: baseCard, meta } = useMemo(() => buildDevItalyPosterCard(), []);

  const [sceneUrl, setSceneUrl] = useState<string | null>(
    () => baseCard.visual?.sceneImageUrl ?? DEV_ITALY_DEMO_SCENE_URL
  );
  const [sceneStatus, setSceneStatus] = useState<MirrorSceneImageStatus>(
    () => baseCard.visual?.sceneImageStatus ?? 'ready'
  );
  const [sceneError, setSceneError] = useState<string | null>(null);

  const cardForRender = useMemo(
    () => mergeDailyCardSceneVisual(baseCard, sceneUrl, sceneStatus),
    [baseCard, sceneUrl, sceneStatus]
  );

  const handleGenerate = useCallback(async () => {
    const visual = baseCard.visual;
    if (!visual?.prompt?.trim()) {
      setSceneError('Görsel prompt boş — mirror state kontrol edin.');
      setSceneStatus('error');
      return;
    }
    if (sceneStatus === 'generating') return;

    setSceneStatus('generating');
    setSceneUrl(null);
    setSceneError(null);

    try {
      const result = await generateMirrorScene(visual, baseCard.date);
      setSceneUrl(result.sceneImageUrl);
      setSceneStatus('ready');
    } catch (err) {
      setSceneStatus('error');
      if (err instanceof MirrorSceneError && err.code === 'auth_required') {
        setSceneError('Sahne için giriş gerekli.');
      } else {
        setSceneError(err instanceof Error ? err.message : 'Sahne üretilemedi.');
      }
    }
  }, [baseCard, sceneStatus]);

  if (devBlocked) {
    return (
      <p className="p-8 text-sm text-stone-600">
        Bu sayfa yalnızca development veya localhost üzerinde kullanılabilir. Yerelde{' '}
        <code className="text-xs">npm run dev</code> çalıştırın.
      </p>
    );
  }

  const promptPreview = baseCard.visual?.prompt?.slice(0, 120) ?? '';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0c0a12] px-4 py-10">
      <p className="text-center text-xs font-medium uppercase tracking-widest text-white/45">
        Dev — İtalya poster (demo sahne)
      </p>

      <p className="max-w-md text-center text-[10px] text-white/40">
        Demo sahne yüklü (warm gold tone). OpenAI sahne için{' '}
        {isAuthenticated ? (
          'alttaki düğmeyi kullanın.'
        ) : (
          <>
            <Link href="/platform/login?return=%2Fdev%2Fmirror-poster" className="text-amber-200/80 underline">
              giriş
            </Link>{' '}
            + backend :8000.
          </>
        )}
      </p>

      {sceneError ? (
        <p className="max-w-md text-center text-xs text-rose-300/90" role="alert">
          {sceneError}
        </p>
      ) : null}

      <div className="w-full max-w-[28rem]">
        <DailyMirrorPosterCard card={cardForRender} meta={meta} entries={[]} />
      </div>

      <MirrorSceneGenerateButton
        status={sceneStatus}
        onGenerate={() => void handleGenerate()}
        disabled={!isAuthenticated || !baseCard.visual?.prompt}
      />

      {promptPreview ? (
        <p className="max-w-md text-center text-[10px] leading-snug text-white/35">
          Prompt: {promptPreview}…
        </p>
      ) : null}
    </main>
  );
}
