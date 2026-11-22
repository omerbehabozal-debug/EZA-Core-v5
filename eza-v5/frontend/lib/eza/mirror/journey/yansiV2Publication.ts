/**
 * Yansı publication contract v2 — types and fail-closed parsing.
 *
 * Hash authority: backend `compute_manifest_hash` / `compute_contract_hash` are
 * canonical. This parser verifies shape and rejects unsafe media; it does not
 * redefine or silently repair hashes.
 *
 * Stage 1: no create/publish UI.
 */

export const YANSI_PUBLICATION_CONTRACT_V2 = 'yansi-publication-v2' as const;

export const YANSI_V2_LIMITS = {
  maxBlocks: 32,
  maxTurns: 64,
  maxTurnText: 8000,
  maxTitle: 200,
  maxHttps: 1000,
  maxPublicationVersion: 1_000_000,
} as const;

export type YansiV2ResponsePolicy = 'open' | 'grounded';
export type YansiV2ContentKind = 'conversation' | 'image' | 'video' | 'mixed';

export type YansiV2ConversationTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type YansiV2ConversationBlock = {
  type: 'conversation';
  turns: YansiV2ConversationTurn[];
};

export type YansiV2ImageBlock = {
  type: 'image';
  assetId: string;
  title: string;
  contentPath: string;
};

export type YansiV2VideoBlock = {
  type: 'video';
  assetId: string;
  title: string;
  href: string;
};

export type YansiV2ContentBlock =
  | YansiV2ConversationBlock
  | YansiV2ImageBlock
  | YansiV2VideoBlock;

export type YansiV2ContentManifest = {
  blocks: YansiV2ContentBlock[];
};

export type YansiV2ApprovalMetadata = {
  approvedBy?: string | null;
  approvedAt?: string | null;
  note?: string | null;
};

export type YansiV2PublicationContract = {
  contractVersion: typeof YANSI_PUBLICATION_CONTRACT_V2;
  nodeId: string;
  responsePolicy: YansiV2ResponsePolicy;
  contentKind: YansiV2ContentKind;
  contentManifest: YansiV2ContentManifest;
  manifestHash: string;
  contractHash: string;
  knowledgeBundleVersionRef?: string | null;
  publicationVersion: number;
  approvalMetadata?: YansiV2ApprovalMetadata | null;
};

const PRIVATE_KEYS = new Set([
  'storageKey',
  'storage_key',
  'objectKey',
  'object_key',
  'bucket',
  's3Key',
  's3_key',
  'absolutePath',
  'absolute_path',
  'filePath',
  'file_path',
  'localPath',
  'local_path',
  'brandAssetPath',
  'brand_asset_path',
  'locator',
  'url',
  'path',
  'src',
  'file',
  'signedUrl',
  'signed_url',
]);

const HASH = /^[0-9a-f]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTENT_PATH =
  /^\/api\/business-yansi\/public-media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(row: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allow = new Set(allowed);
  return Object.keys(row).every((key) => allow.has(key));
}

function hasPrivateKey(row: Record<string, unknown>): boolean {
  return Object.keys(row).some((key) => PRIVATE_KEYS.has(key));
}

function isSafeHttpsUrl(value: string): boolean {
  if (!value || value.length > YANSI_V2_LIMITS.maxHttps) return false;
  if (/[\\\s]/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) return false;
  const lowered = value.toLowerCase();
  if (
    lowered.startsWith('javascript:') ||
    lowered.startsWith('data:') ||
    lowered.startsWith('blob:') ||
    lowered.startsWith('file:') ||
    lowered.startsWith('http:')
  ) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.hash) return false;
  if (parsed.port && parsed.port !== '443') return false;
  const host = parsed.hostname.replace(/\.$/, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) {
    return false;
  }
  return true;
}

