/**
 * Stage 4C — auto-register Mirror to network on creation (share URL guarantee).
 */

import { apiClient } from '@/lib/apiClient';
import { buildMirrorCuriosityBundle } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import type { MirrorNetworkPublicApiResponse } from '@/lib/eza/mirror-network/publicTypes';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { MirrorShareIdentity } from '@/lib/eza/mirror-share/types';
import { resolveMirrorPublishLineage } from '@/lib/eza/mirror-share/resolveMirrorPublishLineage';

export type PublishMirrorToNetworkInput = {
  card: DailyMirrorCardModel;
  conversationId?: string;
  sceneImageUrl?: string | null;
};

export type PublishMirrorToNetworkSuccess = {
  ok: true;
  slug: string;
  shareUrl: string;
  publicPayload: MirrorNetworkPublicApiResponse;
};

export type PublishMirrorToNetworkFailure = {
  ok: false;
  code: string;
  message: string;
};

export type PublishMirrorToNetworkResult =
  | PublishMirrorToNetworkSuccess
  | PublishMirrorToNetworkFailure;

function buildIntelligencePrivate(card: DailyMirrorCardModel) {
  const payload = card.mirrorV3Payload;
  if (!payload) return undefined;

  return {
    mirrorBody: payload.mirrorText,
    topicSummary: payload.topic,
    evidenceLabels: (payload.conversationEvidence ?? []).map((item) => item.label).filter(Boolean),
    behavioralSnapshot: undefined,
  };
}

function buildPublishBody(input: PublishMirrorToNetworkInput) {
  const { card, conversationId, sceneImageUrl } = input;
  const payload = card.mirrorV3Payload;
  if (!payload) {
    throw new Error('mirror_v3_payload_required');
  }

  const curiosityBundle = payload.curiosityBundle ?? buildMirrorCuriosityBundle(payload);
  const lineage = resolveMirrorPublishLineage({
    conversationId,
    curiosityLineage: curiosityBundle.seed?.lineage,
  });

  return {
    cardTitle: card.headline || payload.mirrorTitle,
    cardDate: card.date,
    conversationId: conversationId?.trim() || undefined,
    sceneImageUrl: sceneImageUrl?.trim() || undefined,
    curiosityBundle,
    intelligencePrivate: buildIntelligencePrivate(card),
    safetyLevel: payload.safetyLevel ?? 'normal',
    lineageProofToken: lineage.lineageProofToken,
    guestToken: lineage.guestToken,
  };
}

function parseApiError(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== 'object') {
    return { code: 'publish_failed', message: 'Paylaşım bağlantısı hazırlanamadı.' };
  }
  const row = error as Record<string, unknown>;
  const nested = row.error as Record<string, unknown> | undefined;
  const detail = row.detail as Record<string, unknown> | string | undefined;

  if (detail && typeof detail === 'object') {
    return {
      code: String(detail.code ?? 'publish_failed'),
      message: String(detail.message ?? 'Paylaşım bağlantısı hazırlanamadı.'),
    };
  }

  return {
    code: String(nested?.error_code ?? row.error_code ?? 'publish_failed'),
    message: String(
      nested?.error_message ??
        nested?.message ??
        row.error_message ??
        row.message ??
        'Paylaşım bağlantısı hazırlanamadı.'
    ),
  };
}

export async function publishMirrorToNetwork(
  input: PublishMirrorToNetworkInput
): Promise<PublishMirrorToNetworkResult> {
  try {
    const body = buildPublishBody(input);
    const response = await apiClient.post<MirrorNetworkPublicApiResponse>(
      '/api/mirror-network/publish',
      { body, auth: true, timeoutMs: 30_000 }
    );

    if (!response.ok) {
      const parsed = parseApiError(response.error ?? response);
      return { ok: false, ...parsed };
    }

    const payload = (response.data ?? response) as MirrorNetworkPublicApiResponse;
    if (!payload.shareUrl || !payload.slug) {
      return {
        ok: false,
        code: 'publish_failed',
        message: 'Paylaşım bağlantısı hazırlanamadı.',
      };
    }

    return {
      ok: true,
      slug: payload.slug,
      shareUrl: payload.shareUrl,
      publicPayload: payload,
    };
  } catch {
    return {
      ok: false,
      code: 'publish_failed',
      message: 'Paylaşım bağlantısı hazırlanamadı.',
    };
  }
}

export function applyShareUrlToCard(
  card: DailyMirrorCardModel,
  shareUrl: string,
  slug?: string
): DailyMirrorCardModel {
  const existing = card.mirrorShare;
  if (!existing) return card;

  const mirrorShare: MirrorShareIdentity = {
    ...existing,
    shareUrl,
    networkSlug: slug ?? existing.networkSlug ?? null,
  };

  return { ...card, mirrorShare };
}

export function mergeCachedShareLinkIntoCard(
  card: DailyMirrorCardModel,
  cached: { shareUrl: string; slug: string } | null | undefined
): DailyMirrorCardModel {
  if (!cached?.shareUrl) return card;
  return applyShareUrlToCard(card, cached.shareUrl, cached.slug);
}
