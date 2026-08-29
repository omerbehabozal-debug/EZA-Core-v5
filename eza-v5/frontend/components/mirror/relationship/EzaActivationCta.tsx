'use client';

import { cn } from '@/lib/utils';
import {
  EZA_ACTIVATION_BODY,
  EZA_ACTIVATION_CTA,
  EZA_ACTIVATION_TITLE,
} from '@/lib/eza/ezaPatternCopy';

type Props = {
  onActivate: () => void;
  disabled?: boolean;
  className?: string;
};

export default function EzaActivationCta({ onActivate, disabled = false, className }: Props) {
  return (
    <div
      className={cn('saina-eza-activation-cta', className)}
      data-testid="saina-eza-activation-cta"
    >
      <p className="saina-eza-activation-cta__title">{EZA_ACTIVATION_TITLE}</p>
      <p className="saina-eza-activation-cta__body">{EZA_ACTIVATION_BODY}</p>
      <button
        type="button"
        className="saina-eza-activation-cta__button"
        disabled={disabled}
        onClick={onActivate}
        data-testid="saina-eza-activation-button"
      >
        {EZA_ACTIVATION_CTA}
      </button>
    </div>
  );
}
