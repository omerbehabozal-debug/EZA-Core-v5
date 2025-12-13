/**
 * CTA Auto-append Toggle Component
 */

"use client";

import { useAnalysisStore } from "../store/useAnalysisStore";

const ctaOptions = [
  { value: 'follow', label: 'Daha fazlası için takip et!' },
  { value: 'comment', label: 'Yorumlarda buluşalım!' },
  { value: 'opinion', label: 'Görüşlerini yaz!' },
] as const;

export default function CTAToggle() {
  const { ctaEnabled, ctaType, setCtaEnabled, setCtaType } = useAnalysisStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" style={{ color: '#3A3A3C' }}>
          CTA Otomatik Ekle
        </label>
        <button
          type="button"
          onClick={() => setCtaEnabled(!ctaEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            ctaEnabled ? 'bg-[#007AFF]' : 'bg-[#E3E3E7]'
          }`}
        >
          <div
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
              ctaEnabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      
      {ctaEnabled && (
        <select
          value={ctaType || ''}
          onChange={(e) => setCtaType(e.target.value as any || null)}
          className="w-full px-4 py-3 rounded-[12px] border border-[#E3E3E7] bg-white text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
        >
          <option value="">CTA Seçiniz</option>
          {ctaOptions.map((cta) => (
            <option key={cta.value} value={cta.value}>
              {cta.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

