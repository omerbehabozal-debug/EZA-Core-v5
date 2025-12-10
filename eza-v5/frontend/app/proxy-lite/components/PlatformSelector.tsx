/**
 * Platform Selector Component
 */

"use client";

import { useAnalysisStore } from "../store/useAnalysisStore";

const platforms = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'blog', label: 'Blog' },
  { value: 'linkedin', label: 'LinkedIn' },
] as const;

export default function PlatformSelector() {
  const { platform, setPlatform } = useAnalysisStore();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: '#3A3A3C' }}>
        Platform
      </label>
      <select
        value={platform || ''}
        onChange={(e) => setPlatform(e.target.value as any || null)}
        className="w-full px-4 py-3 rounded-[12px] border border-[#E3E3E7] bg-white text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
      >
        <option value="">Seçiniz (Opsiyonel)</option>
        {platforms.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

