/**
 * Organization Selector Component
 * Displays current organization and allows switching
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { ChevronDown } from 'lucide-react';

export default function OrganizationSelector() {
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = (org: typeof organizations[0]) => {
    setCurrentOrganization(org);
    setIsOpen(false);
    // Reload page to refresh all components
    window.location.reload();
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--platform-surface-hover)]"
        style={{
          backgroundColor: isOpen ? 'var(--platform-surface-hover)' : 'transparent',
        }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--platform-text-primary)' }}>
          Organization: {currentOrganization.name}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--platform-text-secondary)' }} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto"
          style={{
            backgroundColor: 'var(--platform-surface)',
            border: '1px solid var(--platform-border)',
            boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div className="p-2">
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSwitch(org)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentOrganization.id === org.id
                    ? 'bg-[var(--platform-action-primary)]20 text-[var(--platform-action-primary)]'
                    : 'hover:bg-[var(--platform-surface-hover)] text-[var(--platform-text-primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{org.name}</span>
                  {currentOrganization.id === org.id && (
                    <span className="text-xs">✓</span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--platform-text-muted)' }}>
                  {org.plan} • {org.status}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

