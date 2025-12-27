/**
 * Help Modal Component
 * 
 * "Paneli Nasıl Okumalıyım?" modal
 * Static content only, no tracking or persistence
 */

'use client';

import { useState } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Paneli Nasıl Okumalıyım?
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Kapat"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-gray-700">
          <p>
            Bu panel sistem davranışlarını gözlemlemek için tasarlanmıştır.
          </p>
          <p>
            İçerik, prompt veya çıktı göstermez.
          </p>
          <p>
            Editoryal karar veya müdahale imkânı sunmaz.
          </p>
          <p>
            Gösterilen veriler süreç ve risk meta verileridir.
          </p>
          <p>
            Regülatör bu paneldeki verilerden editoryal sorumluluk üstlenmez.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-regulator-primary text-white rounded hover:bg-regulator-secondary transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

