'use client';

import { Compass, Mountain, Sparkles, Sun } from 'lucide-react';
import {
  SAINA_CONCEPT_FEELING_TITLE,
  SAINA_CONCEPT_FEELINGS,
  SAINA_CONCEPT_NEXT_BODY,
  SAINA_CONCEPT_NEXT_TITLE,
} from '@/lib/eza/sainaCopy';

const FEELING_ICONS = [Compass, Sun, Mountain, Sparkles] as const;

/** Dev mock concept paftası — desktop alt bilgi şeridi. */
export default function SainaConceptFooter() {
  return (
    <footer className="saina-concept-footer" aria-label="Konsept notları">
      <div className="saina-concept-footer-inner">
        <div className="saina-concept-block">
          <p className="saina-concept-label">{SAINA_CONCEPT_FEELING_TITLE}</p>
          <div className="saina-concept-pills">
            {SAINA_CONCEPT_FEELINGS.map((label, i) => {
              const Icon = FEELING_ICONS[i];
              return (
                <span key={label} className="saina-concept-pill">
                  <Icon size={12} aria-hidden />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="saina-concept-block saina-concept-block--next">
          <p className="saina-concept-label">{SAINA_CONCEPT_NEXT_TITLE}</p>
          <p className="saina-concept-body">{SAINA_CONCEPT_NEXT_BODY}</p>
        </div>
      </div>
    </footer>
  );
}
