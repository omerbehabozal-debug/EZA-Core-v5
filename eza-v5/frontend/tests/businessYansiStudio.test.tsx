/**
 * Stage 3 — AI Yansı Stüdyosu UX (honest API states, no fake success).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessYansiStudio from '@/components/saina/business-studio/BusinessYansiStudio';
import type { Knowledge } from '@/lib/eza/businessYansi';
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
}));

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>(
    '@/lib/eza/businessYansi'
  );
  return {
    ...actual,
    businessRequest: apiMocks.businessRequest,
  };
});

vi.mock('@/components/standalone/ChatBubble', () => ({
  default: ({ message, isUser }: { message: string; isUser: boolean }) => (
    <div data-testid={isUser ? 'mock-bubble-user' : 'mock-bubble-ai'}>{message}</div>
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
    expect(screen.getByText('Üretilen başlık')).toBeInTheDocument();
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
});
