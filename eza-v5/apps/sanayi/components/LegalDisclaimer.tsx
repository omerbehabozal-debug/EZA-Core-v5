/**
 * Sanayi Bakanlığı Legal Disclaimer Banner
 * 
 * MANDATORY: Must be displayed on all Sanayi panel pages.
 */

'use client';

export function LegalDisclaimer() {
  return (
    <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-green-900 leading-relaxed">
            <strong>Sanayi ve Teknoloji Bakanlığı Gözetim Bildirimi:</strong> Bu panel bir yaptırım veya sansür mekanizması değildir.
            <br />
            Sanayi ve Teknoloji Bakanlığı bu paneli
            teknoloji politikası ve ekosistem gözetimi amacıyla kullanır.
          </p>
        </div>
      </div>
    </div>
  );
}

