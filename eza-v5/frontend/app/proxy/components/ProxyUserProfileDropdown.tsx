/**
 * Proxy User Profile Dropdown Component
 * Sealed operational environment - NO cross-navigation to Platform
 * 
 * Shows:
 * - User email
 * - Role (proxy role)
 * - Organization (read-only)
 * - Logout
 * 
 * Does NOT show:
 * - "Go to Platform Panel" link
 * - Any navigation to platform.ezacore.ai
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { LogOut, Building2 } from 'lucide-react';

export default function ProxyUserProfileDropdown() {
  const { role, user, logout } = useAuth();
  const { currentOrganization } = useOrganization();
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

  const handleLogout = () => {
    logout();
    window.location.href = '/proxy/login';
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{
          backgroundColor: isOpen ? 'var(--proxy-surface-hover)' : 'transparent',
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
          style={{
            backgroundColor: 'var(--proxy-action-primary)',
            color: '#FFFFFF',
          }}
        >
          {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--proxy-text-primary)' }}>
          {getRoleLabel(role)}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl shadow-lg z-50"
          style={{
            backgroundColor: 'var(--proxy-surface)',
            border: '1px solid var(--proxy-border-soft)',
            boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div className="p-4 border-b" style={{ borderColor: 'var(--proxy-border-soft)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  backgroundColor: 'var(--proxy-action-primary)',
                  color: '#FFFFFF',
                }}
              >
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--proxy-text-primary)' }}>
                  {user?.email || 'User'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--proxy-text-secondary)' }}>
                  {getRoleLabel(role)}
                </p>
              </div>
            </div>
          </div>

          {/* Organization (Read-only) */}
          {currentOrganization && (
            <div className="p-3 border-b" style={{ borderColor: 'var(--proxy-border-soft)' }}>
              <div className="flex items-center gap-2">
                <Building2 size={14} style={{ color: 'var(--proxy-text-secondary)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                    Organizasyon
                  </p>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--proxy-text-primary)' }}>
                    {currentOrganization.name}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-2">
            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--proxy-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={16} style={{ color: 'var(--proxy-danger)' }} />
              <span className="text-sm" style={{ color: 'var(--proxy-text-primary)' }}>
                Çıkış Yap
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

