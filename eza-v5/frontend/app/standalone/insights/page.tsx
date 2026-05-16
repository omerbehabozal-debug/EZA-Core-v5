'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  readBehavioralHistory,
  clearBehavioralHistory,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';

export default function StandaloneInsightsPage() {
  const [items, setItems] = useState<SavedBehavioralEntry[]>([]);

  useEffect(() => {
    setItems(readBehavioralHistory());
  }, []);

  const handleClear = () => {
    clearBehavioralHistory();
    setItems([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur safe-area-top">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/standalone"
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            Sohbet
          </Link>
          <h1 className="text-sm sm:text-base font-semibold text-gray-900 truncate text-center flex-1">
            Davranış geçmişi
          </h1>
          <button
            type="button"
            onClick={handleClear}
            disabled={items.length === 0}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Temizle
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 pb-10">
        <p className="text-xs sm:text-sm text-gray-600 mb-2">
          Bu sayfa yalnızca bu tarayıcıda tutulan <strong>sayısal</strong> etkileşim özetlerini listeler (mesaj metni
          saklanmaz). Backend’deki <code className="bg-gray-100 px-1 rounded">behavioral</code> alanıyla uyumludur.
        </p>
        <p className="text-xs sm:text-sm mb-4">
          <Link
            href="/governance/me"
            className="font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
          >
            Tam geçmiş için Governance → Me
          </Link>
          <span className="text-gray-500"> (giriş gerekir)</span>
        </p>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Henüz kayıt yok. Standalone sohbetinde bir yanıt aldıktan sonra buraya dönün.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((row, i) => (
              <li
                key={`${row.interaction_id}-${row.savedAt}-${i}`}
                className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm text-xs sm:text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2 text-gray-500 text-[10px] sm:text-xs mb-2">
                  <time dateTime={row.savedAt}>{new Date(row.savedAt).toLocaleString()}</time>
                  <span className="font-mono truncate max-w-[60%]">{row.interaction_id}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-800">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase tracking-wide">Asimetri</span>
                    {row.asymmetry.index}
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase tracking-wide">Health gap</span>
                    {row.asymmetry.health_gap}
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase tracking-wide">EZA</span>
                    {row.vector.eza_final ?? '—'}
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase tracking-wide">Hizalama</span>
                    {row.vector.alignment_score ?? '—'}
                  </div>
                </div>
                <div className="mt-2 text-[10px] sm:text-xs text-gray-600 font-mono break-all">
                  in_risk {row.vector.input_risk} · out_risk {row.vector.output_risk} · intent {row.vector.intent}
                  {row.vector.redirect ? ' · redirect' : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
