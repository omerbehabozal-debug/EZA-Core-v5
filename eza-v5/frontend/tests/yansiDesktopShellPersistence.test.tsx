/**
 * Desktop /m lives inside the shared BiligN route-group shell.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  isPublicYansiExperiencePath,
  resolveSainaAppView,
} from '@/lib/eza/sainaRoutes';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import SainaAppRootLayout from '@/components/saina/SainaAppRootLayout';
import { buildMirrorPublicPath } from '@/lib/eza/mirror-network/mirrorPublicUrl';

const pathnameRef = { current: '/m/yansi-b' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
    isAuthReady: true,
    setAuth: vi.fn(),
  }),
}));

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('public Yansı route + share contracts', () => {
  it('keeps canonical /m/{slug} and maps it to the yansi app view', () => {
    expect(buildMirrorPublicPath('yansi-b')).toBe('/m/yansi-b');
    expect(isPublicYansiExperiencePath('/m/yansi-b')).toBe(true);
    expect(resolveSainaAppView('/m/yansi-b')).toBe('yansi');
    expect(resolveSainaAppView('/m/yansi-b?mode=chat')).toBe('yansi');
    expect(resolveSainaAppView('/standalone/discover')).toBe('discover');
    expect(resolveSainaAppView('/standalone')).toBe('chat');
  });
});

describe('shared (bilign) route-group architecture', () => {
  it('hosts standalone and /m under one SainaAppRootLayout parent', () => {
    const group = read('app/(bilign)/layout.tsx');
    const standalone = read('app/(bilign)/standalone/layout.tsx');
    const publicM = read('app/(bilign)/m/layout.tsx');
    expect(group).toContain('SainaAppRootLayout');
    expect(standalone).not.toContain('SainaAppRootLayout');
    expect(publicM).not.toContain('SainaAppRootLayout');
    expect(publicM).toContain('data-mirror-landing-layout');
    expect(publicM).toContain('yansi-reel-responsive.css');
  });

  it('does not lock html/body overflow on desktop /m', () => {
    const css = read('styles/yansi-reel-responsive.css');
    expect(css).not.toContain('html:has([data-mirror-landing-layout])');
    expect(css).not.toContain('body:has([data-mirror-landing-layout])');
    expect(css).toContain("[data-saina-view='yansi'] .saina-yansi-canvas-wrap");
  });

  it('hides BiligN chrome on /m at max-width 899px', () => {
    const css = read('styles/yansi-reel-responsive.css');
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\[data-saina-view='yansi'\] \.saina-standalone-sidebar-wrap[\s\S]*display:\s*none/
    );
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*\[data-saina-view='yansi'\] \.saina-yansi-shell-topbar[\s\S]*display:\s*none/
    );
  });
});

describe('SainaAppRootLayout yansi view', () => {
  beforeEach(() => {
    pathnameRef.current = '/m/yansi-b';
    useSainaChromeStore.getState().setChrome({
      conversations: [
        {
          id: 'chat-1',
          title: 'Kept conversation',
          preview: 'still here',
          time: '1 dk',
        },
      ],
      activeChatId: 'chat-1',
    });
  });

  it('renders the real sidebar, one topbar, and no persistent Discover scene', () => {
    render(
      <SainaAppRootLayout>
        <div data-testid="yansi-main-child">Yansı</div>
      </SainaAppRootLayout>
    );
    expect(screen.getByTestId('saina-yansi-shell')).toHaveAttribute('data-saina-view', 'yansi');
    expect(screen.getByText('Kept conversation')).toBeInTheDocument();
    expect(screen.getAllByTestId('saina-top-search-trigger')).toHaveLength(1);
    expect(screen.getByTestId('saina-yansi-shell-topbar')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-scene-live')).toBeNull();
    expect(screen.getByTestId('yansi-main-child')).toBeInTheDocument();
  });

  it('keeps Keşfet as the active primary nav item', () => {
    render(
      <SainaAppRootLayout>
        <div>Yansı</div>
      </SainaAppRootLayout>
    );
    const discover = screen.getByTestId('saina-discover-nav');
    expect(discover).toHaveAttribute('aria-current', 'page');
  });
});
