'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Calendar,
  LayoutDashboard,
  Shield,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ezaCopy } from '@/lib/eza/copy';

export interface GovernanceShellProps {
  children: React.ReactNode;
  /** Org name shown in sidebar header (optional until Stage 2 wiring) */
  orgLabel?: string;
  /** Slot for org switcher / actions */
  headerActions?: React.ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { href: '/admin/governance', label: ezaCopy.nav.overview, icon: LayoutDashboard },
  { href: '/admin/governance/events', label: ezaCopy.nav.events, icon: Activity },
  { href: '/admin/governance/calibration', label: ezaCopy.nav.calibration, icon: BarChart3 },
  { href: '/admin/governance', label: ezaCopy.nav.reliability, icon: Shield },
  { href: '/governance/me', label: ezaCopy.nav.me, icon: Calendar, disabled: true },
  { href: '/design-system', label: ezaCopy.nav.designSystem, icon: Palette },
];

export default function GovernanceShell({
  children,
  orgLabel,
  headerActions,
}: GovernanceShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-eza-surface-muted text-eza-text">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-eza-border bg-eza-surface lg:flex">
          <div className="border-b border-eza-border px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-eza-accent">
              {ezaCopy.productName}
            </p>
            <p className="mt-0.5 text-[10px] text-eza-text-muted">{ezaCopy.tagline}</p>
            {orgLabel ? (
              <p className="mt-2 truncate text-xs text-eza-text-secondary" title={orgLabel}>
                {orgLabel}
              </p>
            ) : null}
          </div>
          <nav className="flex-1 space-y-0.5 p-2" aria-label="Governance">
            {navItems.map((item) => {
              const active =
                item.href === '/admin/governance'
                  ? pathname === '/admin/governance'
                  : pathname === item.href ||
                    (pathname?.startsWith(`${item.href}/`) ?? false);
              const Icon = item.icon;
              const baseClass = cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active && !item.disabled
                  ? 'bg-eza-accent-muted text-eza-accent'
                  : 'text-eza-text-secondary',
                item.disabled
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'hover:bg-eza-surface-muted hover:text-eza-text'
              );

              if (item.disabled) {
                return (
                  <span key={item.label} className={baseClass} title="Aşama 3’te aktif olacak">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link key={item.label} href={item.href} className={baseClass}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="border-t border-eza-border px-4 py-3 text-[10px] text-eza-text-muted">
            Governance Console
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-eza-border bg-eza-surface/95 backdrop-blur safe-area-top">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
              <p className="text-sm font-semibold text-eza-text lg:hidden">{ezaCopy.productName}</p>
              {headerActions}
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
