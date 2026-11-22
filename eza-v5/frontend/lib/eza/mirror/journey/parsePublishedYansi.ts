/**
 * Public Yansı payload dispatcher (Stage 1 security fix).
 *
 * - No contractVersion → legacy V1 frozen parser only.
 * - contractVersion === yansi-publication-v2 → V2 only.
 * - Any other explicit contractVersion → reject (never V1 fallback).
 */

import {
  parsePublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from './publicFrozenTypes';
import {
  hasExplicitContractVersion,
  isYansiV2ContractMarker,
  parseYansiV2PublicationContract,
  type YansiV2PublicationContract,
} from './yansiV2Publication';

export type PublishedYansiV1 = {
  contractFamily: 'v1';
  artifact: PublicFrozenJourneyArtifact;
};

export type PublishedYansiV2 = {
  contractFamily: 'v2';
  contract: YansiV2PublicationContract;
};

export type PublishedYansi = PublishedYansiV1 | PublishedYansiV2;

export function parsePublishedYansi(raw: unknown): PublishedYansi | null {
  if (hasExplicitContractVersion(raw)) {
    if (!isYansiV2ContractMarker(raw)) return null;
    const contract = parseYansiV2PublicationContract(raw);
    if (!contract) return null;
    return { contractFamily: 'v2', contract };
  }
  const artifact = parsePublicFrozenJourneyArtifact(raw);
  if (!artifact) return null;
  return { contractFamily: 'v1', artifact };
}
