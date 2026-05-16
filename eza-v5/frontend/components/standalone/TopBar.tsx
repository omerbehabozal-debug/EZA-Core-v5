/**
 * TopBar Component - EZA Standalone chrome
 */

import Link from 'next/link';
import { Activity, Settings } from 'lucide-react';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

interface TopBarProps {
  onSettingsClick: () => void;
}

export default function TopBar({ onSettingsClick }: TopBarProps) {
  return (
    <div className={standaloneSkin.chromeTop}>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
        <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
          <div className={standaloneSkin.logoMark}>EZA</div>
        </div>

        <div className="flex-1 text-center px-2">
          <h1 className={standaloneSkin.title}>EZA Standalone</h1>
        </div>

        <div className="flex items-center justify-end gap-0.5 sm:gap-1 flex-shrink-0">
          <Link
            href="/standalone/insights"
            className={`w-7 h-7 sm:w-8 sm:h-8 ${standaloneSkin.iconBtn}`}
            aria-label="Davranış geçmişi"
            title="Davranış geçmişi"
          >
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-eza-accent" />
          </Link>
          <button
            type="button"
            onClick={onSettingsClick}
            className={`w-7 h-7 sm:w-8 sm:h-8 ${standaloneSkin.iconBtn} active:scale-95`}
            aria-label="Ayarlar"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-eza-text-secondary" />
          </button>
        </div>
      </div>
    </div>
  );
}

