/**
 * Stage 02B — client helpers for V2 frozen conversation Studio (1–8 turns).
 * Aligns with conversation_draft_v2 / publish_conversation_v2; no AI generation.
 */

import type {
  BrandAsset,
  Knowledge,
  YansiV2ConversationDraftDto,
  YansiV2ConversationDraftInput,
  YansiV2ConversationTurn,
  YansiV2KnowledgeSourcePin,
  YansiV2ProposalResult,
} from '@/lib/eza/businessYansi';
import {
  buildKnowledgeSourcePins,
  knowledgeAiAvailability,
  linkableKnowledgeRows,
  publishableImageAssets,
  type LinkedKnowledgePreview,
} from '@/lib/eza/yansiV2PhotoCreate';

export const YANSI_V2_CONV_MIN_TURNS = 1;
export const YANSI_V2_CONV_MAX_TURNS = 8;
export const YANSI_V2_CONV_MAX_TITLE = 200;
export const YANSI_V2_CONV_MAX_TEXT = 8000;
export const YANSI_V2_CONV_STORAGE_PREFIX = 'bilign.yansi.v2.conversation.draft.v1:';

export type YansiV2ConversationLocalDraft = {
  draftId: string | null;
  revision: number | null;
  status: string | null;
  title: string;
  summary: string;
  slug: string;
  coverAssetId: string;
  linkedKnowledgeIds: string[];
  knowledgeNotes: string[];
  turns: Array<{
    question: string;
    answer: string;
    mediaAssetId: string;
  }>;
};

export type YansiV2ConversationPreview = {
  title: string;
  summary: string;
  curiosityQuestion: string;
  turnCount: number;
  turns: Array<{
    stepIndex: number;
    question: string;
    answer: string;
    mediaTitle: string | null;
  }>;
  coverTitle: string | null;
  linkedKnowledge: LinkedKnowledgePreview[];
  knowledgeNotes: string[];
  mediaOptional: true;
};

export function emptyConversationLocalDraft(): YansiV2ConversationLocalDraft {
  return {
    draftId: null,
    revision: null,
    status: null,
    title: '',
    summary: '',
    slug: '',
    coverAssetId: '',
    linkedKnowledgeIds: [],
    knowledgeNotes: [''],
    turns: [{ question: '', answer: '', mediaAssetId: '' }],
  };
}

export function reindexTurns(
  turns: YansiV2ConversationLocalDraft['turns'],
): YansiV2ConversationLocalDraft['turns'] {
  return turns.slice(0, YANSI_V2_CONV_MAX_TURNS).map((turn) => ({
    question: turn.question,
    answer: turn.answer,
    mediaAssetId: turn.mediaAssetId || '',
  }));
}

export function canAddTurn(turns: YansiV2ConversationLocalDraft['turns']): boolean {
  return turns.length < YANSI_V2_CONV_MAX_TURNS;
}

export function addTurn(
  turns: YansiV2ConversationLocalDraft['turns'],
): YansiV2ConversationLocalDraft['turns'] {
  if (!canAddTurn(turns)) return turns;
  return reindexTurns([...turns, { question: '', answer: '', mediaAssetId: '' }]);
}

export function removeTurn(
  turns: YansiV2ConversationLocalDraft['turns'],
  index: number,
): YansiV2ConversationLocalDraft['turns'] {
  if (turns.length <= YANSI_V2_CONV_MIN_TURNS) return turns;
  return reindexTurns(turns.filter((_, i) => i !== index));
}

export function moveTurn(
  turns: YansiV2ConversationLocalDraft['turns'],
  from: number,
  to: number,
): YansiV2ConversationLocalDraft['turns'] {
  if (from < 0 || to < 0 || from >= turns.length || to >= turns.length || from === to) {
    return turns;
  }
  const next = [...turns];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return reindexTurns(next);
}

