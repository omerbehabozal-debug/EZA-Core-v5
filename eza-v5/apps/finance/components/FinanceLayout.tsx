/**
 * Finance Panel Layout
 * 
 * Separate layout for financial regulatory oversight.
 * Includes navigation and legal disclaimer.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFinanceAuth } from '@/lib/auth-guard';
import { LegalDisclaimer } from './LegalDisclaimer';

export function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useFinanceAuth();

  const navItems = [
    { href: '/', label: 'Finans Kontrol Paneli' },
    { href: '/institutions', label: 'Finansal Kurumlar' },
    { href: '/audit-logs', label: 'Finansal Denetim Kayıtları' },
    { href: '/risk-patterns', label: 'Sistematik Finansal Risk Kalıpları' },
    { href: '/alerts', label: 'Gözlemsel Uyarılar' },
  ];

  return (
    <div className="min-h-screen bg-finance-background">
      {/* Header */}
      <header className="bg-white border-b border-finance-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-finance-primary">
                BDDK / SPK - Finansal AI Gözetim Paneli
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-sm text-gray-600">
                  {user.email}
                </span>
              )}
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-800 whitespace-nowrap px-2 py-1"
                translate="no"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-finance-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  pathname === item.href
                    ? 'border-finance-primary text-finance-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                translate="no"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Legal Disclaimer - MANDATORY */}
        <LegalDisclaimer />
        
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-finance-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-gray-500 text-center">
            Bu panel finansal karar üretmez. Gözlem ve risk analizi amaçlıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}

