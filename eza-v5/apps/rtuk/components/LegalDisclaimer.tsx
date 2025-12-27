/**
 * RTÜK Legal Disclaimer Banner
 * 
 * MANDATORY: Must be displayed on all RTÜK panel pages.
 * States that RTÜK does not see content and does not make editorial decisions.
 */

'use client';

export function LegalDisclaimer() {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
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
        </div>
        <div className="ml-3">
          <p className="text-sm text-blue-900 leading-relaxed">
            <strong>RTÜK Gözetim Bildirimi:</strong> Bu panel içerik göstermez.
            <br />
            Bu panel bir sansür veya yaptırım aracı değildir.
            <br />
            RTÜK bu panel aracılığıyla editoryal karar almaz.
          </p>
        </div>
      </div>
    </div>
  );
}

