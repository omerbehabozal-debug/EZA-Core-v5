/**
 * User Profile Dropdown Component
 * Shows user info and provides link to Platform (for admin/ops/finance roles)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Settings } from 'lucide-react';

const PLATFORM_URL = process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://platform.ezacore.ai';

// Platform roles that can access management
const PLATFORM_ROLES = ['admin', 'org_admin', 'ops', 'finance'];

export default function UserProfileDropdown() {
  const { role, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const canAccessPlatform = role && PLATFORM_ROLES.includes(role);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handlePlatformRedirect = () => {
    window.location.href = PLATFORM_URL;
  };

  const getRoleLabel = (role: string | null) => {
    const roleMap: Record<string, string> = {
      admin: 'Yönetici',
      org_admin: 'Organizasyon Yöneticisi',
      ops: 'Operasyon',
      finance: 'Finans',
      corporate: 'Kurumsal Kullanıcı',
      regulator: 'Denetleyici',
      proxy_user: 'Kullanıcı',
      reviewer: 'İnceleyici',
      auditor: 'Denetçi',
    };
    return roleMap[role || ''] || role || 'Kullanıcı';
  };

  // Detect if we're on Platform or Proxy
  const isPlatform = typeof window !== 'undefined' && window.location.pathname.includes('/platform');
  const bgColor = isPlatform ? 'var(--platform-surface)' : 'var(--proxy-surface)';
  const bgHover = isPlatform ? 'var(--platform-surface-hover)' : 'var(--proxy-surface-hover)';
  const borderColor = isPlatform ? 'var(--platform-border)' : 'var(--proxy-border-soft)';
  const textPrimary = isPlatform ? 'var(--platform-text-primary)' : 'var(--proxy-text-primary)';
  const textSecondary = isPlatform ? 'var(--platform-text-secondary)' : 'var(--proxy-text-secondary)';
  const actionColor = isPlatform ? 'var(--platform-action-primary)' : 'var(--proxy-action-primary)';
  const dangerColor = isPlatform ? 'var(--platform-danger)' : 'var(--proxy-danger)';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{
          backgroundColor: isOpen ? bgHover : 'transparent',
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
          style={{
            backgroundColor: actionColor,
            color: '#FFFFFF',
          }}
        >
          {role ? role.charAt(0).toUpperCase() : 'U'}
        </div>
        <span className="text-sm font-medium" style={{ color: textPrimary }}>
          {getRoleLabel(role)}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl shadow-lg z-50"
          style={{
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div className="p-4 border-b" style={{ borderColor: borderColor }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  backgroundColor: actionColor,
                  color: '#FFFFFF',
                }}
              >
                {role ? role.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: textPrimary }}>
                  Kullanıcı
                </p>
                <p className="text-xs" style={{ color: textSecondary }}>
                  {getRoleLabel(role)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2">
            {/* Platform Link (only for admin/ops/finance) */}
            {canAccessPlatform && (
              <button
                type="button"
                onClick={handlePlatformRedirect}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                style={{
                  '--hover-bg': bgHover,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = bgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Settings size={16} style={{ color: actionColor }} />
                <span className="text-sm" style={{ color: textPrimary }}>
                  Yönetim Paneline Git
                </span>
              </button>
            )}

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left mt-1"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = bgHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={16} style={{ color: dangerColor }} />
              <span className="text-sm" style={{ color: textPrimary }}>
                Çıkış Yap
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

