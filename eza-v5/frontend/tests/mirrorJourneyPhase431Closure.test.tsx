/**
 * Phase 4.3.1 — processing write-path closure + user-scoped behavioral history.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import ChatBubble from '@/components/standalone/ChatBubble';
import {
  appendBehavioralSnapshot,
  behavioralHistoryStorageKey,
  clearBehavioralHistory,
  LEGACY_BEHAVIORAL_HISTORY_STORAGE_KEY,
  readBehavioralHistory,
  seedBehavioralHistoryFromEntries,
} from '@/lib/behavioralHistory';
import {
  clearEzaUserPreferencesForTests,
  setEzaUserPreferences,
  shouldProcessExperienceForEzaProfile,
  shouldShowEzaInExperience,
} from '@/lib/eza/ezaUserPrefs';
import { persistChatTurnFromResponse } from '@/lib/eza/mirror/conversationMirrorEntries';
import { backfillBehavioralHistoryFromArchives } from '@/lib/eza/patternDeviceSync';

const SAMPLE = {
  schema_version: 1 as const,
  interaction_id: 'asst-1',
  mode: 'standalone' as const,
  vector: {
    input_risk: 0.1,
    output_risk: 0.1,
    input_health: 0.8,
    output_health: 0.9,
    alignment_score: 0.7,
    eza_final: 88,
    intent: 'explore',
    alignment_verdict: null,
    redirect: false,
    redirect_reason: null,
    policy_violation_count: 0,
  },
  asymmetry: {
    health_gap: 0.1,
    risk_delta_output_minus_input: 0,
    index: 0.1,
  },
};

beforeEach(() => {
  clearEzaUserPreferencesForTests();
  localStorage.clear();
});

describe('Phase 4.3.1 processing write paths', () => {
  it('M. processing ON → append allowed', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: true });
    appendBehavioralSnapshot(SAMPLE, null, { ownerUserId: 'alice' });
    expect(readBehavioralHistory('alice')).toHaveLength(1);
  });

  it('N. processing OFF → append blocked', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: false });
    persistChatTurnFromResponse({
      userText: 'q',
      interactionId: 'asst-1',
      behavioral: SAMPLE,
      ownerUserId: 'alice',
    });
    expect(readBehavioralHistory('alice')).toHaveLength(0);
  });

  it('O. processing OFF → snapshot write blocked', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: false });
    appendBehavioralSnapshot(SAMPLE, null, { ownerUserId: 'alice' });
    expect(readBehavioralHistory('alice')).toHaveLength(0);
  });

  it('P. processing OFF → seedBehavioralHistoryFromEntries blocked', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: false });
    const seeded = seedBehavioralHistoryFromEntries(
      [{ ...SAMPLE, savedAt: new Date().toISOString() }],
      'alice'
    );
    expect(seeded).toBe(false);
    expect(readBehavioralHistory('alice')).toHaveLength(0);
  });

  it('Q. processing OFF → Pattern backfill blocked', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: false });
    const result = backfillBehavioralHistoryFromArchives('alice');
    expect(result.seeded).toBe(false);
    expect(result.reason).toBe('processing_disabled');
    expect(readBehavioralHistory('alice')).toHaveLength(0);
  });

  it('R/S. processing OFF does not evolve or delete existing history', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: true });
    appendBehavioralSnapshot(SAMPLE, null, { ownerUserId: 'alice' });
    expect(readBehavioralHistory('alice')).toHaveLength(1);

    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: false });
    appendBehavioralSnapshot(
      { ...SAMPLE, interaction_id: 'asst-2' },
      null,
      { ownerUserId: 'alice' }
    );
    seedBehavioralHistoryFromEntries(
      [{ ...SAMPLE, interaction_id: 'asst-3', savedAt: new Date().toISOString() }],
      'alice'
    );
    const history = readBehavioralHistory('alice');
    expect(history).toHaveLength(1);
    expect(history[0]?.interaction_id).toBe('asst-1');
  });

  it('T/U. switch OFF blocks; switch ON resumes', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: true });
    appendBehavioralSnapshot(SAMPLE, null, { ownerUserId: 'alice' });

    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: false });
    appendBehavioralSnapshot(
      { ...SAMPLE, interaction_id: 'blocked' },
      null,
      { ownerUserId: 'alice' }
    );
    expect(readBehavioralHistory('alice')).toHaveLength(1);

    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: true });
    appendBehavioralSnapshot(
      { ...SAMPLE, interaction_id: 'resumed' },
      null,
      { ownerUserId: 'alice' }
    );
    expect(readBehavioralHistory('alice').map((e) => e.interaction_id)).toContain('resumed');
  });
});

describe('Phase 4.3.1 user isolation', () => {
  it('V/W. Alice history isolated from Bob', () => {
    setEzaUserPreferences('alice', { ezaDataProcessingEnabled: true });
    setEzaUserPreferences('bob', { ezaDataProcessingEnabled: true });
    appendBehavioralSnapshot(
      { ...SAMPLE, interaction_id: 'alice-only' },
      null,
      { ownerUserId: 'alice' }
    );
    appendBehavioralSnapshot(
      { ...SAMPLE, interaction_id: 'bob-only' },
      null,
      { ownerUserId: 'bob' }
    );
    expect(readBehavioralHistory('alice').map((e) => e.interaction_id)).toEqual(['alice-only']);
    expect(readBehavioralHistory('bob').map((e) => e.interaction_id)).toEqual(['bob-only']);
    expect(behavioralHistoryStorageKey('alice')).not.toBe(behavioralHistoryStorageKey('bob'));
  });

  it('X. guest bucket does not become authenticated history', () => {
    setEzaUserPreferences(null, { ezaDataProcessingEnabled: true });
    appendBehavioralSnapshot(
      { ...SAMPLE, interaction_id: 'guest-turn' },
      null,
      { ownerUserId: null }
    );
    expect(readBehavioralHistory(null)).toHaveLength(1);
    expect(readBehavioralHistory('alice')).toHaveLength(0);
  });

  it('Y. unsafe legacy global history is not attributed to authenticated user', () => {
    localStorage.setItem(
      LEGACY_BEHAVIORAL_HISTORY_STORAGE_KEY,
      JSON.stringify([{ ...SAMPLE, interaction_id: 'legacy', savedAt: new Date().toISOString() }])
    );
    expect(readBehavioralHistory('alice')).toHaveLength(0);
    // Guest may adopt legacy once; auth user must not.
    const guest = readBehavioralHistory(null);
    expect(guest.map((e) => e.interaction_id)).toEqual(['legacy']);
    expect(readBehavioralHistory('alice')).toHaveLength(0);
  });
});

describe('Phase 4.3.1 four-state matrix (UI + writes)', () => {
  const states = [
    { vis: true, proc: true },
    { vis: true, proc: false },
    { vis: false, proc: true },
    { vis: false, proc: false },
  ] as const;

  it.each(states)(
    'visibility=$vis processing=$proc',
    ({ vis, proc }) => {
      const prefs = {
        ezaVisibilityEnabled: vis,
        ezaDataProcessingEnabled: proc,
      };
      setEzaUserPreferences('alice', prefs);
      clearBehavioralHistory('alice');

      expect(shouldShowEzaInExperience(prefs)).toBe(vis);
      expect(shouldProcessExperienceForEzaProfile(prefs)).toBe(proc);

      render(
        <ChatBubble
          message="Merhaba"
          isUser={false}
          assistantScore={88}
          behavioral={SAMPLE}
          variant="saina"
          ezaVisibilityEnabled={vis}
        />
      );
      const pill = document.querySelector('.saina-tone-pill');
      if (vis) expect(pill).toBeTruthy();
      else expect(pill).toBeNull();
      expect(screen.getByText('Merhaba')).toBeTruthy();

      appendBehavioralSnapshot(SAMPLE, null, { ownerUserId: 'alice' });
      expect(readBehavioralHistory('alice')).toHaveLength(proc ? 1 : 0);
    }
  );
});
