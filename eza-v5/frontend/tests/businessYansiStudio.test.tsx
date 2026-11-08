/**
 * Stage 3 — AI Yansı Stüdyosu UX (honest API states, no fake success).
 */
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessYansiStudio from '@/components/saina/business-studio/BusinessYansiStudio';
import type { BrandAsset, Draft, Knowledge } from '@/lib/eza/businessYansi';
import {
  isSuccessStudioStatus,
  parseDraftResult,
  parseTopicsResult,
  studioErrorMessage,
  studioStatusLabel,
} from '@/lib/eza/businessStudio';

const knowledge: Knowledge[] = [
  {
    id: 'kb-1',
    item_id: 'item-1',
    title: 'Menü hikâyesi',
    category: 'ürün',
    content: 'Zeytinyağlı yaprak dolması…',
    source: 'Marka kitabı',
    public_allowed: true,
    status: 'published',
    version: 2,
    revision: 1,
  },
  {
    id: 'kb-draft',
    item_id: 'item-2',
    title: 'Taslak bilgi',
    category: 'ürün',
    content: 'Henüz yayında değil',
    source: 'iç',
    public_allowed: true,
    status: 'draft',
    version: 1,
    revision: 1,
  },
];

const apiMocks = vi.hoisted(() => ({
  businessRequest: vi.fn(),
  fetchBrandAssetPreview: vi.fn().mockResolvedValue("blob:studio-image"),
  fetchBrandVideoPreview: vi.fn().mockResolvedValue("https://backend.example/private-video?ticket=test"),
}));

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>(
    '@/lib/eza/businessYansi'
  );
  return {
    ...actual,
    ...apiMocks,
  };
});

vi.mock('@/components/standalone/ChatBubble', () => ({
  default: ({
    message,
    isUser,
    renderedBody,
  }: {
    message: string;
    isUser: boolean;
    renderedBody?: ReactNode;
  }) => (
    <div data-testid={isUser ? 'mock-bubble-user' : 'mock-bubble-ai'}>
      {renderedBody ?? message}
    </div>
  ),
}));

