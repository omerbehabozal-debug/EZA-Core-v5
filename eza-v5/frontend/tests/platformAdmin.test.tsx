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
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));

beforeEach(() => {
  api.mockReset();
  replace.mockReset();
  auth.isAuthenticated = true;
  auth.isAuthReady = true;
  auth.user = { email: 'admin@example.test', user_id: 'admin1', role: 'admin', full_name: 'Admin' };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
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
            created_at: '2026-10-18T10:00:00Z',
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
            created_at: '2026-10-18T10:00:00Z',
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
            corporate_email: 'ada@very-long-corporate-email-address@example.com',
            website: null,
            company_info: 'x',
            status: 'received',
            reviewer_note: '',
            business_id: null,
            created_at: '2026-10-18T10:00:00Z',
          },
        ],
      };
    }
    if (path === '') return { items: [], canProvision: true };
    if (path === '/admin/businesses') {
      return {
        items: [
          {
            id: 'b1',
            name: 'Ada Marka',
            slug: 'ada-marka',
            description: '',
            logo_url: null,
            verified: true,
            official: false,
            status: 'active',
            owner_email: 'owner@example.com',
            owner_id: 'o1',
            publication_count: 0,
            member_count: 1,
          },
        ],
      };
    }
    if (path === '/admin/publications') return { items: [] };
    if (path === '/admin/system') {
      return {
        business_enabled: true,
        pending_applications: 1,
        features: {
          brand_applications: true,
          knowledge_pool: true,
          yansi_studio: true,
          publications: true,
          verification: true,
        },
      };
    }
    if (String(path).startsWith('/admin/users')) {
      return {
        items: [
          {
            user_id: 'u2',
            email: 'member@example.com',
            role: 'user',
            is_active: true,
            public_display_name: 'Member',
            created_at: null,
            memberships: [{ business_id: 'b1', business_name: 'Ada Marka', business_slug: 'ada', role: 'owner' }],
          },
        ],
      };
    }
    if (String(path).startsWith('/applications/') && String(path).endsWith('/events')) {
      return {
        items: [
          {
            id: 'ev-1',
            action: 'submitted',
            from_status: null,
            to_status: 'received',
            created_at: '2026-10-18T10:00:00Z',
            actor_user_id: 'u1',
          },
        ],
      };
    }
    return { items: [] };
  });
});

describe('Platform Admin', () => {
  it('denies users without bilign.platform_admin capability', async () => {
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [], canProvision: false };
      if (path === '/admin/overview') throw new BusinessApiError(403, 'platform_admin_required');
      return { items: [] };
    });
    render(<SainaPlatformAdmin />);
    expect(await screen.findByRole('heading', { name: 'Platform Yönetimi' })).toBeVisible();
    expect(screen.getByText(/aktif bilign\.platform_admin yetkisine/i)).toBeVisible();
    expect(screen.getByText(/EZA rolü yeterli değildir/i)).toBeVisible();
  });

  it('redirects anonymous users to admin login', async () => {
    auth.isAuthenticated = false;
    render(<SainaPlatformAdmin />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/standalone/admin/login');
    });
  });

  it('shows real overview totals and applications section', async () => {
    render(<SainaPlatformAdmin />);
    expect(await screen.findByText('Toplam marka')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('Onay bekleyen başvuru')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Marka Başvuruları' }));
    // Detail opens only after explicit list selection (Listeye dön can close it).
    const listRow = await screen.findByRole('button', { name: /Ada Marka/i });
    fireEvent.click(listRow);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ada Marka' })).toBeVisible();
    });
    expect(screen.getByRole('button', { name: '← Listeye dön' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'İncelemeye al' })).toBeVisible();
    expect(screen.getAllByText('Alındı').length).toBeGreaterThan(0);
  });

  it('renders brands table without dominant UUID and empty publications state', async () => {
    render(<SainaPlatformAdmin />);
    await screen.findByText('Toplam marka');
    fireEvent.click(screen.getByRole('button', { name: 'Markalar' }));
    expect(await screen.findByRole('columnheader', { name: 'Marka' })).toBeVisible();
    expect(screen.getByText('owner@example.com')).toBeVisible();
    expect(screen.queryByText('b1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yayın Denetimi' }));
    expect(await screen.findByText('Yayın yok')).toBeVisible();
  });

  it('allows granting platform admin from user search results', async () => {
    render(<SainaPlatformAdmin />);
    await screen.findByText('Toplam marka');
    fireEvent.click(screen.getByRole('button', { name: 'Kullanıcılar' }));
    fireEvent.change(screen.getByLabelText(/e-posta veya görünen ad/i), {
      target: { value: 'member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ara' }));
    expect(await screen.findByText('member@example.com')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Yetki ver' }));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        '/admin/capabilities/grant',
        'POST',
        expect.objectContaining({ userId: 'u2', capability: 'bilign.platform_admin' })
      );
    });
  });
});