export function normalizeConversationLocalDraft(
  draft: YansiV2ConversationLocalDraft,
): YansiV2ConversationLocalDraft {
  const linked: string[] = [];
  const seen = new Set<string>();
  for (const id of draft.linkedKnowledgeIds || []) {
    const key = String(id || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    linked.push(String(id).trim());
    if (linked.length >= 32) break;
  }
  const turns = reindexTurns(
    (draft.turns?.length ? draft.turns : [{ question: '', answer: '', mediaAssetId: '' }]).slice(
      0,
      YANSI_V2_CONV_MAX_TURNS,
    ),
  );
  return {
    ...draft,
    title: (draft.title || '').slice(0, YANSI_V2_CONV_MAX_TITLE),
    summary: (draft.summary || '').slice(0, 500),
    slug: (draft.slug || '').trim().slice(0, 80),
    coverAssetId: draft.coverAssetId || '',
    linkedKnowledgeIds: linked,
    knowledgeNotes: (draft.knowledgeNotes || [''])
      .map((n) => String(n || '').slice(0, 8000))
      .slice(0, 8),
    turns: turns.map((t) => ({
      question: String(t.question || '').slice(0, YANSI_V2_CONV_MAX_TEXT),
      answer: String(t.answer || '').slice(0, YANSI_V2_CONV_MAX_TEXT),
      mediaAssetId: t.mediaAssetId || '',
    })),
  };
}

export function validateConversationCompose(
  draft: YansiV2ConversationLocalDraft,
): string | null {
  const normalized = normalizeConversationLocalDraft(draft);
  if (!normalized.title.trim()) return 'Başlık gerekli.';
  if (normalized.turns.length < YANSI_V2_CONV_MIN_TURNS) return 'En az 1 soru-cevap gerekli.';
  if (normalized.turns.length > YANSI_V2_CONV_MAX_TURNS) return 'En fazla 8 soru-cevap eklenebilir.';
  for (let i = 0; i < normalized.turns.length; i += 1) {
    const turn = normalized.turns[i];
    if (!turn.question.trim() || !turn.answer.trim()) {
      return `${i + 1}. turda soru ve cevap boş olamaz.`;
    }
  }
  return null;
}

export function buildConversationApiInput(
  draft: YansiV2ConversationLocalDraft,
  assets: BrandAsset[],
  knowledge: Knowledge[],
): YansiV2ConversationDraftInput {
  const normalized = normalizeConversationLocalDraft(draft);
  const images = publishableImageAssets(assets);
  const turns: YansiV2ConversationTurn[] = normalized.turns.map((turn, index) => {
    const item: YansiV2ConversationTurn = {
      stepIndex: index + 1,
      question: turn.question.trim(),
      answer: turn.answer.trim(),
    };
    if (turn.mediaAssetId) {
      const asset = images.find((row) => row.id === turn.mediaAssetId);
      if (asset) {
        item.media = [
          {
            type: 'image',
            assetId: asset.id,
            assetRevision: asset.revision,
            title: asset.title || 'Görsel',
          },
        ];
      }
    }
    return item;
  });
  const coverId = (normalized.coverAssetId || '').trim();
  const cover = coverId ? images.find((row) => row.id === coverId) || null : null;
  const pins = buildKnowledgeSourcePins(
    {
      assetId: '',
      title: normalized.title,
      description: '',
      knowledgeNotes: normalized.knowledgeNotes,
      linkedKnowledgeIds: normalized.linkedKnowledgeIds,
      slug: normalized.slug,
    },
    knowledge,
  );
  const notes = normalized.knowledgeNotes.map((n) => n.trim()).filter(Boolean);
  const input: YansiV2ConversationDraftInput = {
    title: normalized.title.trim(),
    summary: normalized.summary.trim() || null,
    turns,
    knowledgeNotes: notes.length ? notes : null,
    knowledgeSources: pins.length ? pins : null,
  };
  // Three-state cover for revise PATCH:
  // - no local cover → explicit null (clear)
  // - cover in publishable catalog → send id + revision
  // - cover selected but catalog refresh lag → omit (backend keeps binding)
  // Never send an unvalidated asset id that skipped eligibility checks.
  if (!coverId) {
    input.coverAssetId = null;
  } else if (cover) {
    input.coverAssetId = cover.id;
    input.coverAssetRevision = cover.revision;
  }
  return input;
}

export function buildConversationPreview(
  draft: YansiV2ConversationLocalDraft,
  assets: BrandAsset[],
  knowledge: Knowledge[],
): YansiV2ConversationPreview | null {
  const err = validateConversationCompose(draft);
  if (err) return null;
  const normalized = normalizeConversationLocalDraft(draft);
  const images = publishableImageAssets(assets);
  const cover = images.find((row) => row.id === normalized.coverAssetId) || null;
  const linked = linkableKnowledgeRows(knowledge)
    .filter((row) => normalized.linkedKnowledgeIds.includes(row.id))
    .map(knowledgeAiAvailability);
  return {
    title: normalized.title.trim(),
    summary: normalized.summary.trim(),
    curiosityQuestion: normalized.turns[0].question.trim(),
    turnCount: normalized.turns.length,
    turns: normalized.turns.map((turn, index) => {
      const media = images.find((row) => row.id === turn.mediaAssetId);
      return {
        stepIndex: index + 1,
        question: turn.question.trim(),
        answer: turn.answer.trim(),
        mediaTitle: media?.title || null,
      };
    }),
    coverTitle: cover?.title || null,
    linkedKnowledge: linked,
    knowledgeNotes: normalized.knowledgeNotes.map((n) => n.trim()).filter(Boolean),
    mediaOptional: true,
  };
}

export function applyServerDraft(
  local: YansiV2ConversationLocalDraft,
  server: YansiV2ConversationDraftDto,
): YansiV2ConversationLocalDraft {
  return normalizeConversationLocalDraft({
    ...local,
    draftId: server.id,
    revision: server.revision,
    status: server.status,
    title: server.title,
    summary: server.summary || '',
    coverAssetId: server.coverAssetId || '',
    linkedKnowledgeIds: (server.knowledgeSourcePins || []).map((p) => p.knowledgeVersionId),
    knowledgeNotes: server.knowledgeNotes?.length ? server.knowledgeNotes : [''],
    turns: (server.turns || []).map((turn) => ({
      question: turn.question,
      answer: turn.answer,
      mediaAssetId: turn.media?.[0]?.assetId || '',
    })),
  });
}

/** Preview-only map from AI proposal → local draft fields (does not mark as saved). */
export function applyProposalToLocalDraft(
  local: YansiV2ConversationLocalDraft,
  proposal: YansiV2ProposalResult,
): YansiV2ConversationLocalDraft {
  const pinIds = (proposal.knowledgeSourcePins || [])
    .map((p) => p.knowledgeVersionId)
    .filter(Boolean);
  return normalizeConversationLocalDraft({
    ...local,
    title: proposal.title || local.title,
    summary: proposal.summary || '',
    coverAssetId: proposal.coverSuggestion?.assetId || local.coverAssetId,
    linkedKnowledgeIds: pinIds.length ? pinIds : local.linkedKnowledgeIds,
    turns: (proposal.turns || []).map((turn) => ({
      question: turn.question,
      answer: turn.answer,
      mediaAssetId: turn.mediaSuggestions?.[0]?.assetId || '',
    })),
  });
}

export function conversationStorageKey(businessId: string): string {
  return `${YANSI_V2_CONV_STORAGE_PREFIX}${businessId}`;
}

export function readConversationDraftStorage(businessId: string): YansiV2ConversationLocalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(conversationStorageKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as YansiV2ConversationLocalDraft;
    return normalizeConversationLocalDraft(parsed);
  } catch {
    return null;
  }
}