function gen(partial: Record<string, unknown>) {
  return {
    generationId: '11111111-1111-1111-1111-111111111111',
    businessId: '22222222-2222-2222-2222-222222222222',
    kind: 'topics',
    status: 'blocked',
    executionAvailable: false,
    result: null,
    snapshotHash: 'a'.repeat(64),
    sources: [],
    model: null,
    promptVersion: 'business-studio-extractive-v1',
    attemptCount: 0,
    maxAttempts: 2,
    reservedInputTokens: 20000,
    reservedOutputTokens: 6000,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: '0',
    costLimitUsd: '0.10',
    errorCode: 'studio_execution_not_implemented',
    draftId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe('businessStudio helpers', () => {
  it('maps statuses and Turkish error copy', () => {
    expect(studioStatusLabel('queued')).toBe('Sırada');
    expect(studioStatusLabel('completed')).toBe('Tamamlandı');
    expect(isSuccessStudioStatus('completed')).toBe(true);
    expect(studioErrorMessage('studio_admission_disabled')).toMatch(/açık değil/i);
  });

  it('parses topic and draft results without inventing data', () => {
    expect(parseTopicsResult(null)).toBeNull();
    expect(parseTopicsResult({ topics: [{ id: 'topic-1', title: 'A', description: 'B' }] })).toEqual([
      expect.objectContaining({ id: 'topic-1', title: 'A' }),
    ]);
    expect(parseDraftResult({ title: 'T', summary: 'S', steps: [] })).toBeNull();
  });
});

describe('BusinessYansiStudio', () => {
  beforeEach(() => {
    apiMocks.businessRequest.mockReset();
  });

  it.each([true, false])('renders saved revision media or an empty notice (%s)', async (hasAssignments) => {
    const steps = Array.from({ length: 8 }, (_, index) => ({
      question: `Soru ${index + 1}`, answer: `Cevap ${index + 1}`, sources: ['kb-1'],
    }));
    const draft: Draft = {
      id: 'draft-1', title: 'Taslak', summary: 'Özet', revision: 4, steps, status: 'draft', conversation_id: null,
    };
    const blocks = Array.from({ length: 8 }, (_, index) => {
      if (!hasAssignments) return [];
      if (index === 0) return [{ type: 'image', assetId: 'img', title: 'Fotoğraf', authenticated: true }];
      if (index === 2) return [{ type: 'video', assetId: 'vid', title: 'Film', authenticated: true }];
      if (index === 7) return [
        { type: 'map', assetId: 'place', title: 'Konum', latitude: '40', longitude: '29' },
        { type: 'link', assetId: 'link', title: 'Bağlantı', href: 'https://example.test' },
      ];
      return [];
    });
    apiMocks.businessRequest.mockResolvedValue({ revision: 4, steps, blocks, hasAssignments });
    render(<BusinessYansiStudio businessId="biz-1" knowledge={knowledge} canEdit editDraft={draft} onDraftSaved={vi.fn()} />);
    await screen.findByText(hasAssignments ? 'Kaydedilmiş taslak · Revizyon 4' : 'Bu sohbete medya eklenmemiş.');
    expect(apiMocks.businessRequest).toHaveBeenCalledWith('/biz-1/drafts/draft-1/media-preview?revision=4');
    expect(screen.getAllByTestId('mock-bubble-ai')).toHaveLength(8);
    if (!hasAssignments) {
      expect(screen.queryByTestId('business-media-blocks')).toBeNull();
      return;
    }
    expect(await within(screen.getByTestId('biz-studio-turn-0')).findByRole('img', { name: 'Fotoğraf' })).toHaveAttribute('src', 'blob:studio-image');
    expect(await within(screen.getByTestId('biz-studio-turn-2')).findByTestId('biz-video-vid')).toHaveAttribute('controls');
    expect(within(screen.getByTestId('biz-studio-turn-7')).getByTestId('business-media-map')).toBeInTheDocument();
    expect(within(screen.getByTestId('biz-studio-turn-7')).getByTestId('business-media-link')).toBeInTheDocument();
    expect(apiMocks.fetchBrandAssetPreview).toHaveBeenCalledWith('biz-1', 'img');
    expect(apiMocks.fetchBrandVideoPreview).toHaveBeenCalledWith('biz-1', 'vid');
  });

  it('does not display a media response for a different revision', async () => {
    const steps = Array.from({ length: 8 }, () => ({ question: 'Soru', answer: 'Cevap', sources: ['kb-1'] }));
    const draft: Draft = {
      id: 'draft-1', title: 'Taslak', summary: 'Özet', revision: 4, steps, status: 'draft', conversation_id: null,
    };
    apiMocks.businessRequest.mockResolvedValue({
      revision: 3, steps, hasAssignments: true,
      blocks: [[{ type: 'link', assetId: 'stale', title: 'Eski bağlantı', href: 'https://example.test' }]],
    });
    render(<BusinessYansiStudio businessId="biz-1" knowledge={knowledge} canEdit editDraft={draft} onDraftSaved={vi.fn()} />);
    await screen.findByText('Kaydedilmiş revizyonun medyası alınamadı. Taslağı yeniden açın.');
    expect(screen.queryByText('Eski bağlantı')).toBeNull();
    expect(screen.getAllByTestId('mock-bubble-ai')).toHaveLength(8);
  });

  it('lists only published public knowledge and blocks topic suggest without selection', () => {
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        onDraftSaved={vi.fn()}
      />
    );
    expect(screen.getByText('Menü hikâyesi')).toBeInTheDocument();
    expect(screen.queryByText('Taslak bilgi')).toBeNull();
    expect(screen.getByTestId('biz-studio-suggest-topics')).toBeDisabled();
  });

  it('shows honest unavailable when Stage 1 admission returns blocked', async () => {
    apiMocks.businessRequest.mockResolvedValueOnce(
      gen({ status: 'blocked', executionAvailable: false, errorCode: 'studio_execution_not_implemented' })
    );
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        onDraftSaved={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('biz-studio-source-kb-1'));
    fireEvent.click(screen.getByTestId('biz-studio-suggest-topics'));
    await waitFor(() => {
      expect(screen.getByTestId('biz-studio-unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('biz-studio-topic-grid')).toBeNull();
    expect(apiMocks.businessRequest).toHaveBeenCalledWith(
      '/biz-1/studio/topics',
      'POST',
      expect.objectContaining({ sourceVersionIds: ['kb-1'] })
    );
  });

  it('shows topic cards only from real completed result and prevents duplicate in-flight clicks', async () => {
    let resolveTopics: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveTopics = resolve;
    });
    apiMocks.businessRequest.mockReturnValueOnce(pending);

    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        onDraftSaved={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('biz-studio-source-kb-1'));
    const suggest = screen.getByTestId('biz-studio-suggest-topics');
    fireEvent.click(suggest);
    fireEvent.click(suggest);
    expect(apiMocks.businessRequest).toHaveBeenCalledTimes(1);

    resolveTopics(
      gen({
        kind: 'topics',
        status: 'completed',
        executionAvailable: true,
        errorCode: null,
        result: {
          topics: [
            {
              id: 'topic-1',
              title: 'Zeytinyağlı gelenek',
              description: 'Dolma ve misafirlik',
              evidence: [{ text: 'Zeytinyağlı yaprak dolması…', versionId: 'kb-1', version: 2 }],
            },
            {
              id: 'topic-2',
              title: 'Sofra ritüeli',
              description: 'Paylaşım kültürü',
            },
          ],
        },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('biz-studio-topic-grid')).toBeInTheDocument();
    });
    expect(screen.getByTestId('biz-studio-topic-topic-1')).toHaveTextContent('Zeytinyağlı gelenek');
    expect(within(screen.getByTestId('biz-studio-topic-topic-1')).getByText(/Dolma/)).toBeInTheDocument();
  });

  it('renders eight-step chat preview from completed draft generation', async () => {
    const steps = Array.from({ length: 8 }, (_, i) => ({
      question: `Soru ${i + 1}?`,
      answer: `Cevap ${i + 1}`,
      evidence: {
        versionId: 'kb-1',
        version: 2,
        contentHash: 'b'.repeat(64),
        start: 0,
        end: 10,
        text: `Pasaj ${i + 1}`,
        passageHash: 'c'.repeat(64),
      },
    }));

    apiMocks.businessRequest
      .mockResolvedValueOnce(
        gen({
          status: 'completed',
          executionAvailable: true,
          errorCode: null,
          generationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          result: {
            topics: [{ id: 'topic-1', title: 'Konu', description: 'Açıklama' }],
          },
        })
      )
      .mockResolvedValueOnce(
        gen({
          kind: 'draft',
          status: 'completed',
          executionAvailable: true,
          errorCode: null,
          draftId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          result: { title: 'Üretilen başlık', summary: 'Özet', steps },
        })
      );

    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        onDraftSaved={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('biz-studio-source-kb-1'));
    fireEvent.click(screen.getByTestId('biz-studio-suggest-topics'));
    await waitFor(() => screen.getByTestId('biz-studio-generate-topic-1'));
    fireEvent.click(screen.getByTestId('biz-studio-generate-topic-1'));
    await waitFor(() => {
      expect(screen.getByTestId('biz-studio-chat-preview')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('mock-bubble-user')).toHaveLength(8);
    expect(screen.getAllByTestId('mock-bubble-ai')).toHaveLength(8);
    expect(screen.getByDisplayValue('Üretilen başlık')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-studio-topic-grid')).toBeNull();
    expect(screen.queryByTestId('biz-studio-manual-form')).toBeNull();

    fireEvent.click(screen.getByTestId('biz-studio-edit-step-0'));
    expect(screen.getByTestId('biz-studio-step-editor-0')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-studio-step-editor-1')).toBeNull();

    fireEvent.click(screen.getByTestId('biz-studio-toggle-manual'));
    expect(screen.getByTestId('biz-studio-manual-form')).toBeInTheDocument();
  });

  it('empty knowledge shows Bilgi Havuzu CTA and hides manual eight-step form', () => {
    const onOpen = vi.fn();
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={[]}
        canEdit
        onDraftSaved={vi.fn()}
        onOpenKnowledgePool={onOpen}
      />
    );
    expect(screen.getByTestId('biz-studio-no-sources')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-studio-manual-form')).toBeNull();
    expect(screen.queryByTestId('biz-studio-suggest-topics')).toBeNull();
    fireEvent.click(screen.getByTestId('biz-studio-goto-knowledge'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('shows the business brand, not a personal author, on preview', () => {
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        onDraftSaved={vi.fn()}
        brand={{
          name: 'Akdeniz',
          logoUrl: '/api/public/profile-avatars/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png',
          cacheBust: '2026-10-02T00:00:00Z',
          verified: false,
          official: false,
        }}
        editDraft={{
          id: 'draft-1',
          title: 'Marka Yansısı',
          summary: 'Özet',
          status: 'draft',
          revision: 1,
          conversation_id: null,
          steps: Array.from({ length: 8 }, () => ({
            question: 'Soru',
            answer: 'Cevap',
            sources: ['kb-1'],
          })),
        }}
      />
    );
    const publisher = screen.getByTestId('biz-studio-publisher');
    expect(publisher).toHaveTextContent('Akdeniz');
    expect(publisher).not.toHaveTextContent('Doğrulanmış');
    expect(screen.queryByText('Tarık Ayşe')).not.toBeInTheDocument();
    expect(within(publisher).getByTestId('bilign-profile-avatar-photo')).toHaveAttribute(
      'src',
      expect.stringContaining('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png')
    );
  });

  it('locks preview rail until a real draft exists', () => {
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        onDraftSaved={vi.fn()}
      />
    );
    expect(screen.getByTestId('biz-studio-rail-preview')).toHaveAttribute('data-state', 'locked');
    expect(screen.getByTestId('biz-yansi-studio')).toHaveAttribute('data-phase', 'sources');
  });

  it('surfaces admission-disabled without inventing topics', async () => {
    const { BusinessApiError } = await import('@/lib/eza/businessYansi');
    apiMocks.businessRequest.mockRejectedValueOnce(
      new BusinessApiError(503, { code: 'studio_admission_disabled' })
    );
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        onDraftSaved={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('biz-studio-source-kb-1'));
    fireEvent.click(screen.getByTestId('biz-studio-suggest-topics'));
    await waitFor(() => {
      expect(screen.getByTestId('biz-studio-unavailable')).toHaveTextContent(/açık değil/i);
    });
    expect(screen.queryByTestId('biz-studio-topic-grid')).toBeNull();
  });

  it('lets the brand choose an image or video cover and shows that choice', async () => {
    const link = {
      id: 'link-1',
      item_id: 'item-1',
      confirmed_version_id: 'kb-1',
      status: 'active',
      knowledge_title: 'Menü hikâyesi',
      knowledge_status: 'published',
      current_published_version_id: 'kb-1',
      confirmation_current: true,
    };
    const image: BrandAsset = {
      id: '11111111-1111-4111-8111-111111111111',
      business_id: 'biz-1',
      asset_type: 'image',
      title: 'Atolye gorseli',
      caption: '',
      locator_kind: 'storage',
      locator: null,
      latitude: null,
      longitude: null,
      public_allowed: true,
      status: 'active',
      revision: 2,
      links: [link],
    };
    const film: BrandAsset = {
      ...image,
      id: '22222222-2222-4222-8222-222222222222',
      asset_type: 'video',
      title: 'Atolye filmi',
      locator_kind: 'https',
      locator: 'https://cdn.bilign.example/atolye.mp4',
    };
    const foreign: BrandAsset = {
      ...film,
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Baska marka',
      links: [{ ...link, id: 'link-2', confirmed_version_id: 'other-brand' }],
    };
    const steps = Array.from({ length: 8 }, (_, index) => ({
      question: `Soru ${index + 1}?`,
      answer: 'Zeytinyağlı yaprak dolması…',
      sources: ['kb-1'],
    }));
    const editDraft: Draft = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      title: 'Atolye',
      summary: 'Atolye ozeti',
      steps,
      status: 'draft',
      revision: 1,
      conversation_id: null,
      media_plan: { coverAssetId: null, blocks: [], seal: null },
    };
    apiMocks.businessRequest.mockResolvedValue({});
    render(
      <BusinessYansiStudio
        businessId="biz-1"
        knowledge={knowledge}
        canEdit
        editDraft={editDraft}
        assets={[image, film, foreign]}
        onDraftSaved={vi.fn()}
      />
    );
    const choice = screen.getByTestId('biz-studio-cover-choice');
    expect(choice).not.toHaveTextContent('Baska marka');
    expect(screen.getByTestId('biz-studio-selected-cover')).toHaveTextContent('onay bekleniyor');
    fireEvent.click(screen.getByRole('button', { name: 'Görsel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atolye gorseli' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bu kapağı kullan' }));
    expect(screen.getByTestId('biz-studio-selected-cover')).toHaveTextContent('Seçilen kapak: Atolye gorseli · görsel');
    fireEvent.click(screen.getByRole('button', { name: 'Video' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atolye filmi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bu kapağı kullan' }));
    expect(screen.getByTestId('biz-studio-selected-cover')).toHaveTextContent('Seçilen kapak: Atolye filmi · video');
    fireEvent.click(screen.getByTestId('biz-studio-save-draft'));
    await waitFor(() => expect(apiMocks.businessRequest).toHaveBeenCalled());
    const body = apiMocks.businessRequest.mock.calls.find((call) => call[1] === 'PATCH')![2] as { coverAssetId: string; coverKind: string };
    expect(body.coverAssetId).toBe(film.id);
    expect(body.coverKind).toBe('video');
    expect(JSON.stringify(body)).not.toContain('atolye.mp4');
  });
});
