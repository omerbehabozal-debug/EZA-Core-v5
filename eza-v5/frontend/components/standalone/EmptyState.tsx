/**
 * EmptyState Component - EZA Standalone welcome
 */

import { standaloneSkin } from '@/lib/eza/standaloneSkin';

export default function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full px-3 sm:px-4 animate-fade-in">
      <div className="text-center max-w-sm w-full">
        <div className={standaloneSkin.welcomeCard}>
          <div
            className={`${standaloneSkin.logoMark} w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl mx-auto mb-4 sm:mb-6 text-2xl sm:text-3xl font-bold shadow-eza-md`}
          >
            EZA
          </div>

          <h2 className="text-lg sm:text-xl font-semibold text-eza-text mb-2">Merhaba</h2>
          <p className="text-eza-text-secondary text-sm sm:text-[15px] leading-relaxed">
            Yardımcı olmak için hazırım.
          </p>
        </div>
      </div>
    </div>
  );
}
