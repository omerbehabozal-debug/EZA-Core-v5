/**
 * Rewrite Options Component
 * 5 rewrite modes selector
 */

"use client";

interface RewriteOptionsProps {
  selectedMode: string;
  onModeChange: (mode: string) => void;
}

const rewriteModes = [
  { value: 'strict_compliance', label: 'Strict Compliance', desc: 'GDPR / Health / Banking kurallarına sıkı uyum' },
  { value: 'neutral_rewrite', label: 'Neutral Rewrite', desc: 'Tarafsızlaştır, objektif hale getir' },
  { value: 'policy_bound', label: 'Policy-Bound', desc: 'Regülatör kurallarına uy' },
  { value: 'autonomous_safety', label: 'Autonomous Safety', desc: 'Robotik güvenlik için optimize et' },
  { value: 'corporate_voice', label: 'Corporate-Voice', desc: 'Marka dilini koru' },
] as const;

export default function RewriteOptions({ selectedMode, onModeChange }: RewriteOptionsProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
        Rewrite Modu
      </label>
      <div className="grid grid-cols-1 gap-2">
        {rewriteModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onModeChange(mode.value)}
            className={`p-4 rounded-xl text-left transition-all ${
              selectedMode === mode.value
                ? 'ring-2 ring-[#007AFF]'
                : ''
            }`}
            style={{
              backgroundColor: selectedMode === mode.value ? '#2C2C2E' : '#1C1C1E',
              border: '1px solid #3A3A3C',
            }}
          >
            <div className="font-medium mb-1" style={{ color: '#E5E5EA' }}>
              {mode.label}
            </div>
            <div className="text-xs" style={{ color: '#8E8E93' }}>
              {mode.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

