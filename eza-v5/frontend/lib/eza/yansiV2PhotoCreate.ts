/**
 * Stage 3C-1 / 3C-1B — client preview model aligned with V2 image publish contract.
 * Preview must mirror what `publish_single_image_grounded_v2` seals (no silent drift).
 */

import type { BrandAsset, Knowledge, YansiV2KnowledgeSourcePin } from '@/lib/eza/businessYansi';
import { yansiV2PublicMediaPath } from '@/lib/eza/businessYansi';
import {
  YANSI_PUBLICATION_CONTRACT_V2,
  type YansiV2ImageBlock,
  type YansiV2PublicationContract,
  parseYansiV2PublicationContract,
} from '@/lib/eza/mirror/journey/yansiV2Publication';

export const YANSI_V2_PHOTO_MAX_NOTES = 8;
export const YANSI_V2_PHOTO_MAX_NOTE_CHARS = 8000;
export const YANSI_V2_PHOTO_MAX_TITLE = 200;
export const YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE = 32;

export type YansiV2PhotoDraft = {
  assetId: string;
  title: string;
  description: string;
  knowledgeNotes: string[];
  /** Bilgi Havuzu version ids selected for the AI bundle. */
  linkedKnowledgeIds: string[];
  slug: string;
};

export type LinkedKnowledgePreview = {
  id: string;
  title: string;
  category: string;
  publicAllowed: boolean;
  revision: number;
  status: string;
  aiReady: boolean;
  aiStatusLabel: string;
};

export type YansiV2PhotoPreview = {
  responsePolicy: 'grounded';
  contentKind: 'image';
  title: string;
  description: string;
  knowledgeNotes: string[];
  linkedKnowledge: LinkedKnowledgePreview[];
  image: YansiV2ImageBlock;
  /** Same block list the server seals into contentManifest. */
  contentManifest: { blocks: YansiV2ImageBlock[] };
};

export type AssetAiAvailability = {
  assetId: string;
  assetType: BrandAsset['asset_type'];
  title: string;
  /** Whether this library row can be sealed into V2 AI retrieval today. */
  aiReady: boolean;
  label: string;
};

export function publishableImageAssets(assets: BrandAsset[]): BrandAsset[] {
  return assets.filter(
    (asset) =>
      asset.asset_type === 'image' &&
      asset.status === 'published' &&
      asset.public_allowed &&
      Boolean(asset.locator),
  );
}

/** Text Bilgi Havuzu rows that the server will accept as knowledge_version pins. */
export function linkableKnowledgeRows(knowledge: Knowledge[]): Knowledge[] {
  return knowledge.filter((row) => row.status === 'published' && (row.content || '').trim().length > 0);
}

export function knowledgeAiAvailability(row: Knowledge): LinkedKnowledgePreview {
  const published = row.status === 'published';
  const hasContent = (row.content || '').trim().length > 0;
  const aiReady = published && hasContent;
  let aiStatusLabel = 'AI cevaplarında kullanılabilir';
  if (row.status === 'archived') aiStatusLabel = 'Arşivlenmiş — bağlanamaz';
  else if (!published) aiStatusLabel = 'Yayımlanmamış — bağlanamaz';
  else if (!hasContent) aiStatusLabel = 'Boş içerik — bağlanamaz';
  else if (!row.public_allowed) aiStatusLabel = 'AI kullanabilir (görüntüleme kapalı)';
  return {
    id: row.id,
    title: row.title,
    category: row.category || '',
    publicAllowed: row.public_allowed,
    revision: row.revision,
    status: row.status,
    aiReady,
    aiStatusLabel,
  };
}

/**
 * Honest AI readiness for library media. Place/link have no V2 bundle kind.
 * Image/video bytes alone are not AI understanding without sealed observations.
 */
export function assetAiAvailability(asset: BrandAsset): AssetAiAvailability {
  if (asset.asset_type === 'place') {
    return {
      assetId: asset.id,
      assetType: asset.asset_type,
      title: asset.title,
      aiReady: false,
      label: 'Henüz AI cevaplarında kullanılamıyor (konum bundle türü yok)',
    };
  }
  if (asset.asset_type === 'link') {
    return {
      assetId: asset.id,
      assetType: asset.asset_type,
      title: asset.title,
      aiReady: false,
      label: 'Henüz AI cevaplarında kullanılamıyor (URL snapshot yok)',
    };
  }
  if (asset.asset_type === 'video') {
    return {
      assetId: asset.id,
      assetType: asset.asset_type,
      title: asset.title,
      aiReady: false,
      label: 'Video dosyası saklanır; onaylı gözlem/transkript olmadan AI metin cevabına girmez',
    };
  }
  return {
    assetId: asset.id,
    assetType: asset.asset_type,
    title: asset.title,
    aiReady: false,
    label: 'Görsel dosya saklanır; yayın fotoğrafı ayrı seçilir. Pool metni AI cevabı için bağlanır',
  };
}

