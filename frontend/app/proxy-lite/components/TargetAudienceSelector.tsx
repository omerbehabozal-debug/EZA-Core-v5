/**
 * Target Audience Selector Component (Hedef Kitle)
 */

"use client";

import { useAnalysisStore } from "../store/useAnalysisStore";

const audiences = [
  { value: 'general_public', label: 'Genel Halk' },
  { value: 'clients_consultants', label: 'Müşteriler / Danışanlar' },
  { value: 'students', label: 'Öğrenciler' },
  { value: 'children_youth', label: 'Çocuklar / Gençler' },
  { value: 'colleagues', label: 'Meslektaşlar' },
  { value: 'regulators_public', label: 'Regülatörler / Kamu' },
] as const;

export default function TargetAudienceSelector() {
  const { targetAudience, setTargetAudience } = useAnalysisStore();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: '#3A3A3C' }}>
        Hedef Kitle
      </label>
      <select
        value={targetAudience || ''}
        onChange={(e) => setTargetAudience(e.target.value as any || null)}
        className="w-full px-4 py-3 rounded-[12px] border border-[#E3E3E7] bg-white text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
      >
        <option value="">Seçiniz (Opsiyonel)</option>
        {audiences.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
    </div>
  );
}

