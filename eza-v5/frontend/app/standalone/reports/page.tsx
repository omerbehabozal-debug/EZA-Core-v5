'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import StandalonePageShell from '@/components/standalone/StandalonePageShell';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  readBehavioralHistory,
  clearBehavioralHistory,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';
import { buildInteractionInsight } from '@/lib/eza/behavioralInsights';

export default function StandaloneReportsPage() {
  const [items, setItems] = useState<SavedBehavioralEntry[]>([]);

  useEffect(() => {
    setItems(readBehavioralHistory());
  }, []);

  const handleClear = () => {
    clearBehavioralHistory();
    setItems([]);
  };

  return (
    <div className={standaloneSkin.page}>
      <StandalonePageShell>
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
          <header className="mb-6 border-b border-standalone-border/50 pb-4">
            <Link
              href="/standalone"
              className="text-sm font-medium text-standalone-primary hover:underline"
            >
              ← Sohbete dön
            </Link>
            <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-standalone-text sm:text-2xl">
              Etkileşim Raporu
            </h1>
            <p className="mt-1 text-base leading-relaxed text-standalone-text-secondary">
              Her yanıttan sonra oluşan etkileşim analizleri. Mesaj metni saklanmaz; yalnızca sayısal
              özetler listelenir.
            </p>
            <button
              type="button"
              onClick={handleClear}
              disabled={items.length === 0}
              className="mt-3 flex items-center gap-1.5 text-sm text-red-600/90 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Tümünü temizle
            </button>
          </header>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-standalone-border/70 bg-white/50 px-6 py-10 text-center text-base text-standalone-text-muted">
              Henüz analiz yok. Sohbette bir yanıt aldıktan sonra raporlar burada görünür.
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((row, i) => {
                const insight = buildInteractionInsight(row, row.vector.eza_final ?? undefined);
                return (
                  <li
                    key={`${row.interaction_id}-${row.savedAt}-${i}`}
                    className="rounded-xl border border-standalone-border/60 bg-white/80 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-standalone-text-muted">
                      <time dateTime={row.savedAt}>
                        {new Date(row.savedAt).toLocaleString('tr-TR')}
                      </time>
                      {insight.score !== null ? (
                        <span className="font-medium text-standalone-text">
                          EZA {insight.score}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-base font-medium text-standalone-text">{insight.title}</p>
                    <ul className="mt-2 space-y-1">
                      {insight.bullets.map((b, j) => (
                        <li
                          key={j}
                          className={`text-sm leading-snug ${
                            b.tone === 'positive'
                              ? 'text-emerald-700'
                              : b.tone === 'caution'
                                ? 'text-amber-800'
                                : 'text-standalone-text-secondary'
                          }`}
                        >
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </StandalonePageShell>
    </div>
  );
}
