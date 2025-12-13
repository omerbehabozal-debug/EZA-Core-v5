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
      className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: `translate(-50%, ${isVisible ? '0' : '-20px'})`,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div
        className="rounded-[16px] px-4 py-3 shadow-lg flex items-center gap-2 min-w-[200px] max-w-[400px]"
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          boxShadow: '0px 4px 12px rgba(0,0,0,0.15), 0px 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        <span style={{ color: colors.text, fontSize: '16px' }}>{colors.icon}</span>
        <p
          className="text-sm font-medium flex-1"
          style={{
            color: colors.text,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

