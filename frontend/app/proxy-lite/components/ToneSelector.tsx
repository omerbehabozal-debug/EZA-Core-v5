/**
 * Tone Selector Component
 */

"use client";

import { useAnalysisStore } from "../store/useAnalysisStore";

const tones = [
  { value: 'neutral', label: 'Tarafsız' },
  { value: 'professional', label: 'Profesyonel' },
  { value: 'friendly', label: 'Samimi' },
  { value: 'funny', label: 'Eğlenceli' },
  { value: 'persuasive', label: 'İkna Edici' },
  { value: 'strict_warning', label: 'Sert / Uyarıcı' },
] as const;

export default function ToneSelector() {
  const { tone, setTone } = useAnalysisStore();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: '#3A3A3C' }}>
        Ton
      </label>
      <select
        value={tone || ''}
        onChange={(e) => setTone(e.target.value as any || null)}
        className="w-full px-4 py-3 rounded-[12px] border border-[#E3E3E7] bg-white text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
      >
        <option value="">Seçiniz (Opsiyonel)</option>
        {tones.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