export function normalizePhotoDraft(draft: YansiV2PhotoDraft): YansiV2PhotoDraft {
  const linked: string[] = [];
  const seen = new Set<string>();
  for (const id of draft.linkedKnowledgeIds || []) {
    const key = String(id || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    linked.push(String(id).trim());
    if (linked.length >= YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE) break;
  }
  return {
    assetId: draft.assetId,
    title: draft.title.trim().slice(0, YANSI_V2_PHOTO_MAX_TITLE),
    description: draft.description.trim().slice(0, YANSI_V2_PHOTO_MAX_NOTE_CHARS),
    knowledgeNotes: draft.knowledgeNotes
      .map((note) => note.trim())
      .filter(Boolean)
      .slice(0, YANSI_V2_PHOTO_MAX_NOTES)
      .map((note) => note.slice(0, YANSI_V2_PHOTO_MAX_NOTE_CHARS)),
    linkedKnowledgeIds: linked,
    slug: draft.slug.trim().slice(0, 80),
  };
}

export function buildKnowledgeSourcePins(
  draft: YansiV2PhotoDraft,
  knowledge: Knowledge[],
): YansiV2KnowledgeSourcePin[] {
  const normalized = normalizePhotoDraft(draft);
  const byId = new Map(knowledge.map((row) => [row.id, row]));
  const pins: YansiV2KnowledgeSourcePin[] = [];
  for (const id of normalized.linkedKnowledgeIds) {
    const row = byId.get(id);
    if (!row) continue;
    const avail = knowledgeAiAvailability(row);
    if (!avail.aiReady) continue;
    pins.push({ knowledgeVersionId: row.id, expectedRevision: row.revision });
  }
  return pins;
}

export function buildPhotoPreviewManifest(
  businessId: string,
  asset: BrandAsset,
  draft: YansiV2PhotoDraft,
  knowledge: Knowledge[] = [],
): YansiV2PhotoPreview | null {
  const normalized = normalizePhotoDraft(draft);
  if (!normalized.assetId || normalized.assetId !== asset.id) return null;
  if (!normalized.title) return null;
  if (asset.asset_type !== 'image') return null;

  const image: YansiV2ImageBlock = {
    type: 'image',
    assetId: asset.id,
    title: (asset.title || normalized.title).trim().slice(0, YANSI_V2_PHOTO_MAX_TITLE) || normalized.title,
    contentPath: yansiV2PublicMediaPath(businessId, asset.id),
  };

  const byId = new Map(knowledge.map((row) => [row.id, row]));
  const linkedKnowledge: LinkedKnowledgePreview[] = [];
  for (const id of normalized.linkedKnowledgeIds) {
    const row = byId.get(id);
    if (!row) continue;
    linkedKnowledge.push(knowledgeAiAvailability(row));
  }

  return {
    responsePolicy: 'grounded',
    contentKind: 'image',
    title: normalized.title,
    description: normalized.description,
    knowledgeNotes: normalized.knowledgeNotes,
    linkedKnowledge,
    image,
    contentManifest: { blocks: [image] },
  };
}

/** Assert published public.contract matches the preview manifest (shape + media path). */
export function previewMatchesPublishedContract(
  preview: YansiV2PhotoPreview,
  publishedContract: unknown,
): boolean {
  const parsed = parseYansiV2PublicationContract(publishedContract);
  if (!parsed) return false;
  if (parsed.responsePolicy !== 'grounded') return false;
  if (parsed.contentKind !== 'image') return false;
  if (parsed.contractVersion !== YANSI_PUBLICATION_CONTRACT_V2) return false;
  if (parsed.contentManifest.blocks.length !== 1) return false;
  const block = parsed.contentManifest.blocks[0];
  if (block.type !== 'image') return false;
  return (
    block.assetId.toLowerCase() === preview.image.assetId.toLowerCase() &&
    block.contentPath === preview.image.contentPath
  );
}

/** Confirm sealed bundle contains every linked knowledge version id. */
export function sealedBundleIncludesKnowledge(
  publishedBundle: unknown,
  linkedIds: string[],
): boolean {
  if (!linkedIds.length) return true;
  if (!publishedBundle || typeof publishedBundle !== 'object') return false;
  const items = (publishedBundle as { items?: unknown }).items;
  if (!Array.isArray(items)) return false;
  const sealed = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (row.sourceKind !== 'knowledge_version') continue;
    if (typeof row.sourceRefId === 'string') sealed.add(row.sourceRefId.toLowerCase());
  }
  return linkedIds.every((id) => sealed.has(id.toLowerCase()));
}

export function publishedContractAsPreviewTitle(contract: YansiV2PublicationContract | null): string | null {
  if (!contract) return null;
  const block = contract.contentManifest.blocks[0];
  if (!block || block.type !== 'image') return null;
  return block.title;
}

export function photoDraftStorageKey(businessId: string): string {
  return `bilign:yansi-v2-photo-draft:${businessId}`;
}

export function writePhotoDraftStorage(businessId: string, draft: YansiV2PhotoDraft): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(photoDraftStorageKey(businessId), JSON.stringify(normalizePhotoDraft(draft)));
  } catch {
    /* quota / private mode */
  }
}

export function readPhotoDraftStorage(businessId: string): YansiV2PhotoDraft | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(photoDraftStorageKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<YansiV2PhotoDraft>;
    return normalizePhotoDraft({
      assetId: String(parsed.assetId || ''),
      title: String(parsed.title || ''),
      description: String(parsed.description || ''),
      knowledgeNotes: Array.isArray(parsed.knowledgeNotes) ? parsed.knowledgeNotes.map(String) : [''],
      linkedKnowledgeIds: Array.isArray(parsed.linkedKnowledgeIds)
        ? parsed.linkedKnowledgeIds.map(String)
        : [],
      slug: String(parsed.slug || ''),
    });
  } catch {
    return null;
  }
}

export function clearPhotoDraftStorage(businessId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(photoDraftStorageKey(businessId));
  } catch {
    /* ignore */
  }
}