function parseTurn(raw: unknown): YansiV2ConversationTurn | null {
  if (!isRecord(raw) || hasPrivateKey(raw)) return null;
  if (!hasOnlyKeys(raw, ['role', 'text'])) return null;
  if (raw.role !== 'user' && raw.role !== 'assistant') return null;
  if (typeof raw.text !== 'string') return null;
  const text = raw.text;
  if (!text || text !== text.trim() || text.length > YANSI_V2_LIMITS.maxTurnText) return null;
  return { role: raw.role, text };
}

function parseBlock(raw: unknown): YansiV2ContentBlock | null {
  if (!isRecord(raw) || hasPrivateKey(raw)) return null;
  if (raw.type === 'conversation') {
    if (!hasOnlyKeys(raw, ['type', 'turns'])) return null;
    if (!Array.isArray(raw.turns) || raw.turns.length < 1 || raw.turns.length > YANSI_V2_LIMITS.maxTurns) {
      return null;
    }
    const turns: YansiV2ConversationTurn[] = [];
    for (const item of raw.turns) {
      const turn = parseTurn(item);
      if (!turn) return null;
      turns.push(turn);
    }
    return { type: 'conversation', turns };
  }
  if (raw.type === 'image') {
    if (!hasOnlyKeys(raw, ['type', 'assetId', 'title', 'contentPath'])) return null;
    if (typeof raw.assetId !== 'string' || typeof raw.title !== 'string' || typeof raw.contentPath !== 'string') {
      return null;
    }
    const assetId = raw.assetId;
    const title = raw.title;
    const contentPath = raw.contentPath;
    if (!UUID.test(assetId) || !title || title !== title.trim() || title.length > YANSI_V2_LIMITS.maxTitle) {
      return null;
    }
    const match = CONTENT_PATH.exec(contentPath);
    if (!match || match[2].toLowerCase() !== assetId.toLowerCase()) return null;
    return { type: 'image', assetId, title, contentPath };
  }
  if (raw.type === 'video') {
    if (!hasOnlyKeys(raw, ['type', 'assetId', 'title', 'href'])) return null;
    if (typeof raw.assetId !== 'string' || typeof raw.title !== 'string' || typeof raw.href !== 'string') {
      return null;
    }
    const assetId = raw.assetId;
    const title = raw.title;
    const href = raw.href;
    if (!UUID.test(assetId) || !title || title !== title.trim() || title.length > YANSI_V2_LIMITS.maxTitle) {
      return null;
    }
    if (!isSafeHttpsUrl(href)) return null;
    return { type: 'video', assetId, title, href };
  }
  return null;
}

function parseManifest(raw: unknown): YansiV2ContentManifest | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ['blocks'])) return null;
  if (!Array.isArray(raw.blocks) || raw.blocks.length < 1 || raw.blocks.length > YANSI_V2_LIMITS.maxBlocks) {
    return null;
  }
  const blocks: YansiV2ContentBlock[] = [];
  for (const item of raw.blocks) {
    const block = parseBlock(item);
    if (!block) return null;
    blocks.push(block);
  }
  return { blocks };
}

function kindMatches(kind: YansiV2ContentKind, blocks: YansiV2ContentBlock[]): boolean {
  const types = new Set(blocks.map((block) => block.type));
  if (kind === 'conversation') return types.size === 1 && types.has('conversation');
  if (kind === 'image') return types.size === 1 && types.has('image');
  if (kind === 'video') return types.size === 1 && types.has('video');
  return types.size >= 2;
}

export function isYansiV2ContractMarker(raw: unknown): boolean {
  return isRecord(raw) && raw.contractVersion === YANSI_PUBLICATION_CONTRACT_V2;
}

export function hasExplicitContractVersion(raw: unknown): boolean {
  return isRecord(raw) && Object.prototype.hasOwnProperty.call(raw, 'contractVersion');
}

/**
 * Fail-closed V2 parser. Returns null on malformed V2 payloads.
 * Does not trim/mutate version numbers or rewrite hashes.
 * Callers must not fall back to V1 when any contractVersion is present.
 */
