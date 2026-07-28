import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  CONVERSATION_MIRROR_SNAPSHOTS_STORAGE_KEY,
  clearConversationMirrorSnapshot,
  hasPersistedConversationMirror,
  resolveConversationMirrorRefreshCta,
  saveConversationMirrorSnapshot,
} from '@/lib/eza/mirror/conversationMirrorSnapshot';
import {
  CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY,
  clearConversationMirrorSceneCache,
} from '@/lib/eza/mirror/mirrorSceneCache';
import { MIRROR_V3_SCENE_CACHE_KEY } from '@/lib/eza/mirror/conversationMirrorV3/types';
import {
  saveStandaloneChat,
  setConversationSceneIdentity,
  deleteChatArchive,
} from '@/lib/standaloneChatArchive';

function entry(savedAt: string, id: string): SavedBehavioralEntry {
  return {
    savedAt,
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    vector: {
      input_risk: 0.2,
      output_risk: 0.15,
      input_health: 0.8,
      output_health: 0.85,
      alignment_score: null,
      eza_final: null,
      intent: '',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.05, risk_delta_output_minus_input: -0.05, index: 0.1 },
  };
}

const CHAT_ID = 'chat-kesfet-restore';
const SCENE_URL = 'https://cdn.example.com/mardin-scene.png';

describe('conversationMirrorRefreshCta — Keşfet remount', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    clearConversationMirrorSnapshot(CHAT_ID);
    clearConversationMirrorSceneCache(CHAT_ID);
    deleteChatArchive(CHAT_ID);
    localStorage.removeItem(CONVERSATION_MIRROR_SNAPSHOTS_STORAGE_KEY);
    localStorage.removeItem(CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY);
  });

  it('is open_first when nothing is persisted for the conversation', () => {
    const entries = [
      entry('2026-06-01T10:00:00Z', 'a'),
      entry('2026-06-01T10:01:00Z', 'b'),
      entry('2026-06-01T10:02:00Z', 'c'),
    ];
    expect(hasPersistedConversationMirror(CHAT_ID)).toBe(false);
    expect(resolveConversationMirrorRefreshCta(CHAT_ID, entries)).toBe('open_first');
  });

  it('treats scene cache alone as current (snapshot missing after Discover remount)', () => {
    localStorage.setItem(
      CONVERSATION_MIRROR_SCENE_CACHE_STORAGE_KEY,
      JSON.stringify({
        [CHAT_ID]: {
          cardDate: '2026-06-01',
          intentFingerprint: `${MIRROR_V3_SCENE_CACHE_KEY}:golden_hour:d2:Merak:${CHAT_ID}`,
          sceneImageUrl: SCENE_URL,
          cachedAt: '2026-06-01T12:00:00.000Z',
        },
      })
    );

    const entries = [
      entry('2026-06-01T10:00:00Z', 'a'),
      entry('2026-06-01T10:01:00Z', 'b'),
      entry('2026-06-01T10:02:00Z', 'c'),
    ];

    expect(hasPersistedConversationMirror(CHAT_ID)).toBe(true);
    expect(resolveConversationMirrorRefreshCta(CHAT_ID, entries)).toBe('current');
  });

  it('treats archive conversationSceneUrl alone as current', () => {
    saveStandaloneChat(CHAT_ID, [
      { id: 'm1', text: 'Merhaba Mardin', isUser: true },
      { id: 'm2', text: 'Taş sokaklar…', isUser: false },
    ]);
    setConversationSceneIdentity(CHAT_ID, {
      url: SCENE_URL,
      source: 'mirror_local',
    });

    const entries = [
      entry('2026-06-01T10:00:00Z', 'a'),
      entry('2026-06-01T10:01:00Z', 'b'),
      entry('2026-06-01T10:02:00Z', 'c'),
    ];

    expect(hasPersistedConversationMirror(CHAT_ID)).toBe(true);
    expect(resolveConversationMirrorRefreshCta(CHAT_ID, entries)).toBe('current');
  });

  it('returns update when snapshot exists and entries advanced', () => {
    const base = [
      entry('2026-06-01T10:00:00Z', 'a'),
      entry('2026-06-01T10:01:00Z', 'b'),
      entry('2026-06-01T10:02:00Z', 'c'),
    ];
    saveConversationMirrorSnapshot(CHAT_ID, base, '2026-06-01', new Date('2026-06-01T12:00:00Z'));

    const next = [...base, entry('2026-06-01T13:00:00Z', 'd')];
    expect(resolveConversationMirrorRefreshCta(CHAT_ID, next)).toBe('update');
  });
});
