/**
 * RTÜK Reading Guide Component
 * 
 * Persistent, collapsible info panel explaining how to read the RTÜK panel.
 * Default: open on Dashboard, collapsed elsewhere.
 */

'use client';

import { useState } from 'react';

interface RTUKReadingGuideProps {
  defaultOpen?: boolean;
}

export function RTUKReadingGuide({ defaultOpen = false }: RTUKReadingGuideProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-4 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center space-x-2">
          <svg
            className="h-5 w-5 text-blue-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-sm font-semibold text-blue-900">
            RTÜK Medya Gözetim Paneli Nasıl Okunmalıdır?
          </h3>
        </div>
        <svg
          className={`h-5 w-5 text-blue-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-4 text-sm text-blue-900 leading-relaxed space-y-3">
          <p>
            Bu panel bir yaptırım veya sansür aracı değildir.
          </p>
          <p>
            Bu panel, RTÜK'ün görev alanına giren medya organizasyonlarının
            yapay zekâ destekli içerik üretim süreçlerindeki etik davranış desenlerini
            gözlemlemek amacıyla tasarlanmıştır.
          </p>
          <p>
            Burada görülen veriler:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>içerik göstermez</li>
            <li>editoryal karar üretmez</li>
            <li>otomatik ceza veya uyarı oluşturmaz</li>
          </ul>
          <p>
            Riskler, tekil olaylar üzerinden değil,
            zaman içindeki tekrarlar ve davranış eğilimleri üzerinden anlam kazanır.
          </p>
        </div>
      )}
    </div>
  );
}

