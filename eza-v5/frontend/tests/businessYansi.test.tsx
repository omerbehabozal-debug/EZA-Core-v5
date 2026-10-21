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
    expect(screen.queryByRole('button', { name: 'Bilgiyi kaydet' })).not.toBeInTheDocument();
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

  it('keeps knowledge list-first without review/approve/publish controls', async () => {
    let knowledgeItems = [
      {
        id: 'kb-1',
        item_id: 'item-1',
        title: 'Menü hikâyesi',
        category: 'ürün',
        content: 'Zeytinyağlı yaprak dolması…',
        source: 'Marka kitabı',
        public_allowed: true,
        status: 'published',
        version: 1,
        revision: 1,
      },
    ];
    api.mockImplementation(async (path = '', method = 'GET', body?: unknown) => {
      if (path === '') return { items: [business], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business, role: 'editor', publications: [] };
      if (String(path).endsWith('/knowledge') && method === 'GET') return { items: knowledgeItems };
      if (String(path).endsWith('/knowledge') && method === 'POST') {
        const payload = body as Record<string, unknown>;
        const created = {
          id: 'kb-2',
          item_id: typeof payload.itemId === 'string' ? payload.itemId : 'item-2',
          title: String(payload.title || ''),
          category: String(payload.category || ''),
          content: String(payload.content || ''),
          source: String(payload.source || ''),
          public_allowed: Boolean(payload.publicAllowed),
          status: 'published',
          version: 1,
          revision: 1,
        };
        knowledgeItems = [created, ...knowledgeItems];
        return created;
      }
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Bilgi Havuzu' }));

    expect(screen.getByTestId('biz-knowledge-list')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-knowledge-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('biz-knowledge-new')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'İncelemeye gönder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Onayla' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bilgiyi yayımla' })).not.toBeInTheDocument();
    expect(screen.queryByText('published')).not.toBeInTheDocument();
    expect(screen.getByText('Kullanıcılara açık')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('biz-knowledge-new'));
    expect(screen.getByTestId('biz-knowledge-form')).toHaveAttribute('data-mode', 'create');
    expect(screen.getByTestId('biz-knowledge-save')).toHaveTextContent('Bilgiyi kaydet');
    expect(screen.getByLabelText('Bilgi başlığı')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Bilgi başlığı'), { target: { value: 'Sofra ritüeli' } });
    fireEvent.change(screen.getByLabelText('Bilgi içeriği'), { target: { value: 'Paylaşım kültürü' } });
    fireEvent.change(screen.getByPlaceholderText('Kaynak bağlantısı veya açıklaması'), {
      target: { value: 'Operasyon notu' },
    });
    fireEvent.click(screen.getByTestId('biz-knowledge-save'));
    await waitFor(() => {
      expect(screen.queryByTestId('biz-knowledge-form')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('biz-knowledge-new')).toBeInTheDocument();
    const cards = screen.getAllByTestId(/biz-knowledge-card-/);
    expect(cards[0]).toHaveTextContent('Sofra ritüeli');

    fireEvent.click(screen.getByTestId('biz-knowledge-new'));
    expect(screen.getByLabelText('Bilgi başlığı')).toHaveValue('');
    expect(screen.getByLabelText('Bilgi içeriği')).toHaveValue('');
    fireEvent.click(screen.getByTestId('biz-knowledge-back-list'));

    fireEvent.click(screen.getByTestId('biz-knowledge-edit-kb-1'));
    expect(screen.getByTestId('biz-knowledge-form')).toHaveAttribute('data-mode', 'edit');
    expect(screen.getByTestId('biz-knowledge-save')).toHaveTextContent('Güncelle');
    expect(screen.getByLabelText('Bilgi başlığı')).toHaveValue('Menü hikâyesi');
  });

  it('keeps knowledge form open with values when save fails and warns on dirty exit', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.mockImplementation(async (path = '', method = 'GET') => {
      if (path === '') return { items: [business], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business, role: 'editor', publications: [] };
      if (String(path).endsWith('/knowledge') && method === 'GET') return { items: [] };
      if (String(path).endsWith('/knowledge') && method === 'POST') {
        throw new BusinessApiError(422, 'public_content_review_required');
      }
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Bilgi Havuzu' }));
    fireEvent.click(screen.getByTestId('biz-knowledge-new'));
    fireEvent.change(screen.getByLabelText('Bilgi başlığı'), { target: { value: 'Taslak başlık' } });
    fireEvent.change(screen.getByLabelText('Bilgi içeriği'), { target: { value: 'Taslak içerik' } });
    fireEvent.change(screen.getByPlaceholderText('Kaynak bağlantısı veya açıklaması'), {
      target: { value: 'Kaynak' },
    });
    fireEvent.click(screen.getByTestId('biz-knowledge-save'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByTestId('biz-knowledge-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Bilgi başlığı')).toHaveValue('Taslak başlık');
    fireEvent.click(screen.getByTestId('biz-knowledge-cancel'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByTestId('biz-knowledge-form')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('supports knowledge search, detail, delete-by-id and cancels delete', async () => {
    let knowledgeItems = [
      {
        id: 'kb-a',
        item_id: 'item-a',
        title: 'BiligN Nedir?',
        category: 'marka',
        content: 'Birinci kayıt — BiligN marka tanımı.',
        source: 'Marka kitabı',
        public_allowed: true,
        status: 'published',
        version: 1,
        revision: 1,
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-02T10:00:00Z',
      },
      {
        id: 'kb-b',
        item_id: 'item-b',
        title: 'BiligN Nedir?',
        category: 'ürün',
        content: 'İkinci kayıt — ürün deneyimi özeti.',
        source: 'Ürün notu',
        public_allowed: false,
        status: 'published',
        version: 1,
        revision: 2,
        created_at: '2026-10-03T10:00:00Z',
        updated_at: '2026-10-04T10:00:00Z',
      },
    ];
    api.mockImplementation(async (path = '', method = 'GET', body?: unknown) => {
      if (path === '') return { items: [business], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business, role: 'editor', publications: [] };
      if (String(path).endsWith('/knowledge') && method === 'GET') return { items: knowledgeItems };
      if (String(path).includes('/knowledge/') && method === 'DELETE') {
        const id = String(path).split('/').pop();
        const payload = body as { revision?: number };
        const row = knowledgeItems.find((k) => k.id === id);
        expect(row).toBeTruthy();
        expect(payload.revision).toBe(row?.revision);
        knowledgeItems = knowledgeItems.filter((k) => k.id !== id);
        return { ...row, status: 'archived', revision: (row?.revision || 1) + 1 };
      }
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Bilgi Havuzu' }));

    expect(screen.getByTestId('biz-knowledge-count')).toHaveTextContent('2 bilgi');
    expect(screen.getByText('Kapalı')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('biz-knowledge-search'), { target: { value: 'ürün deneyimi' } });
    expect(screen.getByTestId('biz-knowledge-count')).toHaveTextContent('1 bilgi');
    expect(screen.getByTestId('biz-knowledge-card-kb-b')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-knowledge-card-kb-a')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('biz-knowledge-search'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('biz-knowledge-category'), { target: { value: 'marka' } });
    expect(screen.getByTestId('biz-knowledge-count')).toHaveTextContent('1 bilgi');
    fireEvent.change(screen.getByTestId('biz-knowledge-category'), { target: { value: 'all' } });

    fireEvent.click(screen.getByTestId('biz-knowledge-open-kb-a'));
    expect(screen.getByTestId('biz-knowledge-detail')).toHaveTextContent('Birinci kayıt — BiligN marka tanımı.');
    expect(screen.getByTestId('biz-knowledge-detail')).toHaveTextContent('Kaynak: Marka kitabı');

    fireEvent.click(screen.getByTestId('biz-knowledge-delete-kb-a'));
    expect(screen.getByTestId('biz-knowledge-delete-dialog')).toHaveTextContent('BiligN Nedir?');
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByTestId('biz-knowledge-delete-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('biz-knowledge-card-kb-a')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('biz-knowledge-delete-kb-a'));
    fireEvent.click(screen.getByTestId('biz-knowledge-delete-confirm'));
    await waitFor(() => {
      expect(screen.queryByTestId('biz-knowledge-card-kb-a')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('biz-knowledge-card-kb-b')).toBeInTheDocument();
    expect(screen.getByTestId('biz-knowledge-count')).toHaveTextContent('1 bilgi');
    expect(api).toHaveBeenCalledWith('/business-a/knowledge/kb-a', 'DELETE', { revision: 1 });
  });

  it('disables knowledge save while a request is in flight', async () => {
    let resolvePost: ((value: unknown) => void) | undefined;
    api.mockImplementation(async (path = '', method = 'GET', body?: unknown) => {
      if (path === '') return { items: [business], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business, role: 'editor', publications: [] };
      if (String(path).endsWith('/knowledge') && method === 'GET') return { items: [] };
      if (String(path).endsWith('/knowledge') && method === 'POST') {
        return await new Promise((resolve) => {
          resolvePost = resolve;
        });
      }
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Bilgi Havuzu' }));
    fireEvent.click(screen.getByTestId('biz-knowledge-new'));
    fireEvent.change(screen.getByLabelText('Bilgi başlığı'), { target: { value: 'Tek kayıt' } });
    fireEvent.change(screen.getByLabelText('Bilgi içeriği'), { target: { value: 'İçerik' } });
    fireEvent.change(screen.getByPlaceholderText('Kaynak bağlantısı veya açıklaması'), {
      target: { value: 'Kaynak' },
    });
    fireEvent.click(screen.getByTestId('biz-knowledge-save'));
    await waitFor(() => {
      expect(screen.getByTestId('biz-knowledge-save')).toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('biz-knowledge-save'));
    const postCalls = api.mock.calls.filter(
      (call) => String(call[0]).endsWith('/knowledge') && call[1] === 'POST'
    );
    expect(postCalls).toHaveLength(1);
    resolvePost?.({
      id: 'kb-new',
      item_id: 'item-new',
      title: 'Tek kayıt',
      category: '',
      content: 'İçerik',
      source: 'Kaynak',
      public_allowed: true,
      status: 'published',
      version: 1,
      revision: 1,
    });
    await waitFor(() => {
      expect(screen.queryByTestId('biz-knowledge-form')).not.toBeInTheDocument();
    });
  });

  it('opens stepped Yansı Stüdyosu without default eight-step manual form', async () => {
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [business], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business, role: 'editor', publications: [] };
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Yansı Stüdyosu' }));
    expect(screen.getByTestId('biz-yansi-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('biz-yansi-studio')).toHaveAttribute('data-phase', 'sources');
    expect(screen.getByTestId('biz-studio-step-rail')).toBeInTheDocument();
    expect(screen.getByTestId('biz-studio-no-sources')).toBeInTheDocument();
    expect(screen.getByTestId('biz-studio-goto-knowledge')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-studio-manual-form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Onayla' })).not.toBeInTheDocument();
    const engineToggle = screen.getByTestId('biz-engine-toggle');
    expect(engineToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('biz-engine-form')).not.toBeInTheDocument();
    fireEvent.click(engineToggle);
    expect(screen.getByTestId('biz-engine-form')).toBeInTheDocument();
    expect(engineToggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(engineToggle);
    expect(screen.queryByTestId('biz-engine-form')).not.toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: /İkinci Bilgi/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Birinci Bilgi/ })).not.toBeInTheDocument();
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

  it('updates the panel brand mark from the business profile and leaves the signed-in user unchanged', async () => {
    auth.user = {
      email: 'owner@example.test',
      user_id: 'u1',
      role: 'user',
      full_name: 'Tarık Ayşe',
      public_avatar_url: '/api/public/profile-avatars/11111111-1111-4111-8111-111111111111.png',
    } as typeof auth.user;
    const brandLogo = '/api/public/profile-avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png';
    let profile = { ...business, updated_at: '2026-10-01T00:00:00Z' };
    api.mockImplementation(async (path = '', method = 'GET', body?: unknown) => {
      if (path === '') return { items: [profile], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business: profile, role: 'owner', publications: [] };
      if (String(path).endsWith('/members')) return { items: [] };
      if (String(path).endsWith('/settings') && method === 'PATCH') {
        const payload = body as { name?: string };
        profile = {
          ...profile,
          name: String(payload.name || profile.name),
          logo_url: brandLogo,
          updated_at: '2026-10-02T00:00:00Z',
        };
        return profile;
      }
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    expect(await screen.findByTestId('biz-panel-brand-name')).toHaveTextContent('BiligN');
    expect(screen.getByTestId('biz-panel-brand')).toHaveTextContent('B');
    expect(screen.getByTestId('biz-panel-brand').querySelector('img')).toBeNull();
    expect(screen.getByTestId('biz-account-name')).toHaveTextContent('Tarık Ayşe');

    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    fireEvent.change(screen.getByLabelText('Marka adı'), { target: { value: 'Akdeniz' } });
    fireEvent.click(screen.getByTestId('biz-brand-save'));

    await waitFor(() => {
      expect(screen.getByTestId('biz-panel-brand-name')).toHaveTextContent('Akdeniz');
    });
    const brandImage = screen.getByTestId('biz-panel-brand').querySelector('img');
    expect(brandImage).toHaveAttribute('src', expect.stringContaining('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png'));
    expect(brandImage).toHaveAttribute('src', expect.stringContaining('v=2026-10-02'));
    expect(screen.getByTestId('biz-panel-brand')).not.toHaveTextContent('A');
    expect(screen.getByTestId('biz-account-name')).toHaveTextContent('Tarık Ayşe');
    expect(screen.getByTestId('bilign-profile-avatar-photo')).toHaveAttribute(
      'src',
      expect.stringContaining('11111111-1111-4111-8111-111111111111.png')
    );
  });

  it('lets the owner replace the brand avatar from settings', async () => {
    api.mockImplementation(async (path = '') => {
      if (path === '') return { items: [business], canProvision: false };
      if (path === '/applications/mine') return { items: [] };
      if (String(path).endsWith('/overview')) return { business, role: 'owner', publications: [] };
      if (String(path).endsWith('/members')) return { items: [] };
      return { items: [] };
    });
    render(<SainaBusinessManager />);
    await screen.findByText('BiligN', { selector: 'h2' });
    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    expect(screen.getByLabelText('Marka avatarı')).toHaveAttribute('type', 'file');
    expect(screen.getByTestId('biz-brand-logo-preview')).toHaveTextContent('Varsayılan marka avatarı');
    expect(screen.queryByLabelText('Logo URL')).not.toBeInTheDocument();
  });

  it('keeps an unverified business publisher without a verified badge', () => {
    const raw = {
      slug: 'source',
      journeyVersion: 1,
      authorUserId: 'brand-b',
      selectedCount: 8,
      replayReady: true,
      businessPublisher: {
        businessId: 'brand-b',
        slug: 'akdeniz',
        displayName: 'Akdeniz',
        logoUrl: null,
        verified: false,
        official: true,
      },
      steps: Array.from({ length: 8 }, (_, i) => ({
        stepIndex: i + 1,
        publicQuestion: 'Question',
        publicAnswer: 'Answer',
      })),
    };
    const parsed = parsePublicFrozenJourneyArtifact(raw);
    expect(parsed?.businessPublisher?.displayName).toBe('Akdeniz');
    expect(parsed?.businessPublisher?.verified).toBe(false);
    expect(parsed?.businessPublisher?.official).toBe(false);
    expect(parsed?.authorUserId).toBe('brand-b');
  });

  it('leaves personal Yansı author identity untouched', () => {
    const raw = {
      slug: 'source',
      journeyVersion: 1,
      authorUserId: 'person-1',
      selectedCount: 8,
      replayReady: true,
      steps: Array.from({ length: 8 }, (_, i) => ({
        stepIndex: i + 1,
        publicQuestion: 'Question',
        publicAnswer: 'Answer',
      })),
    };
    const parsed = parsePublicFrozenJourneyArtifact(raw);
    expect(parsed?.authorUserId).toBe('person-1');
    expect(parsed?.businessPublisher).toBeUndefined();
  });
});
