import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { parsePublishedYansi } from '@/lib/eza/mirror/journey/parsePublishedYansi';
import {
  YANSI_PUBLICATION_CONTRACT_V2,
  YANSI_V2_LIMITS,
  parseYansiV2PublicationContract,
} from '@/lib/eza/mirror/journey/yansiV2Publication';

const fixtures = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../fixtures/yansi_v2_publication_fixtures.json'),
    'utf8'
  )
);

function sealedImage(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: YANSI_PUBLICATION_CONTRACT_V2,
    nodeId: fixtures.nodeId,
    responsePolicy: 'open',
    contentKind: 'image',
    contentManifest: fixtures.validImageManifest,
    manifestHash: 'a'.repeat(64),
    contractHash: 'b'.repeat(64),
    publicationVersion: 1,
    ...overrides,
  };
}

function v1Frozen() {
  return {
    slug: 'atolye',
    journeyId: 'atolye',
    journeyVersion: 1,
    authorUserId: 'user-1',
    selectedCount: 6,
    replayReady: true,
    steps: Array.from({ length: 6 }, (_, index) => ({
      stepIndex: index + 1,
      publicQuestion: `Soru ${index + 1}?`,
      publicAnswer: `Cevap ${index + 1}.`,
    })),
  };
}

describe('yansi V2 publication security parser', () => {
  it('accepts shared fixture image and video manifests', () => {
    expect(parseYansiV2PublicationContract(sealedImage())?.contentKind).toBe('image');
    expect(
      parseYansiV2PublicationContract(
        sealedImage({
          contentKind: 'video',
          contentManifest: fixtures.validVideoManifest,
        })
      )?.contentKind
    ).toBe('video');
  });

  it('rejects private paths, unsafe urls, unknown versions, and extras', () => {
    expect(
      parseYansiV2PublicationContract(
        sealedImage({ contentManifest: fixtures.invalidPrivatePathManifest })
      )
    ).toBeNull();
    expect(
      parseYansiV2PublicationContract(
        sealedImage({
          contentKind: 'video',
          contentManifest: fixtures.invalidUnsafeUrlManifest,
        })
      )
    ).toBeNull();
    expect(parsePublishedYansi(fixtures.invalidUnknownContractVersion)).toBeNull();
    expect(
      parseYansiV2PublicationContract(
        sealedImage({
          contentManifest: {
            blocks: [{ ...fixtures.validImageManifest.blocks[0], storageKey: 'secret' }],
          },
        })
      )
    ).toBeNull();
    expect(parseYansiV2PublicationContract(sealedImage({ publicationVersion: 1.5 }))).toBeNull();
  });

  it('keeps V1 legacy and V2 markers strictly separated', () => {
    expect(parsePublishedYansi(v1Frozen())?.contractFamily).toBe('v1');
    expect(parsePublishedYansi(sealedImage())?.contractFamily).toBe('v2');
    expect(
      parsePublishedYansi({
        ...v1Frozen(),
        contractVersion: 'yansi-publication-v9',
      })
    ).toBeNull();
    expect(
      parsePublishedYansi({
        ...v1Frozen(),
        contractVersion: YANSI_PUBLICATION_CONTRACT_V2,
        responsePolicy: 'open',
      })
    ).toBeNull();
  });

  it('documents shared limits with backend fixtures', () => {
    expect(YANSI_V2_LIMITS.maxBlocks).toBe(fixtures.meta.limits.maxBlocks);
    expect(YANSI_V2_LIMITS.maxTurns).toBe(fixtures.meta.limits.maxTurns);
    expect(YANSI_V2_LIMITS.maxTurnText).toBe(fixtures.meta.limits.maxTurnText);
    expect(YANSI_V2_LIMITS.maxTitle).toBe(fixtures.meta.limits.maxTitle);
    expect(String(fixtures.meta.hashAuthority)).toContain('backend');
  });
});
