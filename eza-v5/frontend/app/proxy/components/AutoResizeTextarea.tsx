/**
 * Auto-Resize Textarea Component
 * Automatically adjusts height based on content
 * No manual resize handle, smooth height adjustment
 */

'use client';

import { useEffect, useRef, TextareaHTMLAttributes } from 'react';

interface AutoResizeTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  minHeight?: number;
  maxHeight?: string;
  className?: string;
}

export default function AutoResizeTextarea({
  value,
  onChange,
  minHeight = 120,
  maxHeight = '40vh',
  className = '',
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height
    const scrollHeight = textarea.scrollHeight;
    const minHeightPx = minHeight;
    const maxHeightPx = typeof maxHeight === 'string' && maxHeight.includes('vh')
      ? window.innerHeight * (parseFloat(maxHeight) / 100)
      : typeof maxHeight === 'string' && maxHeight.includes('px')
      ? parseFloat(maxHeight)
      : 600; // Default fallback

    // Set height based on content, respecting min and max
    if (scrollHeight < minHeightPx) {
      textarea.style.height = `${minHeightPx}px`;
      textarea.style.overflowY = 'hidden';
    } else if (scrollHeight > maxHeightPx) {
      textarea.style.height = `${maxHeightPx}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value, minHeight, maxHeight]);

  // Adjust on window resize
  useEffect(() => {
    const handleResize = () => {
      adjustHeight();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [value, minHeight, maxHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e);
    }
    // Adjust height after state update
    setTimeout(adjustHeight, 0);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Allow default paste behavior
    // Height will adjust automatically via handleChange
    setTimeout(adjustHeight, 0);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onPaste={handlePaste}
      className={className}
      style={{
        resize: 'none', // Disable manual resize
        transition: 'height 0.1s ease-out',
        minHeight: `${minHeight}px`,
        maxHeight: maxHeight,
      }}
      {...props}
    />
  );
}

