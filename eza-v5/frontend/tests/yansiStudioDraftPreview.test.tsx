/**
 * Studio draft preview uses public presentation primitives without live side effects.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import YansiStudioDraftPreview from '@/components/saina/business-studio/YansiStudioDraftPreview';
import type { YansiV2ConversationPreview } from '@/lib/eza/yansiV2ConversationCreate';

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>(
    '@/lib/eza/businessYansi',
  );
  return {
    ...actual,
    fetchBrandAssetPreview: vi.fn().mockResolvedValue('blob:preview-cover'),
  };
});

const preview: YansiV2ConversationPreview = {
  title: 'Fırın Sabahı',
  summary: 'Özet',
  curiosityQuestion: 'Fırın nasıl ısınır?',
  turnCount: 1,
  turns: [
    {
      stepIndex: 1,
      question: 'Fırın nasıl ısınır?',
      answer: 'Odunla yavaşça.',
      mediaTitle: null,
    },
  ],
  coverTitle: 'Kapak',
  linkedKnowledge: [
    {
      id: 'kv-1',
      title: 'Fırın notu',
      category: 'ürün',
      aiReady: true,
      aiStatusLabel: 'AI + görünür',
      publicAllowed: true,
      revision: 1,
      status: 'published',
    },
  ],
  knowledgeNotes: [],
  mediaOptional: true,
};

describe('YansiStudioDraftPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Keşfet product card with curiosity as summary and disabled CTA', () => {
    render(
      <YansiStudioDraftPreview
        mode="discover"
        businessId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        brandName="Kiln Co"
        preview={preview}
        coverAssetId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
      />,
    );
    expect(screen.getByTestId('biz-conv-discover-card')).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-preview-curiosity')).toHaveTextContent('Fırın nasıl ısınır?');
    expect(screen.getByTestId('biz-conv-preview-discover-cta')).toBeDisabled();
    expect(screen.getByTestId('biz-conv-preview-brand')).toHaveTextContent('Kiln Co');
    expect(screen.getByTestId('biz-conv-preview-sources')).toHaveTextContent('Fırın notu');
  });

  it('renders Deneyimle with MessageList reading plane, scene, locked composer, sources outside', async () => {
    render(
      <YansiStudioDraftPreview
        mode="experience"
        businessId="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        brandName="Kiln Co"
        preview={preview}
        coverAssetId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
      />,
    );
    const experience = screen.getByTestId('biz-conv-preview-experience');
    expect(experience).toBeInTheDocument();
    expect(await screen.findByTestId('biz-conv-preview-scene-bleed')).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-preview-composer-locked')).toBeInTheDocument();
    expect(screen.getByTestId('biz-conv-preview-turns')).toHaveTextContent('Odunla yavaşça.');

    const reading = screen.getByTestId('biz-conv-preview-experience-thread');
    expect(reading).toHaveAttribute('data-reading-mode', 'standard');
    expect(reading).toHaveAttribute('data-reading-spacing', 'normal');
    expect(reading.style.getPropertyValue('--yansi-reading-size')).toBe('16px');
    expect(reading.querySelector('.saina-message-list')).toBeTruthy();
    expect(reading.querySelector('.saina-message-thread')).toBeTruthy();

    const sources = screen.getByTestId('biz-conv-preview-sources');
    expect(sources).toHaveTextContent('Fırın notu');
    expect(experience.contains(sources)).toBe(false);
  });
});
