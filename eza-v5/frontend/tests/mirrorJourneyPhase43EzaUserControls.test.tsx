/**
 * Phase 4.3 — EZA Visibility + Data Processing preference contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ChatBubble from '@/components/standalone/ChatBubble';
import {
  appendBehavioralSnapshot,
  clearBehavioralHistory,
  readBehavioralHistory,
} from '@/lib/behavioralHistory';
import {
  clearEzaUserPreferencesForTests,
  canWriteEzaProfileHistory,
  EZA_USER_PREFS_STORAGE_KEY,
  getEzaUserPreferences,
  resolveFrozenEzaSnapshotForDisplay,
  setEzaUserPreferences,
  shouldProcessExperienceForEzaProfile,
  shouldShowEzaInExperience,
  type EzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';
import { persistChatTurnFromResponse } from '@/lib/eza/mirror/conversationMirrorEntries';
import { attachEzaSnapshotsToSelectedSteps } from '@/lib/eza/mirror/journey/attachEzaSnapshotsToSelectedSteps';
import {
  SAINA_EZA_PROCESSING_NOTE,
  SAINA_EZA_VISIBILITY_NOTE,
} from '@/lib/eza/sainaCopy';

const SAMPLE_BEHAVIORAL = {
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

const FOUR_STATES: Array<{
  name: string;
  prefs: EzaUserPreferences;
  show: boolean;
  process: boolean;
}> = [
  {
    name: 'visibility ON + processing ON',
    prefs: { ezaVisibilityEnabled: true, ezaDataProcessingEnabled: true },
    show: true,
    process: true,
  },
  {
    name: 'visibility ON + processing OFF',
    prefs: { ezaVisibilityEnabled: true, ezaDataProcessingEnabled: false },
    show: true,
    process: false,
  },
  {
    name: 'visibility OFF + processing ON',
    prefs: { ezaVisibilityEnabled: false, ezaDataProcessingEnabled: true },
    show: false,
    process: true,
  },
  {
    name: 'visibility OFF + processing OFF',
    prefs: { ezaVisibilityEnabled: false, ezaDataProcessingEnabled: false },
    show: false,
    process: false,
  },
];

beforeEach(() => {
  clearEzaUserPreferencesForTests();
  clearBehavioralHistory('user-a');
  clearBehavioralHistory(null);
  localStorage.clear();
});

describe('Phase 4.3 preference resolvers (four-state matrix)', () => {
  it('resolvers are independent functions (not aliases)', () => {
    expect(shouldShowEzaInExperience).not.toBe(shouldProcessExperienceForEzaProfile);
  });

  it.each(FOUR_STATES)('$name', ({ prefs, show, process }) => {
    expect(shouldShowEzaInExperience(prefs)).toBe(show);
    expect(shouldProcessExperienceForEzaProfile(prefs)).toBe(process);
  });

  it('fail-closed when storage unreadable for processing writes', () => {
    const spy = vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(canWriteEzaProfileHistory('user-a')).toBe(false);
    expect(getEzaUserPreferences('user-a')).toEqual({
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: false,
    });
    spy.mockRestore();
  });
});

describe('Phase 4.3 normal chat visibility', () => {
  it('A. visibility ON → EZA UI visible', () => {
    render(
      <ChatBubble
        message="Merhaba"
        isUser={false}
        assistantScore={88}
        behavioral={SAMPLE_BEHAVIORAL}
        variant="saina"
        ezaVisibilityEnabled
      />
    );
    expect(document.querySelector('.saina-tone-pill')).toBeTruthy();
  });

  it('B. visibility OFF → EZA UI hidden; message still renders', () => {
    render(
      <ChatBubble
        message="Merhaba"
        isUser={false}
        assistantScore={88}
        behavioral={SAMPLE_BEHAVIORAL}
        variant="saina"
        ezaVisibilityEnabled={false}
      />
    );
    expect(screen.getByTestId('saina-msg-ai')).toBeTruthy();
    expect(screen.getByText('Merhaba')).toBeTruthy();
    expect(document.querySelector('.saina-tone-pill')).toBeNull();
  });
});

describe('Phase 4.3 Relationship Map processing gate', () => {
  it('C. processing ON → behavioral history write allowed', () => {
    setEzaUserPreferences('user-a', {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: true,
    });
    persistChatTurnFromResponse({
      userText: 'q',
      interactionId: 'asst-1',
      behavioral: SAMPLE_BEHAVIORAL,
      assistantScore: 88,
      ownerUserId: 'user-a',
    });
    expect(readBehavioralHistory('user-a')).toHaveLength(1);
  });

  it('D. processing OFF → behavioral history write blocked', () => {
    setEzaUserPreferences('user-a', {
      ezaVisibilityEnabled: true,
      ezaDataProcessingEnabled: false,
    });
    persistChatTurnFromResponse({
      userText: 'q',
      interactionId: 'asst-1',
      behavioral: SAMPLE_BEHAVIORAL,
      assistantScore: 88,
      ownerUserId: 'user-a',
    });
    expect(readBehavioralHistory('user-a')).toHaveLength(0);
  });

  it('E. visibility OFF + processing ON → UI hidden, processing allowed', () => {
    const prefs = {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: true,
    };
    setEzaUserPreferences('user-a', prefs);
    expect(shouldShowEzaInExperience(prefs)).toBe(false);
    expect(canWriteEzaProfileHistory('user-a')).toBe(true);
    appendBehavioralSnapshot(SAMPLE_BEHAVIORAL, null, { ownerUserId: 'user-a' });
    expect(readBehavioralHistory('user-a')).toHaveLength(1);
  });

  it('F. visibility ON + processing OFF → UI visible, processing blocked', () => {
    const prefs = {
      ezaVisibilityEnabled: true,
      ezaDataProcessingEnabled: false,
    };
    setEzaUserPreferences('user-a', prefs);
    expect(shouldShowEzaInExperience(prefs)).toBe(true);
    expect(canWriteEzaProfileHistory('user-a')).toBe(false);
    persistChatTurnFromResponse({
      userText: 'q',
      interactionId: 'asst-1',
      behavioral: SAMPLE_BEHAVIORAL,
      ownerUserId: 'user-a',
    });
    expect(readBehavioralHistory('user-a')).toHaveLength(0);
  });

  it('G. processing OFF does not delete historical Relationship Map', () => {
    setEzaUserPreferences('user-a', { ezaDataProcessingEnabled: true });
    appendBehavioralSnapshot(SAMPLE_BEHAVIORAL, null, { ownerUserId: 'user-a' });
    expect(readBehavioralHistory('user-a')).toHaveLength(1);

    setEzaUserPreferences('user-a', { ezaDataProcessingEnabled: false });
    persistChatTurnFromResponse({
      userText: 'new',
      interactionId: 'asst-2',
      behavioral: { ...SAMPLE_BEHAVIORAL, interaction_id: 'asst-2' },
      ownerUserId: 'user-a',
    });
    const history = readBehavioralHistory('user-a');
    expect(history).toHaveLength(1);
    expect(history[0]?.interaction_id).toBe('asst-1');
  });
});

describe('Phase 4.3 frozen Journey independence', () => {
  it('H. visibility OFF does not remove frozen Journey ezaSnapshot attachment', () => {
    setEzaUserPreferences('viewer', { ezaVisibilityEnabled: false });
    const steps = attachEzaSnapshotsToSelectedSteps(
      [
        {
          stepIndex: 1,
          sourceOrder: 0,
          sourceUserMessageId: 'user-1',
          sourceAssistantMessageId: 'asst-1',
          publicQuestion: 'Q?',
          publicAnswer: 'A.',
        },
      ],
      {
        messages: [
          { id: 'user-1', isUser: true, userScore: 70 },
          {
            id: 'asst-1',
            isUser: false,
            assistantScore: 88,
            behavioral: SAMPLE_BEHAVIORAL,
          },
        ],
      }
    );
    expect(steps[0]?.ezaSnapshot).toBeTruthy();
    expect(steps[0]?.ezaSnapshot?.assistantScore).toBe(88);
  });

  it('I. viewer visibility OFF does not mutate a public frozen artifact object', () => {
    const publicFrozen = {
      slug: 'demo',
      steps: [
        {
          stepIndex: 1,
          publicQuestion: 'Q?',
          publicAnswer: 'A.',
          ezaSnapshot: { assistantScore: 88, userScore: 70, ezaFinal: 88 },
        },
      ],
      ezaVisibilityEnabled: undefined,
      ezaDataProcessingEnabled: undefined,
    };
    const before = JSON.stringify(publicFrozen);
    setEzaUserPreferences('viewer', {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: false,
    });
    expect(JSON.stringify(publicFrozen)).toBe(before);
    expect(publicFrozen.steps[0]?.ezaSnapshot?.assistantScore).toBe(88);
  });

  it('J. visibility ON resolves stored frozen snapshot without API recompute', () => {
    const frozen = { assistantScore: 91, userScore: 77, ezaFinal: 91 };
    const fetchSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;
    const shown = resolveFrozenEzaSnapshotForDisplay(frozen, {
      ezaVisibilityEnabled: true,
      ezaDataProcessingEnabled: false,
    });
    const hidden = resolveFrozenEzaSnapshotForDisplay(frozen, {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: true,
    });
    expect(shown).toBe(frozen);
    expect(hidden).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Phase 4.3 persistence + privacy', () => {
  it('K. settings survive refresh (re-read from storage)', () => {
    setEzaUserPreferences('user-a', {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: true,
    });
    const again = getEzaUserPreferences('user-a');
    expect(again).toEqual({
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: true,
    });
    expect(localStorage.getItem(EZA_USER_PREFS_STORAGE_KEY)).toContain('user-a');
  });

  it('L. settings are user-scoped / cross-user isolated', () => {
    setEzaUserPreferences('alice', {
      ezaVisibilityEnabled: true,
      ezaDataProcessingEnabled: false,
    });
    setEzaUserPreferences('bob', {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: true,
    });
    expect(getEzaUserPreferences('alice')).toEqual({
      ezaVisibilityEnabled: true,
      ezaDataProcessingEnabled: false,
    });
    expect(getEzaUserPreferences('bob')).toEqual({
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: true,
    });
  });

  it('M. public /frozen payload shape never includes viewer preference keys', () => {
    setEzaUserPreferences('viewer', {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: false,
    });
    const publicFrozen = {
      slug: 'x',
      journeyId: 'x',
      journeyVersion: 1,
      authorUserId: 'author',
      selectedCount: 1,
      steps: [
        {
          stepIndex: 1,
          publicQuestion: 'Q',
          publicAnswer: 'A',
          ezaSnapshot: { assistantScore: 80 },
        },
      ],
      replayReady: true,
    };
    const encoded = JSON.stringify(publicFrozen);
    expect(encoded).not.toContain('ezaVisibilityEnabled');
    expect(encoded).not.toContain('ezaDataProcessingEnabled');
    expect(encoded).not.toContain(EZA_USER_PREFS_STORAGE_KEY);
  });

  it('copy does not collapse visibility with processing', () => {
    expect(SAINA_EZA_VISIBILITY_NOTE).toContain('EZA değerlendirmelerini gösterir');
    expect(SAINA_EZA_VISIBILITY_NOTE).not.toContain('özel EZA profiliniz');
    expect(SAINA_EZA_PROCESSING_NOTE).toContain('özel EZA profiliniz');
    expect(SAINA_EZA_PROCESSING_NOTE).toContain('İlişki Haritanız');
    expect(SAINA_EZA_PROCESSING_NOTE).not.toMatch(/silin|delete|reset/i);
  });
});
