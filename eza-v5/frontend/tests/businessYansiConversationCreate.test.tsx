/**
 * Stage 02B — esnek conversation Studio UI.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessYansiConversationCreate from '@/components/saina/business-studio/BusinessYansiConversationCreate';
import type { BrandAsset, Knowledge } from '@/lib/eza/businessYansi';
import { yansiV2PublicHref } from '@/lib/eza/businessYansi';

const BIZ = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const KV = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const DRAFT = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const apiMocks = vi.hoisted(() => ({
  createYansiV2ConversationDraft: vi.fn(),
  reviseYansiV2ConversationDraft: vi.fn(),
  transitionYansiV2ConversationDraft: vi.fn(),
  publishYansiV2ConversationDraft: vi.fn(),
  publishYansiV2Image: vi.fn(),
  getYansiV2ConversationDraft: vi.fn(),
  requestYansiV2ConversationProposal: vi.fn(),
  pollYansiV2ConversationProposal: vi.fn(),
  applyYansiV2ConversationProposal: vi.fn(),
  uploadBrandImage: vi.fn(),
  fetchBrandAssetPreview: vi.fn().mockResolvedValue('blob:conv-preview'),
  isBusinessApiError: (error: unknown) =>
    !!error && typeof error === 'object' && (error as { name?: string }).name === 'BusinessApiError',
}));

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>(
    '@/lib/eza/businessYansi',
  );
  return {
    ...actual,
    createYansiV2ConversationDraft: apiMocks.createYansiV2ConversationDraft,
    reviseYansiV2ConversationDraft: apiMocks.reviseYansiV2ConversationDraft,
    transitionYansiV2ConversationDraft: apiMocks.transitionYansiV2ConversationDraft,
    publishYansiV2ConversationDraft: apiMocks.publishYansiV2ConversationDraft,
    publishYansiV2Image: apiMocks.publishYansiV2Image,
    getYansiV2ConversationDraft: apiMocks.getYansiV2ConversationDraft,
    requestYansiV2ConversationProposal: apiMocks.requestYansiV2ConversationProposal,
    pollYansiV2ConversationProposal: apiMocks.pollYansiV2ConversationProposal,
    applyYansiV2ConversationProposal: apiMocks.applyYansiV2ConversationProposal,
    uploadBrandImage: apiMocks.uploadBrandImage,
    fetchBrandAssetPreview: apiMocks.fetchBrandAssetPreview,
    isBusinessApiError: apiMocks.isBusinessApiError,
  };
});

async function openSourcePicker() {
  const toggle = screen.getByTestId('biz-conv-bind');
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(toggle);
  }
  await screen.findByTestId('biz-conv-bind-panel');
}

function image(partial: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id: ASSET,
    business_id: BIZ,
    asset_type: 'image',
    title: 'Kiln',
    caption: '',
    locator_kind: 'storage',
    locator: `brand-assets/${BIZ}/x.png`,
    latitude: null,
    longitude: null,
    public_allowed: true,
    status: 'published',
    revision: 3,
    links: [],
    ...partial,
  };
}

function knowledge(partial: Partial<Knowledge> = {}): Knowledge {
  return {
    id: KV,
    item_id: 'item-1',
    title: 'Garanti',
    category: 'ürün',
    content: 'WX-100 garantisi 2 yıldır.',
    source: 'Marka kitabı',
    public_allowed: true,
    status: 'published',
    version: 1,
    revision: 2,
    ...partial,
  };
}

function draftDto(overrides: Record<string, unknown> = {}) {
  return {
    id: DRAFT,
    businessId: BIZ,
    title: 'Sohbet',
    summary: '',
    turns: [{ stepIndex: 1, question: 'Merak?', answer: 'Cevap' }],
    turnCount: 1,
    curiosityQuestion: 'Merak?',
    knowledgeSourcePins: [],
    knowledgeNotes: [],
    coverAssetId: null,
    coverAssetRevision: null,
    contentDigest: 'a'.repeat(64),
    status: 'draft',
    revision: 1,
    approvedBy: null,
    approvedAt: null,
    approvedRevision: null,
    approvedContentDigest: null,
    approvalNote: null,
    publishedNodeId: null,
    publishedVersion: null,
    createdBy: 'owner',
    ...overrides,
  };
}

async function openCompose(role = 'owner') {
  render(
    <BusinessYansiConversationCreate
      businessId={BIZ}
      assets={[image()]}
      knowledge={[knowledge()]}
      role={role}
      canEdit={role !== 'viewer'}
    />,
  );
  fireEvent.click(screen.getByTestId('biz-conv-create-open'));
  await screen.findByTestId('biz-conv-create-panel');
  fireEvent.click(screen.getByTestId('biz-conv-goto-manual'));
  await screen.findByTestId('biz-conv-section-chat');
}

describe('BusinessYansiConversationCreate', () => {
  beforeEach(() => {
    apiMocks.createYansiV2ConversationDraft.mockReset();
    apiMocks.reviseYansiV2ConversationDraft.mockReset();
    apiMocks.transitionYansiV2ConversationDraft.mockReset();
    apiMocks.publishYansiV2ConversationDraft.mockReset();
    apiMocks.publishYansiV2Image.mockReset();
    apiMocks.getYansiV2ConversationDraft.mockReset();
    apiMocks.requestYansiV2ConversationProposal.mockReset();
    apiMocks.pollYansiV2ConversationProposal.mockReset();
    apiMocks.applyYansiV2ConversationProposal.mockReset();
    apiMocks.uploadBrandImage.mockReset();
    window.localStorage.clear();
  });

  it('hides for viewer and opens compose for editor', async () => {
    const { container } = render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[]}
        role="viewer"
        canEdit={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    await openCompose('editor');
    expect(screen.getByTestId('biz-conv-section-chat')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-conv-approve')).not.toBeInTheDocument();
  });

  it('adds up to 8 turns and refuses a 9th', async () => {
    await openCompose();
    fireEvent.change(screen.getByTestId('biz-conv-title'), { target: { value: 'Başlık' } });
    fireEvent.change(screen.getByTestId('biz-conv-question-1'), { target: { value: 'Q1?' } });
    fireEvent.change(screen.getByTestId('biz-conv-answer-1'), { target: { value: 'A1' } });
    for (let i = 0; i < 7; i += 1) {
      fireEvent.click(screen.getByTestId('biz-conv-add-turn'));
    }
    expect(screen.getAllByTestId(/biz-conv-turn-\d+/)).toHaveLength(8);
    expect(screen.getByTestId('biz-conv-add-turn')).toBeDisabled();
  });

  it('binds knowledge, saves draft, reviews, approves, publishes', async () => {
    apiMocks.createYansiV2ConversationDraft.mockResolvedValue(draftDto());
    apiMocks.transitionYansiV2ConversationDraft
      .mockResolvedValueOnce(draftDto({ status: 'review', revision: 2 }))
      .mockResolvedValueOnce(
        draftDto({
          status: 'approved',
          revision: 3,
          approvedBy: 'owner',
          approvedRevision: 2,
          approvedContentDigest: 'a'.repeat(64),
        }),
      );
    apiMocks.publishYansiV2ConversationDraft.mockResolvedValue({
      status: 'published',
      idempotent: false,
      nodeId: 'nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn',
      slug: 'sohbet-1',
      draftId: DRAFT,
      publicationVersion: 1,
      contractHash: 'b'.repeat(64),
      manifestHash: 'c'.repeat(64),
      bundleVersionId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      bundleHash: 'd'.repeat(64),
      curiosityQuestion: 'Merak?',
      turnCount: 1,
      public: {
        slug: 'sohbet-1',
        contract: {},
        bundle: {},
        conversation: {
          turnCount: 1,
          curiosityQuestion: 'Merak?',
          turns: [{ stepIndex: 1, question: 'Merak?', answer: 'Cevap' }],
        },
      },
    });

    await openCompose('owner');
    fireEvent.click(screen.getByTestId('biz-conv-flow-1'));
    await screen.findByTestId('biz-conv-step-select');
    fireEvent.click(screen.getByTestId('biz-conv-cover-' + ASSET));
    await openSourcePicker();
    fireEvent.click(screen.getByTestId(`biz-conv-bind-${KV}`));
    fireEvent.click(screen.getByTestId('biz-conv-goto-manual'));
    await screen.findByTestId('biz-conv-section-chat');
    fireEvent.change(screen.getByTestId('biz-conv-title'), { target: { value: 'Sohbet' } });
    fireEvent.change(screen.getByTestId('biz-conv-question-1'), { target: { value: 'Merak?' } });
    fireEvent.change(screen.getByTestId('biz-conv-answer-1'), { target: { value: 'Cevap' } });

    fireEvent.click(screen.getByTestId('biz-conv-save-preview'));
    await waitFor(() => expect(apiMocks.createYansiV2ConversationDraft).toHaveBeenCalledTimes(1));
    const [, createBody] = apiMocks.createYansiV2ConversationDraft.mock.calls[0];
    expect(createBody.turns).toHaveLength(1);
    expect(createBody.knowledgeSources).toEqual([{ knowledgeVersionId: KV, expectedRevision: 2 }]);
    expect(createBody.coverAssetId).toBe(ASSET);

    await screen.findByTestId('biz-conv-preview');
    expect(screen.getByTestId('biz-conv-preview-curiosity')).toHaveTextContent('Merak?');

    fireEvent.click(screen.getByTestId('biz-conv-submit-review'));
    await waitFor(() => expect(apiMocks.transitionYansiV2ConversationDraft).toHaveBeenCalled());
    expect(apiMocks.transitionYansiV2ConversationDraft.mock.calls[0][2].target).toBe('review');

    fireEvent.click(screen.getByTestId('biz-conv-approve'));
    await waitFor(() =>
      expect(apiMocks.transitionYansiV2ConversationDraft.mock.calls[1][2].target).toBe('approved'),
    );

    fireEvent.click(screen.getByTestId('biz-conv-publish'));
    await waitFor(() => expect(apiMocks.publishYansiV2ConversationDraft).toHaveBeenCalledTimes(1));
    await screen.findByTestId('biz-conv-done');
    expect(screen.getByTestId('biz-conv-public-url')).toHaveAttribute(
      'href',
      yansiV2PublicHref('sohbet-1', 1),
    );
    expect(screen.getByTestId('biz-conv-done')).not.toHaveTextContent('Keşfet\'te yayınlandı');
  });

  it('revises after approval and shows approval-dropped notice', async () => {
    apiMocks.createYansiV2ConversationDraft.mockResolvedValue(draftDto());
    apiMocks.reviseYansiV2ConversationDraft.mockResolvedValue(
      draftDto({ status: 'draft', revision: 4, approvedBy: null }),
    );
    apiMocks.transitionYansiV2ConversationDraft
      .mockResolvedValueOnce(draftDto({ status: 'review', revision: 2 }))
      .mockResolvedValueOnce(
        draftDto({
          status: 'approved',
          revision: 3,
          approvedBy: 'owner',
          approvedRevision: 2,
          approvedContentDigest: 'a'.repeat(64),
        }),
      );

    await openCompose('owner');
    fireEvent.change(screen.getByTestId('biz-conv-title'), { target: { value: 'Sohbet' } });
    fireEvent.change(screen.getByTestId('biz-conv-question-1'), { target: { value: 'Merak?' } });
    fireEvent.change(screen.getByTestId('biz-conv-answer-1'), { target: { value: 'Cevap' } });
    fireEvent.click(screen.getByTestId('biz-conv-save-preview'));
    await screen.findByTestId('biz-conv-preview');
    fireEvent.click(screen.getByTestId('biz-conv-submit-review'));
    await waitFor(() => expect(apiMocks.transitionYansiV2ConversationDraft).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('biz-conv-approve'));
    await waitFor(() =>
      expect(apiMocks.transitionYansiV2ConversationDraft.mock.calls.length).toBe(2),
    );

    fireEvent.click(screen.getByTestId('biz-conv-back-compose'));
    fireEvent.change(screen.getByTestId('biz-conv-answer-1'), { target: { value: 'Yeni cevap' } });
    fireEvent.click(screen.getByTestId('biz-conv-save-preview'));
    await waitFor(() => expect(apiMocks.reviseYansiV2ConversationDraft).toHaveBeenCalled());
    await screen.findByTestId('biz-conv-approval-dropped');
    expect(screen.getByTestId('biz-conv-publish')).toBeDisabled();
  });

  it('removes a middle turn and reorders', async () => {
    await openCompose();
    fireEvent.change(screen.getByTestId('biz-conv-title'), { target: { value: 'T' } });
    fireEvent.click(screen.getByTestId('biz-conv-add-turn'));
    fireEvent.click(screen.getByTestId('biz-conv-add-turn'));
    fireEvent.change(screen.getByTestId('biz-conv-question-1'), { target: { value: 'A?' } });
    fireEvent.change(screen.getByTestId('biz-conv-answer-1'), { target: { value: 'a' } });
    fireEvent.change(screen.getByTestId('biz-conv-question-2'), { target: { value: 'B?' } });
    fireEvent.change(screen.getByTestId('biz-conv-answer-2'), { target: { value: 'b' } });
    fireEvent.change(screen.getByTestId('biz-conv-question-3'), { target: { value: 'C?' } });
    fireEvent.change(screen.getByTestId('biz-conv-answer-3'), { target: { value: 'c' } });
    fireEvent.click(screen.getByTestId('biz-conv-turn-remove-2'));
    expect(screen.queryByTestId('biz-conv-turn-3')).not.toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-question-2')).toHaveValue('C?');
    fireEvent.click(screen.getByTestId('biz-conv-turn-up-2'));
    expect(screen.getByTestId('biz-conv-question-1')).toHaveValue('C?');
  });

  it('requests AI proposal and applies only after explicit accept', async () => {
    apiMocks.requestYansiV2ConversationProposal.mockResolvedValue({
      generationId: 'gggggggg-gggg-gggg-gggg-gggggggggggg',
      businessId: BIZ,
      kind: 'v2_prop',
      status: 'completed',
      proposal: {
        insufficientSources: false,
        warnings: [],
        result: {
          title: 'AI Başlık',
          summary: 'Özet',
          curiosityQuestion: 'Nasıl çalışır?',
          turns: [
            {
              stepIndex: 1,
              question: 'Nasıl çalışır?',
              answer: 'Kaynaklara dayalı cevap.',
              claimSafety: 'grounded',
              mediaSuggestions: [],
            },
          ],
          coverSuggestion: null,
          knowledgeSourcePins: [{ knowledgeVersionId: KV, expectedRevision: 2 }],
        },
      },
    });
    apiMocks.applyYansiV2ConversationProposal.mockResolvedValue({
      status: 'applied',
      generationId: 'gggggggg-gggg-gggg-gggg-gggggggggggg',
      draft: draftDto({
        title: 'AI Başlık',
        curiosityQuestion: 'Nasıl çalışır?',
        turns: [{ stepIndex: 1, question: 'Nasıl çalışır?', answer: 'Kaynaklara dayalı cevap.' }],
        knowledgeSourcePins: [{ knowledgeVersionId: KV, expectedRevision: 2 }],
      }),
    });

    render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
      />,
    );
    fireEvent.click(screen.getByTestId('biz-conv-create-open'));
    await screen.findByTestId('biz-conv-step-select');
    expect(screen.queryByTestId('biz-conv-section-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('biz-conv-bind-panel')).not.toBeInTheDocument();
    await openSourcePicker();
    fireEvent.click(screen.getByTestId(`biz-conv-bind-${KV}`));
    fireEvent.change(screen.getByTestId('biz-conv-topic-hint'), {
      target: { value: 'Bilimsel bir olayı sade anlat' },
    });
    fireEvent.click(screen.getByTestId('biz-conv-to-ai'));
    await screen.findByTestId('biz-conv-step-ai');
    fireEvent.click(screen.getByTestId('biz-conv-ai-generate'));
    await screen.findByTestId('biz-conv-proposal');
    expect(apiMocks.requestYansiV2ConversationProposal).toHaveBeenCalledWith(
      BIZ,
      expect.objectContaining({
        sourceVersionIds: [KV],
        topicHint: 'Bilimsel bir olayı sade anlat',
      }),
    );
    expect(apiMocks.applyYansiV2ConversationProposal).not.toHaveBeenCalled();
    expect(apiMocks.createYansiV2ConversationDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('biz-conv-ai-apply'));
    await waitFor(() => expect(apiMocks.applyYansiV2ConversationProposal).toHaveBeenCalledTimes(1));
    await screen.findByTestId('biz-conv-section-chat');
    expect(screen.getByTestId('biz-conv-title')).toHaveValue('AI Başlık');
  });

  it('polls queued proposal then keeps sources on failed generation', async () => {
    apiMocks.requestYansiV2ConversationProposal.mockResolvedValue({
      generationId: 'gggggggg-gggg-gggg-gggg-gggggggggggg',
      businessId: BIZ,
      kind: 'v2_prop',
      status: 'queued',
      proposal: null,
      errorCode: null,
    });
    apiMocks.pollYansiV2ConversationProposal.mockResolvedValue({
      generationId: 'gggggggg-gggg-gggg-gggg-gggggggggggg',
      businessId: BIZ,
      kind: 'v2_prop',
      status: 'failed',
      proposal: null,
      errorCode: 'studio_provider_failed',
    });

    render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
      />,
    );
    fireEvent.click(screen.getByTestId('biz-conv-create-open'));
    await screen.findByTestId('biz-conv-step-select');
    await openSourcePicker();
    fireEvent.click(screen.getByTestId(`biz-conv-bind-${KV}`));
    fireEvent.click(screen.getByTestId('biz-conv-cover-' + ASSET));
    fireEvent.click(screen.getByTestId('biz-conv-to-ai'));
    fireEvent.click(screen.getByTestId('biz-conv-ai-generate'));
    await waitFor(() => expect(apiMocks.pollYansiV2ConversationProposal).toHaveBeenCalled());
    await screen.findByTestId('biz-conv-error');
    expect(apiMocks.applyYansiV2ConversationProposal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('biz-conv-flow-1'));
    await screen.findByTestId('biz-conv-step-select');
    // Selection survives AI failure (count on bind summary; cover still pressed).
    expect(screen.getByTestId('biz-conv-bind')).toHaveTextContent('(1)');
    expect(screen.getByTestId('biz-conv-cover-' + ASSET)).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows discover/experience preview tabs from the same draft', async () => {
    apiMocks.createYansiV2ConversationDraft.mockResolvedValue(
      draftDto({ coverAssetId: ASSET, coverAssetRevision: 3 }),
    );
    await openCompose('owner');
    fireEvent.click(screen.getByTestId('biz-conv-flow-1'));
    fireEvent.click(screen.getByTestId('biz-conv-cover-' + ASSET));
    fireEvent.click(screen.getByTestId('biz-conv-goto-manual'));
    fireEvent.change(screen.getByTestId('biz-conv-title'), { target: { value: 'Sohbet' } });
    fireEvent.change(screen.getByTestId('biz-conv-question-1'), { target: { value: 'Merak?' } });
    fireEvent.change(screen.getByTestId('biz-conv-answer-1'), { target: { value: 'Cevap' } });
    fireEvent.click(screen.getByTestId('biz-conv-save-preview'));
    await screen.findByTestId('biz-conv-preview');
    expect(screen.getByTestId('biz-conv-preview-discover')).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-preview-curiosity')).toHaveTextContent('Merak?');
    expect(screen.getByTestId('biz-conv-preview-discover-cta')).toBeDisabled();
    expect(screen.getByTestId('biz-conv-discover-card')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-conv-preview-tab-experience'));
    expect(screen.getByTestId('biz-conv-preview-experience')).toBeInTheDocument();
    expect(await screen.findByTestId('biz-conv-preview-scene-bleed')).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-preview-composer-locked')).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-preview-turns')).toHaveTextContent('Merak?');
    expect(screen.getByTestId('biz-conv-preview-turns')).toHaveTextContent('Cevap');
  });

  it('publishes image-only without calling AI proposal APIs', async () => {
    apiMocks.publishYansiV2Image.mockResolvedValue({
      status: 'published',
      idempotent: false,
      nodeId: 'nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn',
      slug: 'foto-1',
      publicationVersion: 1,
      contractHash: 'b'.repeat(64),
      manifestHash: 'c'.repeat(64),
      bundleVersionId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      bundleHash: 'd'.repeat(64),
      public: { slug: 'foto-1', contract: { contentKind: 'image' }, bundle: {} },
    });
    render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
      />,
    );
    fireEvent.click(screen.getByTestId('biz-conv-create-open'));
    await screen.findByTestId('biz-conv-step-select');
    fireEvent.click(screen.getByTestId('biz-conv-cover-' + ASSET));
    expect(screen.getByTestId('biz-conv-live-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-conv-to-ai'));
    await screen.findByTestId('biz-conv-step-review-image');
    fireEvent.change(screen.getByTestId('biz-conv-image-title'), { target: { value: 'Fırın' } });
    fireEvent.click(screen.getByTestId('biz-conv-image-confirm'));
    fireEvent.click(screen.getByTestId('biz-conv-image-publish'));
    await waitFor(() => expect(apiMocks.publishYansiV2Image).toHaveBeenCalledTimes(1));
    expect(apiMocks.requestYansiV2ConversationProposal).not.toHaveBeenCalled();
    expect(apiMocks.createYansiV2ConversationDraft).not.toHaveBeenCalled();
    const [, body] = apiMocks.publishYansiV2Image.mock.calls[0];
    expect(body.assetId).toBe(ASSET);
    expect(body.title).toBe('Fırın');
    await screen.findByTestId('biz-conv-done');
  });

  it('hydrates a conversation draft by id for the same business', async () => {
    apiMocks.getYansiV2ConversationDraft.mockResolvedValue(
      draftDto({
        title: 'Kayıtlı sohbet',
        turns: [{ stepIndex: 1, question: 'Ne?', answer: 'Bu.' }],
        coverAssetId: ASSET,
        coverAssetRevision: 3,
        knowledgeSourcePins: [{ knowledgeVersionId: KV, expectedRevision: 2 }],
      }),
    );
    const onResumeConsumed = vi.fn();
    render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
        resumeDraftId={DRAFT}
        onResumeConsumed={onResumeConsumed}
      />,
    );
    await waitFor(() => expect(apiMocks.getYansiV2ConversationDraft).toHaveBeenCalledWith(BIZ, DRAFT));
    await screen.findByTestId('biz-conv-section-chat');
    expect(screen.getByTestId('biz-conv-title')).toHaveValue('Kayıtlı sohbet');
    expect(screen.getByTestId('biz-conv-question-1')).toHaveValue('Ne?');
    expect(onResumeConsumed).toHaveBeenCalled();
  });

  it('rejects hydrating another business draft id', async () => {
    apiMocks.getYansiV2ConversationDraft.mockResolvedValue(
      draftDto({
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        businessId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        title: 'Yabancı',
      }),
    );
    render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
        resumeDraftId="ffffffff-ffff-ffff-ffff-ffffffffffff"
      />,
    );
    await screen.findByTestId('biz-conv-error');
    expect(screen.getByTestId('biz-conv-error')).toHaveTextContent('bu markaya ait değil');
    expect(screen.queryByTestId('biz-conv-section-chat')).not.toBeInTheDocument();
  });

  it('locks published drafts against edits', async () => {
    apiMocks.getYansiV2ConversationDraft.mockResolvedValue(
      draftDto({
        status: 'published',
        publishedNodeId: 'nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn',
        title: 'Yayında',
      }),
    );
    render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
        resumeDraftId={DRAFT}
      />,
    );
    await screen.findByTestId('biz-conv-locked');
    expect(screen.queryByTestId('biz-conv-section-chat')).not.toBeInTheDocument();
  });

  it('uploads a cover via library validation and selects it', async () => {
    const uploadedId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    apiMocks.uploadBrandImage.mockResolvedValue(
      image({ id: uploadedId, title: 'Yeni Kapak', public_allowed: true, status: 'published' }),
    );
    const onAssetsChanged = vi.fn(async () => undefined);
    const { rerender } = render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
        onAssetsChanged={onAssetsChanged}
      />,
    );
    fireEvent.click(screen.getByTestId('biz-conv-create-open'));
    await screen.findByTestId('biz-conv-step-select');
    expect(screen.getByTestId('biz-conv-media-empty')).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-blocked-reason')).toBeInTheDocument();
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('biz-conv-cover-upload'), { target: { files: [file] } });
    await waitFor(() => expect(apiMocks.uploadBrandImage).toHaveBeenCalledTimes(1));
    expect(apiMocks.uploadBrandImage.mock.calls[0][2]).toEqual(
      expect.objectContaining({ publicAllowed: true }),
    );
    await waitFor(() => expect(onAssetsChanged).toHaveBeenCalled());
    rerender(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image({ id: uploadedId, title: 'Yeni Kapak' })]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
        startOpen
        onAssetsChanged={onAssetsChanged}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId(`biz-conv-cover-${uploadedId}`)).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByTestId('biz-conv-live-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('biz-conv-live-empty')).not.toBeInTheDocument();
  });

  it('keeps exit control outside the primary CTA group', async () => {
    render(
      <BusinessYansiConversationCreate
        businessId={BIZ}
        assets={[image()]}
        knowledge={[knowledge()]}
        role="owner"
        canEdit
        startOpen
      />,
    );
    await screen.findByTestId('biz-conv-step-select');
    expect(screen.getByTestId('biz-conv-exit')).toBeInTheDocument();
    expect(screen.getByText("Yansı'nı Nasıl Hayal Ediyorsun?")).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-direction-examples').querySelectorAll('button').length).toBeGreaterThan(3);
    expect(screen.queryByRole('button', { name: 'Kapat' })).not.toBeInTheDocument();
  });
});
