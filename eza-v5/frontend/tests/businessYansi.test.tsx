import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import SainaBusinessManager from '@/components/saina/SainaBusinessManager';
import { BusinessApiError } from '@/lib/eza/businessYansi';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const api = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  isAuthReady: true,
  user: { email: 'owner@example.test', user_id: 'u1', role: 'user' },
  logout: vi.fn(),
}));

vi.mock('@/lib/eza/businessYansi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/eza/businessYansi')>();
  return { ...actual, businessRequest: api };
});
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const business = {
  id: 'business-a',
  name: 'BiligN',
  slug: 'bilign',
  description: 'Verified information',
  verified: true,
  official: true,
  status: 'active',
  logo_url: null,
};

beforeEach(() => {
  api.mockReset();
  auth.isAuthenticated = true;
  auth.isAuthReady = true;
  auth.user = { email: 'owner@example.test', user_id: 'u1', role: 'user' };
  api.mockImplementation(async (path = '') => {
    if (path === '') return { items: [business], canProvision: false };
    if (path === '/applications/mine') return { items: [] };
    if (path === '/applications') return { items: [] };
    if (String(path).endsWith('/overview')) return { business, role: 'viewer', publications: [] };
    return { items: [] };
  });
});

describe('Business management', () => {
  it('keeps management scoped and hides write controls from viewer', async () => {
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Bilgi Havuzu' }));
    expect(screen.queryByRole('button', { name: 'Taslak sürüm kaydet' })).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/business-a/knowledge');
  });

  it('shows backend errors and does not invent authorized content', async () => {
    api.mockRejectedValue(new BusinessApiError(403, 'business_access_denied'));
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu işlem için yetkin bulunmuyor.');
    expect(screen.queryByRole('heading', { name: 'Marka yetkisi yok' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Başvuruyu gönder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yansı Stüdyosu' })).not.toBeInTheDocument();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('treats feature-flag 404 as preparing, not no-access', async () => {
    api.mockRejectedValue(new BusinessApiError(404, 'not_found'));
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'BiligN Business şu anda kullanıma hazırlanıyor.'
    );
    expect(screen.queryByText('İşlem tamamlanamadı (404).')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Marka yetkisi yok' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Markanızı BiligN'e ekleyin" })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Başvuruyu gönder' })).not.toBeInTheDocument();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('keeps session and hides application form on network failure', async () => {
    api.mockRejectedValue(new BusinessApiError(0, 'network_error'));
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Business servisine bağlanılamadı');
    expect(screen.queryByRole('button', { name: 'Başvuruyu gönder' })).not.toBeInTheDocument();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('keeps session and hides application form on 5xx', async () => {
    api.mockRejectedValue(new BusinessApiError(503, null));
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('geçici bir sorun');
    expect(screen.queryByRole('button', { name: 'Başvuruyu gönder' })).not.toBeInTheDocument();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('keeps session on 401 without showing brand application form', async () => {
    api.mockRejectedValue(new BusinessApiError(401, 'unauthorized'));
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Oturum doğrulanamadı');
    expect(screen.queryByRole('button', { name: 'Başvuruyu gönder' })).not.toBeInTheDocument();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('provides eight sourced editorial steps to editor', async () => {
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [business], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business, role: 'editor', publications: [] };
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Yansı Stüdyosu' }));
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByLabelText('8. soru')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Onayla' })).not.toBeInTheDocument();
  });

  it('shows simplified BiligN welcome for anonymous users', async () => {
    auth.isAuthenticated = false;
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('heading', { name: "Markanız da BiligN'de." })).toBeVisible();
    const continueLink = screen.getByRole('link', { name: 'BiligN hesabımla devam et' });
    const registerLink = screen.getByRole('link', { name: 'BiligN hesabı oluştur' });
    expect(continueLink).toHaveAttribute('href', expect.stringContaining('/platform/login'));
    expect(continueLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('/standalone/business')));
    expect(registerLink).toHaveAttribute('href', expect.stringContaining('/platform/register'));
    expect(registerLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('/standalone/business')));
    expect(screen.queryByText('Bu hesap için Business yetkisi bulunmuyor.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Business hesabı')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Markanızı BiligN\'e ekleyin' })).not.toBeInTheDocument();
  });

  it('shows brand add intake when authenticated without memberships', async () => {
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('heading', { name: 'Marka yetkisi yok' })).toBeVisible();
    expect(screen.getByRole('heading', { name: "Markanızı BiligN'e ekleyin" })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Başvuruyu gönder' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'BiligN hesabımla devam et' })).not.toBeInTheDocument();
  });

  it('keeps platform admins without memberships on Business onboarding', async () => {
    auth.user = { email: 'admin@example.test', user_id: 'admin1', role: 'admin' };
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [], canProvision: true };
      if (path === '/applications/mine') return { items: [] };
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('heading', { name: 'Marka yetkisi yok' })).toBeVisible();
    expect(screen.getByRole('heading', { name: "Markanızı BiligN'e ekleyin" })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Başvuruyu gönder' })).toBeVisible();
    // Optional Platform Yönetimi link may appear in account menu only after opening it —
    // primary CTA must not force /standalone/admin.
    expect(screen.queryByRole('heading', { name: 'Platform yöneticisi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Platform Yönetimi' })).not.toBeInTheDocument();
  });

  it('shows brand picker when user has multiple businesses', async () => {
    const second = { ...business, id: 'business-b', name: 'İkinci Marka', slug: 'ikinci' };
    api.mockImplementation(async (path = '') => {
      const p = String(path);
      if (p === '') return { items: [business, second], canProvision: false };
      if (p === '/applications/mine') return { items: [] };
      if (p.endsWith('/overview')) {
        const current = p.includes('business-b') ? second : business;
        return { business: current, role: 'owner', publications: [] };
      }
      if (p.endsWith('/knowledge')) {
        return {
          items: [
            {
              id: p.includes('business-b') ? 'k2' : 'k1',
              item_id: 'i1',
              title: p.includes('business-b') ? 'İkinci Bilgi' : 'Birinci Bilgi',
              category: '',
              content: 'x',
              source: 's',
              public_allowed: false,
              status: 'draft',
              version: 1,
              revision: 1,
            },
          ],
        };
      }
      if (p.endsWith('/members') || p.endsWith('/drafts')) return { items: [] };
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('heading', { name: 'Marka seçin' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'İkinci Marka' }));
    await screen.findByRole('heading', { name: 'İkinci Marka' });
    fireEvent.click(screen.getByRole('button', { name: 'Bilgi Havuzu' }));
    expect(await screen.findByRole('heading', { name: /İkinci Bilgi/ })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /Birinci Bilgi/ })).not.toBeInTheDocument();
  });
});

describe('Business public identity', () => {
  it('accepts explicit verified business identity and drops private extras', () => {
    const raw = {
      slug: 'source',
      journeyVersion: 1,
      authorUserId: 'business-id',
      selectedCount: 8,
      replayReady: true,
      sourceConversationId: 'private-source',
      businessPublisher: {
        businessId: 'business-id',
        slug: 'bilign',
        displayName: 'BiligN',
        verified: true,
        official: true,
        ownerId: 'private-owner',
      },
      steps: Array.from({ length: 8 }, (_, i) => ({
        stepIndex: i + 1,
        publicQuestion: 'Question',
        publicAnswer: 'Answer',
        ezaSnapshot: { userScore: 88 },
      })),
    };
    const parsed = parsePublicFrozenJourneyArtifact(raw);
    expect(parsed?.businessPublisher?.official).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/private-source|private-owner|ezaSnapshot/);
  });
});