export function writeConversationDraftStorage(
  businessId: string,
  draft: YansiV2ConversationLocalDraft,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      conversationStorageKey(businessId),
      JSON.stringify(normalizeConversationLocalDraft(draft)),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearConversationDraftStorage(businessId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(conversationStorageKey(businessId));
  } catch {
    /* ignore */
  }
}

export function conversationErrorMessage(error: { code?: string; message?: string } | unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';
  const map: Record<string, string> = {
    owner_required: 'Bu işlem yalnızca Business owner tarafından yapılabilir.',
    editor_required: 'Düzenleme için editor veya owner yetkisi gerekir.',
    membership_required: 'Bu Business üyesi değilsiniz.',
    turns_too_few: 'En az 1 soru-cevap gerekli.',
    turns_too_many: 'En fazla 8 soru-cevap eklenebilir.',
    frozen_turn_empty: 'Soru ve cevap boş olamaz.',
    frozen_turn_order_invalid: 'Tur sıralaması 1’den başlayıp kesintisiz olmalıdır.',
    approval_required: 'Yayın için marka onayı gerekli.',
    approval_stale: 'Onay eski kaldı. İçerik değiştiyse yeniden onaylayın.',
    revision_conflict:
      'Taslak veya varlık sürümü değişmiş. Sayfayı yenileyip güncel revision ile tekrar deneyin.',
    draft_not_found: 'Taslak bulunamadı.',
    draft_immutable: 'Yayımlanmış taslak düzenlenemez; yeni sürüm için yeni taslak kullanın.',
    foreign_tenant_asset: 'Başka Business medyası kullanılamaz.',
    foreign_tenant_knowledge: 'Başka Business bilgi kaydı bağlanamaz.',
    asset_not_published: 'Medya yayımlanmış ve kamuya açık olmalıdır.',
    knowledge_source_not_ready: 'Bağlanan bilgi kaydı yayımlanmış olmalıdır.',
    slug_taken: 'Bu slug kullanımda.',
    invalid_title: 'Başlık geçersiz.',
    invalid_transition: 'Bu durum geçişi izinli değil.',
    studio_admission_disabled: 'AI Yansı Stüdyosu bu ortamda henüz açık değil.',
    studio_execution_not_implemented: 'AI üretim henüz etkin değil. Elle yazmayı kullanabilirsiniz.',
    studio_insufficient_sources: 'AI önerisi için yayımlanmış kaynak yetersiz.',
    proposal_not_ready: 'AI önerisi henüz hazır değil veya başarısız.',
    studio_generation_not_found: 'AI önerisi bulunamadı.',
    studio_timeout: 'AI üretimi zaman aşımına uğradı. Kaynaklarınız duruyor; tekrar deneyebilirsiniz.',
    studio_provider_failed: 'AI sağlayıcısında geçici bir sorun oluştu. Tekrar deneyin.',
    studio_business_budget_exceeded: 'Günlük AI bütçesi doldu. Elle yazabilir veya yarın tekrar deneyebilirsiniz.',
  };
  if (code && map[code]) return map[code];
  if (error instanceof Error) return error.message;
  return 'İşlem başarısız oldu.';
}

