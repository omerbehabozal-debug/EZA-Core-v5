/**
 * File Upload Button Component
 * UI-only buttons for future audio/image upload
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FileUploadButtonProps {
  type: 'audio' | 'image';
  className?: string;
}

export default function FileUploadButton({ type, className }: FileUploadButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const icons = {
    audio: '🎤',
    image: '📷'
  };

  const tooltips = {
    audio: 'Ses yükleme yakında aktif',
    image: 'Görsel/Video yükleme yakında aktif'
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          'w-12 h-12 rounded-xl bg-[#111726] border border-[#1A1F2E]',
          'flex items-center justify-center text-xl',
          'opacity-50 cursor-not-allowed',
          'transition-all duration-200',
          className
        )}
      >
        {icons[type]}
      </button>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#111726] border border-[#1A1F2E] rounded-lg text-xs text-gray-300 whitespace-nowrap z-10">
          {tooltips[type]}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-[#111726] border-r border-b border-[#1A1F2E] transform rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
}