export function parseYansiV2PublicationContract(
  raw: unknown
): YansiV2PublicationContract | null {
  if (!isRecord(raw) || hasPrivateKey(raw)) return null;
  if (raw.contractVersion !== YANSI_PUBLICATION_CONTRACT_V2) return null;

  const allowedRoot = [
    'contractVersion',
    'nodeId',
    'responsePolicy',
    'contentKind',
    'contentManifest',
    'manifestHash',
    'contractHash',
    'knowledgeBundleVersionRef',
    'publicationVersion',
    'approvalMetadata',
  ] as const;
  if (!hasOnlyKeys(raw, allowedRoot)) return null;

  if (typeof raw.nodeId !== 'string' || !UUID.test(raw.nodeId)) return null;
  const responsePolicy = raw.responsePolicy;
  const contentKind = raw.contentKind;
  if (responsePolicy !== 'open' && responsePolicy !== 'grounded') return null;
  if (
    contentKind !== 'conversation' &&
    contentKind !== 'image' &&
    contentKind !== 'video' &&
    contentKind !== 'mixed'
  ) {
    return null;
  }

  const manifest = parseManifest(raw.contentManifest);
  if (!manifest || !kindMatches(contentKind, manifest.blocks)) return null;

  if (typeof raw.manifestHash !== 'string' || !HASH.test(raw.manifestHash)) return null;
  if (typeof raw.contractHash !== 'string' || !HASH.test(raw.contractHash)) return null;

  if (typeof raw.publicationVersion !== 'number' || !Number.isInteger(raw.publicationVersion)) {
    return null;
  }
  if (raw.publicationVersion < 1 || raw.publicationVersion > YANSI_V2_LIMITS.maxPublicationVersion) {
    return null;
  }

  let knowledgeBundleVersionRef: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, 'knowledgeBundleVersionRef')) {
    if (raw.knowledgeBundleVersionRef == null) {
      knowledgeBundleVersionRef = null;
    } else if (typeof raw.knowledgeBundleVersionRef === 'string' && raw.knowledgeBundleVersionRef.trim() === raw.knowledgeBundleVersionRef && raw.knowledgeBundleVersionRef) {
      knowledgeBundleVersionRef = raw.knowledgeBundleVersionRef;
    } else {
      return null;
    }
  }
  if (responsePolicy === 'grounded' && !knowledgeBundleVersionRef) return null;

  let approvalMetadata: YansiV2ApprovalMetadata | null | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, 'approvalMetadata')) {
    if (raw.approvalMetadata === null) {
      approvalMetadata = null;
    } else if (isRecord(raw.approvalMetadata) && !hasPrivateKey(raw.approvalMetadata)) {
      if (!hasOnlyKeys(raw.approvalMetadata, ['approvedBy', 'approvedAt', 'note'])) return null;
      const meta = raw.approvalMetadata;
      for (const key of ['approvedBy', 'approvedAt', 'note'] as const) {
        if (Object.prototype.hasOwnProperty.call(meta, key) && meta[key] != null && typeof meta[key] !== 'string') {
          return null;
        }
      }
      approvalMetadata = {
        approvedBy: typeof meta.approvedBy === 'string' ? meta.approvedBy : null,
        approvedAt: typeof meta.approvedAt === 'string' ? meta.approvedAt : null,
        note: typeof meta.note === 'string' ? meta.note : null,
      };
    } else {
      return null;
    }
  }

  return {
    contractVersion: YANSI_PUBLICATION_CONTRACT_V2,
    nodeId: raw.nodeId,
    responsePolicy,
    contentKind,
    contentManifest: manifest,
    manifestHash: raw.manifestHash,
    contractHash: raw.contractHash,
    knowledgeBundleVersionRef: knowledgeBundleVersionRef ?? null,
    publicationVersion: raw.publicationVersion,
    ...(approvalMetadata !== undefined ? { approvalMetadata } : {}),
  };
}
