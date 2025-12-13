/**
 * Premium Confirmation Modal Component - Apple Soft Light Theme
 * Premium modal for confirmations with glassmorphism effect
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Tamam',
  cancelText = 'İptal',
  onConfirm,
  onCancel,
  type = 'warning'
}: ConfirmModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: '#E84343',
          confirmBg: '#E84343',
          confirmHover: '#D63333',
          border: '#E84343',
        };
      case 'warning':
        return {
          icon: '#F4A72F',
          confirmBg: '#F4A72F',
          confirmHover: '#E8961F',
          border: '#F4A72F',
        };
      default:
        return {
          icon: '#007AFF',
          confirmBg: '#007AFF',
          confirmHover: '#0056CC',
          border: '#007AFF',
        };
    }
  };

  const colors = getColors();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: `scale(${isVisible ? 1 : 0.9})`,
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div
          className="rounded-[24px] p-6 max-w-md w-full backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFFF5 100%)',
            border: `1.5px solid ${colors.border}40`,
            boxShadow: `
              0px 20px 60px rgba(0,0,0,0.2),
              0px 8px 24px rgba(0,0,0,0.15),
              0px 0px 0px 1px rgba(255,255,255,0.1) inset
            `,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${colors.icon}20 0%, ${colors.icon}10 100%)`,
                  border: `1px solid ${colors.icon}40`,
                }}
              >
                <AlertTriangle size={20} style={{ color: colors.icon }} />
              </div>
              <h3
                className="text-lg font-bold"
                style={{
                  color: '#1C1C1E',
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded-lg transition-all hover:bg-gray-100"
              style={{ color: '#6E6E73' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Message */}
          <p
            className="text-sm mb-6 leading-relaxed"
            style={{
              color: '#6E6E73',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontWeight: 400,
            }}
          >
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-[14px] text-sm font-semibold transition-all hover:opacity-80"
              style={{
                backgroundColor: '#F8F9FB',
                color: '#6E6E73',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 600,
                border: '1px solid #E3E3E7',
              }}
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 py-3 px-4 rounded-[14px] text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{
                backgroundColor: colors.confirmBg,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 600,
                boxShadow: `0px 4px 12px ${colors.confirmBg}40`,
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

