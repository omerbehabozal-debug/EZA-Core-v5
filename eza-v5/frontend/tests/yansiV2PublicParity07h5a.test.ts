/**
 * 07H.5A — V2 public experience visual & metadata parity.
 * Cover → Discover / fullscreen / Deneyimle; real title+summary; coverless fallback.
 */
import { describe, expect, it } from 'vitest';
import { isConversationSceneDisplayUrl } from '@/lib/eza/conversationSceneIdentity';
import { parseYansiV2PublicPublication } from '@/lib/eza/mirror/journey/fetchYansiV2Public';
import { mapV2PublicToFrozenArtifact } from '@/lib/eza/mirror/journey/mapV2PublicToFrozenArtifact';
import { businessMediaUrl } from '@/lib/eza/mirror/journey/businessMedia';
import { parseDiscoverItem } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';

const ASSET_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BIZ = '11111111-1111-1111-1111-111111111111';
const coverPath = `/api/business-yansi/public-media/${BIZ}/${ASSET_A}`;

function coveredConversation(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok',
    slug: 'kesfet-bilgiyle-sohbetin-yen-ed0f16',
    nodeId: '22222222-2222-2222-2222-222222222222',
    publicationVersion: 14,
    isCurrent: true,
    contentKind: 'mixed',
    title: 'Keşfet: Bilgiyle Sohbetin Yeni Adresi',
    summary: 'Bilgiyle sohbetin yeni adresine kısa bir bakış.',
    businessPublisher: {
      businessId: BIZ,
      slug: 'bilign-demo',
      displayName: 'BiligN Demo',
      logoUrl: null,
      verified: true,
      official: true,
    },
    public: {
      slug: 'kesfet-bilgiyle-sohbetin-yen-ed0f16',
      conversation: {
        turnCount: 1,
        curiosityQuestion: 'Bilgiyle sohbet neden farklı?',
        turns: [
          {
            stepIndex: 1,
            question: 'Bilgiyle sohbet neden farklı?',
            answer: 'Çünkü kaynaklı ve ritmik.',
            media: [],
          },
        ],
      },
      cover: {
        assetId: ASSET_A,
        title: 'Keşfet: Bilgiyle Sohbetin Yeni Adresi',
        contentPath: coverPath,
      },
    },
    ...overrides,
  };
}

describe('07H.5A V2 cover → public surfaces', () => {
  it('maps V2 cover URL for Discover card, fullscreen landing, and Deneyimle backdrop', () => {
    const pub = parseYansiV2PublicPublication(coveredConversation());
    expect(pub).not.toBeNull();
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(artifact).not.toBeNull();

    const sceneUrl = artifact!.sceneImageUrl;
    expect(sceneUrl).toBeTruthy();
    expect(sceneUrl).toContain(coverPath);
    expect(isConversationSceneDisplayUrl(sceneUrl)).toBe(true);

    const discover = parseDiscoverItem({
      slug: artifact!.slug,
      title: artifact!.publicTitle,
      yansiCount: 0,
      journeyVersion: artifact!.journeyVersion,
      contentKind: 'mixed',
      sceneImageUrl: coverPath,
      description: artifact!.publicSummary,
    });
    expect(discover?.title).toBe('Keşfet: Bilgiyle Sohbetin Yeni Adresi');
    expect(discover?.sceneImageUrl).toBe(coverPath);
  });

  it('maps real title and summary (not generic Yansı / curiosity-only)', () => {
    const pub = parseYansiV2PublicPublication(coveredConversation());
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(artifact!.publicTitle).toBe('Keşfet: Bilgiyle Sohbetin Yeni Adresi');
    expect(artifact!.publicSummary).toBe(
      'Bilgiyle sohbetin yeni adresine kısa bir bakış.'
    );
    expect(artifact!.publicTitle).not.toBe('Yansı');
    expect(artifact!.journeyVersion).toBe(14);
    expect(artifact!.businessPublisher?.displayName).toBe('BiligN Demo');
  });

  it('falls back to cover.title when API title is absent (no republish required)', () => {
    const raw = coveredConversation();
    delete raw.title;
    delete raw.summary;
    const pub = parseYansiV2PublicPublication(raw);
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(artifact!.publicTitle).toBe('Keşfet: Bilgiyle Sohbetin Yeni Adresi');
    expect(artifact!.publicSummary).toBe('Bilgiyle sohbet neden farklı?');
  });

  it('coverless V2 keeps null scene and falls back title without inventing cover', () => {
    const pub = parseYansiV2PublicPublication(
      coveredConversation({
        title: 'Kapaksız başlık',
        summary: 'Kapaksız özet',
        contentKind: 'conversation',
        public: {
          slug: 'kesfet-bilgiyle-sohbetin-yen-ed0f16',
          conversation: {
            turnCount: 1,
            curiosityQuestion: 'Merak?',
            turns: [
              {
                stepIndex: 1,
                question: 'Merak?',
                answer: 'Yanıt.',
                media: [],
              },
            ],
          },
          cover: null,
        },
      })
    );
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(artifact!.sceneImageUrl).toBeNull();
    expect(artifact!.publicTitle).toBe('Kapaksız başlık');
    expect(artifact!.publicSummary).toBe('Kapaksız özet');
    expect(artifact!.businessMedia).toBeUndefined();
  });

  it('image-only keeps media title/cover and does not invent Q/A', () => {
    const pub = parseYansiV2PublicPublication({
      status: 'ok',
      slug: 'v2-photo',
      publicationVersion: 1,
      isCurrent: true,
      contentKind: 'image',
      title: 'Vitrin başlığı',
      public: {
        slug: 'v2-photo',
        media: {
          assetId: ASSET_A,
          contentPath: coverPath,
          title: 'Vitrin',
        },
      },
    });
    const artifact = mapV2PublicToFrozenArtifact(pub!);
    expect(artifact!.publicTitle).toBe('Vitrin başlığı');
    expect(artifact!.steps).toEqual([]);
    expect(artifact!.sceneImageUrl).toBe(businessMediaUrl(coverPath));
    expect(isConversationSceneDisplayUrl(artifact!.sceneImageUrl)).toBe(true);
  });

  it('pins publication version from sealed public DTO', () => {
    const pub = parseYansiV2PublicPublication(
      coveredConversation({ publicationVersion: 14, isCurrent: true })
    );
    expect(mapV2PublicToFrozenArtifact(pub!)!.journeyVersion).toBe(14);
  });
});
