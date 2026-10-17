import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import SainaBusinessManager from '@/components/saina/SainaBusinessManager';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

const api = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  isAuthReady: true,
  user: { email: 'owner@example.test', user_id: 'u1', role: 'user' },
  logout: vi.fn(),
}));

vi.mock('@/lib/eza/businessYansi', () => ({ businessRequest: api }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

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
    api.mockRejectedValue(new Error('business_access_denied'));
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('business_access_denied');
    expect(screen.queryByRole('button', { name: 'Yansı Stüdyosu' })).not.toBeInTheDocument();
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

  it('shows login gate for anonymous users without unauthorized copy', async () => {
    auth.isAuthenticated = false;
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('link', { name: 'Business hesabına giriş yap' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Markanızı kaydedin' })).toBeVisible();
    expect(screen.queryByText('Bu hesap için Business yetkisi bulunmuyor.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Business hesabı')).not.toBeInTheDocument();
    expect(screen.queryByText("Keşfet'e dön")).not.toBeInTheDocument();
  });

  it('shows application intake when authenticated without memberships', async () => {
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    expect(await screen.findByRole('heading', { name: 'Business yetkisi yok' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Başvuruyu gönder' })).toBeVisible();
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
