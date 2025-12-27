/**
 * Regulator Panel Layout
 * 
 * Separate layout from platform UI.
 * Includes navigation and legal disclaimer.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRegulatorAuth } from '@/lib/auth-guard';
import { LegalDisclaimer } from './LegalDisclaimer';
import { HelpModal } from './HelpModal';

export function RegulatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useRegulatorAuth();
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Kontrol Paneli' },
    { href: '/audit-logs', label: 'Denetim Kayıtları' },
    { href: '/reports', label: 'Raporlar' },
    { href: '/alerts', label: 'Uyarılar' },
  ];

  return (
    <div className="min-h-screen bg-regulator-background">
      {/* Header */}
      <header className="bg-white border-b border-regulator-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-regulator-primary">
                Düzenleyici Gözetim Paneli
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setHelpModalOpen(true)}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Paneli Nasıl Okumalıyım?</span>
              </button>
              {user && (
                <span className="text-sm text-gray-600">
                  {user.email} ({user.role})
                </span>
              )}
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800 whitespace-nowrap px-2 py-1"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-regulator-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${
                      isActive
                        ? 'border-regulator-primary text-regulator-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LegalDisclaimer />
        {children}
        
        {/* Subtle legal reinforcement */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Bu panel gözlemseldir ve düzenleyici kurumlara editoryal yetki vermez.
          </p>
        </div>
      </main>

      {/* Help Modal */}
      <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
}

