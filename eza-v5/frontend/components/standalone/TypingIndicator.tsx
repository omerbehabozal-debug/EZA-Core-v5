/**
 * TypingIndicator — assistant wait state
 */

import { standaloneSkin } from '@/lib/eza/standaloneSkin';

export default function TypingIndicator() {
  return (
    <div className={`flex justify-start ${standaloneSkin.turnBlock}`}>
      <div className={standaloneSkin.assistantTurn}>
        <div className={standaloneSkin.typingIndicator}>
          <div className="flex items-center gap-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 rounded-full bg-eza-text-muted/70 animate-pulse-dot"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