/** Soft cover notice when AI did not attach a cover — not a proposal failure. */
export const COVER_NONE_YET_MESSAGE =
  'Henüz kapak seçilmedi. İnceleme aşamasında kapak ekleyebilirsiniz.';

const COVER_SKIP_CODES = new Set(['cover_skipped', 'cover_not_eligible']);

/**
 * Map proposal warnings for UI. Cover eligibility skips stay notices (proposal still valid).
 * Empty library → friendly copy; real eligibility failures keep the server message.
 */
export function formatConversationProposalWarning(
  warning: { code?: string; message?: string },
  opts: { coverLibraryEmpty: boolean },
): { code: string; message: string; soft: boolean } {
  const code = String(warning.code || '');
  if (COVER_SKIP_CODES.has(code)) {
    if (opts.coverLibraryEmpty) {
      return { code, message: COVER_NONE_YET_MESSAGE, soft: true };
    }
    return {
      code,
      message:
        (warning.message && String(warning.message).trim()) ||
        'Kapak önerisi uygunluk kontrolünden geçmedi.',
      soft: true,
    };
  }
  return {
    code,
    message: (warning.message && String(warning.message).trim()) || code || 'Uyarı',
    soft: false,
  };
}

export function pinsFromLocal(
  draft: YansiV2ConversationLocalDraft,
  knowledge: Knowledge[],
): YansiV2KnowledgeSourcePin[] {
  return buildKnowledgeSourcePins(
    {
      assetId: '',
      title: draft.title,
      description: '',
      knowledgeNotes: draft.knowledgeNotes,
      linkedKnowledgeIds: draft.linkedKnowledgeIds,
      slug: draft.slug,
    },
    knowledge,
  );
}
