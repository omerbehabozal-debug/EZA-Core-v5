'use client';

import {
  DISCOVER_MODES,
  DISCOVER_MODE_LABELS,
  type DiscoverMode,
} from '@/lib/eza/mirror-network/discoverModes';

export type SainaDiscoverModeSelectorProps = {
  mode: DiscoverMode;
  onChange: (mode: DiscoverMode) => void;
  disabled?: boolean;
};

export default function SainaDiscoverModeSelector({
  mode,
  onChange,
  disabled = false,
}: SainaDiscoverModeSelectorProps) {
  return (
    <nav
      className="saina-discover-modes"
      data-testid="saina-discover-mode-selector"
      aria-label="Keşfet sıralaması"
    >
      {DISCOVER_MODES.map((id, index) => (
        <span key={id} className="saina-discover-modes__item">
          {index > 0 ? (
            <span className="saina-discover-modes__dot" aria-hidden>
              ·
            </span>
          ) : null}
          <button
            type="button"
            className="saina-discover-modes__btn"
            aria-pressed={mode === id}
            data-testid={`saina-discover-mode-${id}`}
            disabled={disabled}
            onClick={() => onChange(id)}
          >
            {DISCOVER_MODE_LABELS[id]}
          </button>
        </span>
      ))}
    </nav>
  );
}
