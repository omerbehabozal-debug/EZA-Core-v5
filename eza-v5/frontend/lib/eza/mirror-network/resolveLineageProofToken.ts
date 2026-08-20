/**
 * Canonical lineage proof read for continuation / publish provenance.
 *
 * Precedence (documented):
 * 1. mirrorOrigin.lineageProofToken
 * 2. treeMetadata.lineageProofToken
 *
 * Never log or put the token in URLs / public DTOs.
 */

export type LineageProofCarrier = {
  mirrorOrigin?: { lineageProofToken?: string | null } | null;
  treeMetadata?: { lineageProofToken?: string | null } | null;
};

function normalizeProof(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function resolveLineageProofToken(
  chat: LineageProofCarrier | null | undefined
): string | undefined {
  if (!chat) return undefined;
  return (
    normalizeProof(chat.mirrorOrigin?.lineageProofToken) ??
    normalizeProof(chat.treeMetadata?.lineageProofToken)
  );
}
