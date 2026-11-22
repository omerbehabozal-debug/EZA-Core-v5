import { describe, expect, it } from 'vitest';
import type { BrandAsset, Knowledge } from '@/lib/eza/businessYansi';
import {
  addTurn,
  buildConversationApiInput,
  buildConversationPreview,
  canAddTurn,
  emptyConversationLocalDraft,
  moveTurn,
  removeTurn,
  validateConversationCompose,
  YANSI_V2_CONV_MAX_TURNS,
} from '@/lib/eza/yansiV2ConversationCreate';

const BIZ = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const KV = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function image(): BrandAsset {
  return {
    id: ASSET,
    business_id: BIZ,
    asset_type: 'image',
    title: 'Kapak',
    caption: '',
    locator_kind: 'storage',
    locator: `brand-assets/${BIZ}/x.png`,
    latitude: null,
    longitude: null,
    public_allowed: true,
    status: 'published',
    revision: 2,
    links: [],
  };
}

function knowledge(): Knowledge {
  return {
    id: KV,
    item_id: 'item-1',
    title: 'Garanti',
    category: 'ürün',
    content: 'WX-100 garantisi 2 yıldır.',
    source: 'Kitap',
    public_allowed: true,
    status: 'published',
    version: 1,
    revision: 3,
  };
}

describe('yansiV2ConversationCreate turns', () => {
  it('accepts 1 and 8 turns and blocks a 9th', () => {
    let turns = emptyConversationLocalDraft().turns;
    expect(validateConversationCompose({
      ...emptyConversationLocalDraft(),
      title: 'T',
      turns: [{ question: 'Q?', answer: 'A', mediaAssetId: '' }],
    })).toBeNull();

    for (let i = 1; i < 8; i += 1) turns = addTurn(turns);
    expect(turns).toHaveLength(8);
    expect(canAddTurn(turns)).toBe(false);
    expect(addTurn(turns)).toHaveLength(YANSI_V2_CONV_MAX_TURNS);
  });

  it('removes and reorders turns with contiguous indices in API payload', () => {
    const draft = {
      ...emptyConversationLocalDraft(),
      title: 'Sohbet',
      turns: [
        { question: 'Bir?', answer: '1', mediaAssetId: '' },
        { question: 'İki?', answer: '2', mediaAssetId: ASSET },
        { question: 'Üç?', answer: '3', mediaAssetId: '' },
      ],
      linkedKnowledgeIds: [KV],
      coverAssetId: ASSET,
    };
    const removed = { ...draft, turns: removeTurn(draft.turns, 1) };
    expect(removed.turns).toHaveLength(2);
    expect(removed.turns[0].question).toBe('Bir?');
    expect(removed.turns[1].question).toBe('Üç?');

    const moved = { ...draft, turns: moveTurn(draft.turns, 2, 0) };
    expect(moved.turns.map((t) => t.question)).toEqual(['Üç?', 'Bir?', 'İki?']);

    const input = buildConversationApiInput(moved, [image()], [knowledge()]);
    expect(input.turns.map((t) => t.stepIndex)).toEqual([1, 2, 3]);
    expect(input.turns[0].question).toBe('Üç?');
    expect(input.coverAssetId).toBe(ASSET);
    expect(input.knowledgeSources).toEqual([{ knowledgeVersionId: KV, expectedRevision: 3 }]);
    expect(input.turns[2].media?.[0]?.assetId).toBe(ASSET);
  });

  it('rejects empty Q/A and builds preview curiosity from first turn', () => {
    expect(
      validateConversationCompose({
        ...emptyConversationLocalDraft(),
        title: 'T',
        turns: [{ question: '  ', answer: 'A', mediaAssetId: '' }],
      }),
    ).toMatch(/boş/);

    const preview = buildConversationPreview(
      {
        ...emptyConversationLocalDraft(),
        title: 'Başlık',
        turns: [
          { question: 'Merak?', answer: 'Cevap', mediaAssetId: '' },
          { question: 'İkinci?', answer: 'İki', mediaAssetId: '' },
        ],
        linkedKnowledgeIds: [KV],
      },
      [image()],
      [knowledge()],
    );
    expect(preview?.curiosityQuestion).toBe('Merak?');
    expect(preview?.turnCount).toBe(2);
    expect(preview?.mediaOptional).toBe(true);
  });
});
