/**
 * Context Selector Component (Yayın Amacı)
 */

"use client";

import { useAnalysisStore } from "../store/useAnalysisStore";

const contexts = [
  { value: 'social_media', label: 'Sosyal Medya' },
  { value: 'corporate_professional', label: 'Kurumsal / Profesyonel' },
  { value: 'legal_official', label: 'Hukuki / Resmî' },
  { value: 'educational_informative', label: 'Eğitici / Bilgilendirici' },
  { value: 'personal_blog', label: 'Kişisel Blog / Günlük' },
] as const;

export default function ContextSelector() {
  const { context, setContext } = useAnalysisStore();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: '#3A3A3C' }}>
        Yayın Amacı
      </label>
      <select
        value={context || ''}
        onChange={(e) => setContext(e.target.value as any || null)}
        className="w-full px-4 py-3 rounded-[12px] border border-[#E3E3E7] bg-white text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
      >
        <option value="">Seçiniz (Opsiyonel)</option>
        {contexts.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

