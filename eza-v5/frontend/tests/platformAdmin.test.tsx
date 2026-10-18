import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import SainaPlatformAdmin from '@/components/saina/SainaPlatformAdmin';
import { BusinessApiError } from '@/lib/eza/businessYansi';

const api = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  isAuthReady: true,
  user: { email: 'admin@example.test', user_id: 'admin1', role: 'admin', full_name: 'Admin' },
  logout: vi.fn(),
}));

vi.mock('@/lib/eza/businessYansi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/eza/businessYansi')>();
  return { ...actual, businessRequest: api };
});
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  api.mockReset();
  auth.isAuthenticated = true;
  auth.isAuthReady = true;
  auth.user = { email: 'admin@example.test', user_id: 'admin1', role: 'admin', full_name: 'Admin' };
  api.mockImplementation(async (path = '') => {
    if (path === '/admin/overview') {
      return {
        business_enabled: true,
        totals: {
          businesses: 2,
          verified_businesses: 1,
          pending_applications: 1,
          public_publications: 0,
        },
        recent_applications: [
          {
            id: 'app-1',
            brand_name: 'Ada Marka',
            contact_name: 'Ada',
            corporate_email: 'ada@example.com',
            website: null,
            company_info: 'x',
            status: 'received',
            reviewer_note: '',
            business_id: null,
          },
        ],
        recent_events: [
          {
            id: 'ev-1',
            application_id: 'app-1',
            actor_user_id: 'u1',
            action: 'submitted',
            from_status: null,
            to_status: 'received',
          },
        ],
      };
    }
    if (path === '/applications') {
      return {
        items: [
          {
            id: 'app-1',
            brand_name: 'Ada Marka',
            contact_name: 'Ada',
            corporate_email: 'ada@example.com',
            website: null,
            company_info: 'x',
            status: 'received',
            reviewer_note: '',
            business_id: null,
          },
        ],
      };
    }
    if (path === '') return { items: [], canProvision: true };
    if (path === '/admin/businesses') return { items: [] };
    if (path === '/admin/publications') return { items: [] };
    if (path === '/admin/system') {
      return {
        business_enabled: true,
        pending_applications: 1,
        features: { brand_applications: true, knowledge_pool: true },
      };
    }
    if (String(path).startsWith('/applications/') && String(path).endsWith('/events')) {
      return { items: [] };
    }
    return { items: [] };
  });
});

describe('Platform Admin', () => {
  it('denies non-provisioning users', async () => {
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [], canProvision: false };
      if (path === '/admin/overview') throw new BusinessApiError(403, 'platform_admin_required');
      return { items: [] };
    });
    render(<SainaPlatformAdmin />);
    expect(await screen.findByRole('heading', { name: 'Platform Yönetimi' })).toBeVisible();
    expect(screen.getByText(/yalnızca backend tarafından doğrulanan platform yöneticilerine/i)).toBeVisible();
  });

  it('shows real overview totals and applications section', async () => {
    render(<SainaPlatformAdmin />);
    expect(await screen.findByText('Toplam marka')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('Onay bekleyen başvuru')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Marka Başvuruları' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ada Marka' })).toBeVisible();
    });
    expect(screen.getByRole('button', { name: 'İncelemeye al' })).toBeVisible();
  });
});
