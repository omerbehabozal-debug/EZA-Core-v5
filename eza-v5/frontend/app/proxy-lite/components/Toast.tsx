/**
 * Toast Notification Component - Apple Soft Light Theme
 * Premium, minimal toast notification
 */

'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-close after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: '#FFFFFF',
          border: '#22BF55',
          icon: '✓',
          text: '#22BF55',
        };
      case 'error':
        return {
          bg: '#FFFFFF',
          border: '#E84343',
          icon: '⚠️',
          text: '#E84343',
        };
      default:
        return {
          bg: '#FFFFFF',
          border: '#007AFF',
          icon: 'ℹ️',
          text: '#007AFF',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className="fixed top-8 left-1/2 z-50"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: `translate(-50%, ${isVisible ? '0' : '-30px'}) scale(${isVisible ? 1 : 0.95})`,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        filter: isVisible ? 'blur(0px)' : 'blur(4px)',
      }}
    >
      <div
        className="rounded-[20px] px-5 py-4 flex items-center gap-3 min-w-[280px] max-w-[420px] backdrop-blur-xl"
        style={{
          background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg}dd 100%)`,
          border: `1.5px solid ${colors.border}80`,
          boxShadow: `
            0px 8px 32px ${colors.border}40,
            0px 4px 16px rgba(0,0,0,0.1),
            0px 0px 0px 1px rgba(255,255,255,0.1) inset
          `,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${colors.border}20 0%, ${colors.border}10 100%)`,
            border: `1px solid ${colors.border}40`,
          }}
        >
          <span style={{ color: colors.text, fontSize: '18px', fontWeight: 600 }}>{colors.icon}</span>
        </div>
        <p
          className="text-sm font-semibold flex-1 leading-relaxed"
          style={{
            color: colors.text,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

