/**
 * Premium İlişki Deseni — cihaz bazlı durum ve arşiv backfill.
 */

import {
  readBehavioralHistory,
  seedBehavioralHistoryFromEntries,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';
import {
  readChatArchives,
  type ArchivedChat,
  type ArchivedChatMessage,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import { buildRelationshipDashboardMetrics } from '@/lib/eza/mirror/relationshipPatternMetrics';
import type { StandaloneObservation } from '@/lib/types';
import type { BackendUserCategory } from '@/lib/standaloneObservation';

export const PATTERN_DEVICE_NOTIFICATION_BODY =
  'Sohbetlerin var, ancak ilişki deseni bu cihazda henüz oluşmadı.';

/** @deprecated Shown in notification center only — not sidebar. */
export const PATTERN_DEVICE_SIDEBAR_NOTICE = PATTERN_DEVICE_NOTIFICATION_BODY;

export type PatternSystemNotification = {
  id: string;
  title: string;
  body: string;
  type: 'pattern_device' | 'mirror' | 'system';
};

export function buildPatternSystemNotifications(
  deviceState: PatternDeviceState
): PatternSystemNotification[] {
  if (deviceState === 'chats_pending_pattern') {
    return [
      {
        id: 'pattern-device-pending',
        title: 'İlişki Deseni',
        body: PATTERN_DEVICE_NOTIFICATION_BODY,
        type: 'pattern_device',
      },
    ];
  }
  return [];
}

export const PATTERN_DEVICE_EMPTY_TITLE = 'Bu cihazda henüz oluşmadı';

export const PATTERN_DEVICE_EMPTY_HINT =
  'Bu cihazda ilişki deseni henüz oluşmadı. Sohbet ettikçe burada şekillenecek.';

export const PATTERN_DEVICE_DEFAULT_EMPTY_HINT =
  'Sohbet ettikçe davranış adaların burada şekillenecek.';

export type PatternDeviceState =
  | 'free'
  | 'has_data'
  | 'empty_no_chats'
  | 'chats_pending_pattern';

export type PatternDeviceResolveInput = {
  isPremium: boolean;
  entries: SavedBehavioralEntry[];
  archives: ArchivedChatSummary[];
};

export type ArchiveBackfillResult = {
  attempted: boolean;
  seeded: boolean;
  entryCount: number;
  reason: 'not_needed' | 'no_archives' | 'no_pairs' | 'seeded' | 'already_has_history';
};

type ArchiveTurnPair = {
  user: ArchivedChatMessage;
  assistant?: ArchivedChatMessage;
  savedAt: string;
};

function inferBackendUserCategory(userText: string): BackendUserCategory {
  const t = userText.toLowerCase();
  if (/karar|seçim|hangi\s|mı\s|mi\s|should\s+i|decide|choose/.test(t)) {
    return 'decision_direction';
  }
  if (/fikir|tasar|brainstorm|yarat|geliştir|design|mvp|ürün/.test(t)) {
    return 'ideation_creation';
  }
  if (/gezi|gez|seyahat|rota|nerede|nereye|keşif|explor|discover|merak|travel|trip/.test(t)) {
    return 'curiosity_exploration';
  }
  if (/netlik|açıkla|nasıl|doğrula|clarif|explain|how\s+to/.test(t)) {
    return 'clarity_simplification';
  }
  if (/derin|analiz|felsefe|teori|deep|underlying/.test(t)) {
    return 'deep_thinking';
  }
  if (/hassas|dikkat|careful|sensitive|güvenli/.test(t)) {
    return 'sensitive_careful';
  }
  return 'balanced_calm';
}

function buildArchiveBackfillObservation(userText: string): StandaloneObservation {
  const category = inferBackendUserCategory(userText);
  return {
    user_pattern: { category, confidence: 0.62, signals: ['archive_backfill'] },
    ai_behavior: { category: 'explanatory', confidence: 0.6, signals: ['archive_backfill'] },
    relationship_balance: { category: 'calm_rhythm', confidence: 0.6, signals: ['archive_backfill'] },
    observation_quality: 'low',
    can_interpret: true,
  };
}

function scoreToHealth(score?: number): number {
  if (score == null || Number.isNaN(score)) return 0.82;
  const normalized = score <= 1 ? score : score / 100;
  return Math.min(0.95, Math.max(0.35, normalized));
}

function scoreToRisk(score?: number): number {
  const health = scoreToHealth(score);
  return Math.max(0.08, Math.min(0.45, 1 - health));
}

function buildSnapshotFromArchivePair(
  pair: ArchiveTurnPair,
  index: number
): SavedBehavioralEntry {
  const id = `archive-${pair.user.id}-${index}`;
  const inputHealth = scoreToHealth(pair.user.userScore);
  const outputHealth = scoreToHealth(pair.assistant?.assistantScore);
  const align =
    pair.user.userScore != null && pair.assistant?.assistantScore != null
      ? Math.round((pair.user.userScore + pair.assistant.assistantScore) / 2)
      : 72;

  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: pair.savedAt,
    vector: {
      input_risk: scoreToRisk(pair.user.userScore),
      output_risk: scoreToRisk(pair.assistant?.assistantScore),
      input_health: inputHealth,
      output_health: outputHealth,
      alignment_score: align,
      eza_final: align,
      intent: inferBackendUserCategory(pair.user.text),
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: {
      health_gap: Math.abs(inputHealth - outputHealth),
      risk_delta_output_minus_input: 0,
      index: 0.12,
    },
    standaloneObservation: buildArchiveBackfillObservation(pair.user.text),
  };
}

export function collectArchiveTurnPairs(chats: ArchivedChat[]): ArchiveTurnPair[] {
  const pairs: ArchiveTurnPair[] = [];

  for (const chat of chats) {
    const msgs = chat.messages ?? [];
    for (let i = 0; i < msgs.length; i += 1) {
      const msg = msgs[i];
      if (!msg?.isUser || !msg.text.trim()) continue;
      const next = msgs[i + 1];
      const assistant = next && !next.isUser ? next : undefined;
      pairs.push({
        user: msg,
        assistant,
        savedAt:
          assistant?.timestamp ??
          msg.timestamp ??
          chat.savedAt ??
          new Date().toISOString(),
      });
    }
  }

  return pairs.sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
  );
}

export function buildBehavioralEntriesFromArchives(chats: ArchivedChat[]): SavedBehavioralEntry[] {
  const pairs = collectArchiveTurnPairs(chats);
  if (!pairs.length) return [];
  const recent = pairs.slice(-50);
  return recent.map((pair, index) => buildSnapshotFromArchivePair(pair, index));
}

export function archivesHaveMessages(archives: ArchivedChatSummary[]): boolean {
  return archives.some((a) => a.messageCount > 0);
}

export function backfillBehavioralHistoryFromArchives(): ArchiveBackfillResult {
  if (typeof window === 'undefined') {
    return { attempted: false, seeded: false, entryCount: 0, reason: 'not_needed' };
  }

  if (readBehavioralHistory().length > 0) {
    return { attempted: false, seeded: false, entryCount: 0, reason: 'already_has_history' };
  }

  const chats = readChatArchives().filter((c) => c.messageCount > 0);
  if (!chats.length) {
    return { attempted: true, seeded: false, entryCount: 0, reason: 'no_archives' };
  }

  const entries = buildBehavioralEntriesFromArchives(chats);
  if (!entries.length) {
    return { attempted: true, seeded: false, entryCount: 0, reason: 'no_pairs' };
  }

  const seeded = seedBehavioralHistoryFromEntries(entries);
  return {
    attempted: true,
    seeded,
    entryCount: seeded ? entries.length : 0,
    reason: seeded ? 'seeded' : 'no_pairs',
  };
}

export function resolvePatternDeviceState(input: PatternDeviceResolveInput): PatternDeviceState {
  if (!input.isPremium) return 'free';

  const hasChats = archivesHaveMessages(input.archives);
  const metrics =
    input.entries.length > 0
      ? buildRelationshipDashboardMetrics(input.entries, 30)
      : null;
  const hasPattern = metrics != null && !metrics.isEmpty;

  if (hasPattern) return 'has_data';
  if (hasChats) return 'chats_pending_pattern';
  return 'empty_no_chats';
}
