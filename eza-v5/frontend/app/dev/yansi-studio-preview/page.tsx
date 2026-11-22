'use client';

/**
 * QA-only visual harness for YansiStudioDraftPreview (Stage 03C.1).
 * Loads the same Business/public CSS + shell classes as production Studio.
 * Uses public fixtures — no auth, no paid AI. Not a production route.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import YansiStudioDraftPreview from '@/components/saina/business-studio/YansiStudioDraftPreview';
import type { YansiV2ConversationPreview } from '@/lib/eza/yansiV2ConversationCreate';
import '@/styles/saina-mirror.css';
import '@/styles/saina-yansi-desktop.css';
import '@/styles/yansi-reel-responsive.css';
import '@/styles/saina-my-page.css';
import '@/styles/saina-business.css';

const COVER = '/mirror/dev-italy-scene.jpg';
/** Landscape-friendly fixture so letterboxing matches brand covers more closely. */
const TURN_MEDIA = '/mirror/dev-italy-scene.jpg';

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export default function DevYansiStudioPreviewPage() {
  const [blocked, setBlocked] = useState(false);
  const [tab, setTab] = useState<'discover' | 'experience'>('discover');

  useEffect(() => {
    const isDevEnv = process.env.NODE_ENV === 'development';
    const isLocal = isLocalDevHost(window.location.hostname);
    setBlocked(!isDevEnv && !isLocal);
  }, []);

  const preview = useMemo<YansiV2ConversationPreview>(
    () => ({
      title: 'İtalya sabah fırını',
      summary: 'AI önerisi taslağı — fixture',
      curiosityQuestion: 'Fırın neden şafakta açılır?',
      turnCount: 2,
      turns: [
        {
          stepIndex: 1,
          question: 'Fırın neden şafakta açılır?',
          answer:
            'Hamur gece dinlenir; sabah ısı, kabuk ve aroma için en doğru zamandır. Atölye notlarına göre fırın şafakla birlikte yakılır.',
          mediaTitle: null,
        },
        {
          stepIndex: 2,
          question: 'Misafire hangi ekmek önerilir?',
          answer:
            'İlk gün için ince kabuklu köy ekmeği önerilir. Tarif görseli sohbet içinde yer alır.',
          mediaTitle: 'Tarif görseli',
        },
      ],
      coverTitle: 'İtalya sahne',
      linkedKnowledge: [
        {
          id: 'kv-1',
          title: 'Fırın işletme notu',
          category: 'ürün',
          aiReady: true,
          aiStatusLabel: 'AI + görünür',
          publicAllowed: true,
          revision: 1,
          status: 'published',
        },
      ],
      knowledgeNotes: [],
      mediaOptional: true,
    }),
    [],
  );

  if (blocked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Bu QA sayfası yalnızca local development host’ta açıktır.</p>
        <Link href="/standalone/business">Business’a dön</Link>
      </main>
    );
  }

  return (
    <div
      className="saina-page saina-app-root saina-standalone-shell saina-business-shell"
      data-saina-view="business"
      data-testid="dev-yansi-studio-css-shell"
    >
      <main
        className="biz-panel"
        data-testid="dev-yansi-studio-preview"
        style={{
          minHeight: '100vh',
          padding: '24px 20px 48px',
          background: 'linear-gradient(165deg, #12100e 0%, #1a1612 45%, #0e0c0a 100%)',
          color: '#f5ead8',
        }}
      >
        <p className="biz-studio-eyebrow">QA · Aşama 03C.1 · ücretsiz fixture</p>
        <h1 className="biz-section-title" style={{ marginTop: 8 }}>
          Yansı Studio önizleme — public hizalama
        </h1>
        <p className="biz-section-lead" style={{ maxWidth: 640 }}>
          Business/public CSS bağlamı (`saina-mirror`, `saina-yansi-desktop`, reel) + shell sınıfları.
          Kapak: <code>dev-italy-scene.jpg</code>.
        </p>

        <section
          data-testid="dev-yansi-studio-shell"
          style={{
            marginTop: 28,
            border: '1px solid rgba(201,162,39,0.35)',
            borderRadius: 16,
            padding: 20,
            maxWidth: 1100,
          }}
        >
          <div className="biz-studio-hero">
            <p className="biz-studio-eyebrow">Yansı Stüdyosu</p>
            <h2 className="biz-section-title">Yansı Oluştur</h2>
            <p className="biz-section-lead">
              Masaüstü genel görünüm (fixture kabuğu) · AI taslağı kapaklı
            </p>
          </div>
          <nav className="biz-conv-flow-rail" aria-label="Oluşturma adımları">
            <span className="biz-conv-flow-step is-done">
              <span className="biz-conv-flow-index">1</span> İçeriğini Seç
            </span>
            <span className="biz-conv-flow-step is-done">
              <span className="biz-conv-flow-index">2</span> AI ile Oluştur
            </span>
            <span className="biz-conv-flow-step is-active">
              <span className="biz-conv-flow-index">3</span> İncele ve Yayınla
            </span>
          </nav>

          <div className="biz-conv-preview-tabs" role="tablist" style={{ marginTop: 16 }}>
            <button
              type="button"
              className={`biz-conv-preview-tab${tab === 'discover' ? ' is-active' : ''}`}
              data-testid="dev-preview-tab-discover"
              onClick={() => setTab('discover')}
            >
              Keşfet
            </button>
            <button
              type="button"
              className={`biz-conv-preview-tab${tab === 'experience' ? ' is-active' : ''}`}
              data-testid="dev-preview-tab-experience"
              onClick={() => setTab('experience')}
            >
              Deneyimle
            </button>
          </div>

          <div data-testid="dev-preview-stage" style={{ marginTop: 12 }}>
            <YansiStudioDraftPreview
              mode={tab}
              businessId="00000000-0000-0000-0000-000000000001"
              brandName="Kiln Atölyesi"
              preview={preview}
              coverAssetId={null}
              turnMediaAssetIds={[null, 'fixture-media-2']}
              fixtureCoverUrl={COVER}
              fixtureTurnMediaUrls={[null, TURN_MEDIA]}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
