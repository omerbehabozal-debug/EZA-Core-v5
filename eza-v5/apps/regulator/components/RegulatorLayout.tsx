/**
 * Regulator Panel Layout
 * 
 * Separate layout from platform UI.
 * Includes navigation and legal disclaimer.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRegulatorAuth } from '@/lib/auth-guard';
import { LegalDisclaimer } from './LegalDisclaimer';

export function RegulatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useRegulatorAuth();

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/audit-logs', label: 'Audit Logs' },
    { href: '/reports', label: 'Reports' },
    { href: '/alerts', label: 'Alerts' },
  ];

  return (
    <div className="min-h-screen bg-regulator-background">
      {/* Header */}
      <header className="bg-white border-b border-regulator-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-regulator-primary">
                Regulator Oversight Panel
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-sm text-gray-600">
                  {user.email} ({user.role})
                </span>
              )}
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
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
      </main>
    </div>
  );
}

