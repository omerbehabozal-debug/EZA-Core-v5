/**
 * StandaloneSettingsPanel — sol sidebar ayarları
 */

import { Shield } from 'lucide-react';

interface StandaloneSettingsPanelProps {
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
}

export default function StandaloneSettingsPanel({
  safeOnlyMode,
  onSafeOnlyModeChange,
}: StandaloneSettingsPanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-standalone-text-muted">
        Ayarlar
      </p>

      <div className="rounded-xl border border-standalone-border/90 bg-standalone-surface p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
              <Shield className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-standalone-text">SAFE-only</p>
              <p className="text-[11px] leading-snug text-standalone-text-muted">
                Güvenli cevaplar için rewrite
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSafeOnlyModeChange(!safeOnlyMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors touch-manipulation ${
              safeOnlyMode ? 'bg-standalone-primary' : 'bg-standalone-text-muted/30'
            }`}
            aria-label={safeOnlyMode ? 'SAFE-only kapat' : 'SAFE-only aç'}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                safeOnlyMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-standalone-text-muted">
        Detaylı analiz için{' '}
        <span className="font-medium text-standalone-text-secondary">proxy-lite.ezacore.ai</span>
      </p>
    </div>
  );
}
