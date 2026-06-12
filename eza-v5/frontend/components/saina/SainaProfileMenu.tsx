'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, LogOut, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAINA_ANALYSIS_MODEL_LABEL,
  SAINA_MENU_ACCOUNT,
  SAINA_MENU_COMING_SOON,
  SAINA_MENU_SETTINGS,
  SAINA_SAFE_MODE_LABEL,
  SAINA_SAFE_MODE_NOTE,
} from '@/lib/eza/sainaCopy';
import {
  STANDALONE_ANALYSIS_MODELS,
  getAnalysisModelById,
} from '@/lib/standaloneModels';

export type SainaProfileMenuProps = {
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  disabled?: boolean;
  userInitial?: string;
};

export default function SainaProfileMenu({
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  disabled = false,
  userInitial = 'E',
}: SainaProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentModel = getAnalysisModelById(analysisModelId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="saina-profile-menu-root">
      <button
        type="button"
        className="saina-top-avatar-wrap saina-profile-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profil ve ayarlar"
        data-testid="saina-profile-menu-trigger"
      >
        <div className="saina-profile-avatar saina-profile-avatar--top">{userInitial}</div>
        <span className="saina-status-dot" aria-hidden />
      </button>

      {open ? (
        <div className="saina-profile-menu" role="menu" data-testid="saina-profile-menu">
          <button type="button" className="saina-profile-menu-item" role="menuitem" disabled>
            <User size={15} aria-hidden />
            <span>{SAINA_MENU_ACCOUNT}</span>
            <span className="saina-profile-menu-soon">{SAINA_MENU_COMING_SOON}</span>
          </button>

          <div className="saina-profile-menu-section">
            <p className="saina-profile-menu-section-label">
              <Settings size={14} aria-hidden />
              {SAINA_MENU_SETTINGS}
            </p>

            <div className="saina-profile-menu-row">
              <div className="saina-profile-menu-row-text">
                <span className="saina-profile-menu-row-title">{SAINA_SAFE_MODE_LABEL}</span>
                <span className="saina-profile-menu-row-note">{SAINA_SAFE_MODE_NOTE}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={safeOnlyMode}
                aria-label={safeOnlyMode ? 'Güvenli Mod açık' : 'Güvenli Mod kapalı'}
                disabled={disabled}
                className={cn('saina-profile-toggle', safeOnlyMode && 'saina-profile-toggle--on')}
                onClick={() => onSafeOnlyModeChange(!safeOnlyMode)}
                data-testid="saina-safe-mode-toggle"
              >
                <span className="saina-profile-toggle-knob" />
              </button>
            </div>

            <div className="saina-profile-menu-row saina-profile-menu-row--stack">
              <span className="saina-profile-menu-row-title">{SAINA_ANALYSIS_MODEL_LABEL}</span>
              <div className="saina-profile-model-list" role="listbox" aria-label={SAINA_ANALYSIS_MODEL_LABEL}>
                {STANDALONE_ANALYSIS_MODELS.map((model) => {
                  const active = model.id === analysisModelId;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={disabled}
                      className={cn(
                        'saina-profile-model-option',
                        active && 'saina-profile-model-option--active'
                      )}
                      onClick={() => onAnalysisModelChange(model.id)}
                    >
                      <span>{model.label}</span>
                      {active ? <ChevronRight size={14} className="opacity-50" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
              <span className="saina-profile-menu-row-note">Seçili: {currentModel.label}</span>
            </div>
          </div>

          <button type="button" className="saina-profile-menu-item" role="menuitem" disabled>
            <LogOut size={15} aria-hidden />
            <span>Çıkış</span>
            <span className="saina-profile-menu-soon">{SAINA_MENU_COMING_SOON}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
