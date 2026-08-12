/**
 * Phase 4.2 — attach interaction EZA snapshots to selected Journey steps.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/behavioralHistory', () => ({
  readBehavioralHistory: vi.fn(() => []),
}));

vi.mock('@/lib/standaloneChatArchive', () => ({
  getChatArchive: vi.fn(() => null),
}));

import { readBehavioralHistory } from '@/lib/behavioralHistory';
import { attachEzaSnapshotsToSelectedSteps } from '@/lib/eza/mirror/journey/attachEzaSnapshotsToSelectedSteps';

describe('attachEzaSnapshotsToSelectedSteps', () => {
  beforeEach(() => {
    vi.mocked(readBehavioralHistory).mockReturnValue([]);
  });

  it('binds EZA from matching assistant message and leaves missing absent', () => {
    const steps = attachEzaSnapshotsToSelectedSteps(
      [
        {
          stepIndex: 1,
          sourceOrder: 0,
          sourceUserMessageId: 'user-1',
          sourceAssistantMessageId: 'eza-1',
          publicQuestion: 'Q1?',
          publicAnswer: 'A1.',
        },
        {
          stepIndex: 2,
          sourceOrder: 1,
          sourceUserMessageId: 'user-2',
          sourceAssistantMessageId: 'eza-2',
          publicQuestion: 'Q2?',
          publicAnswer: 'A2.',
        },
      ],
      {
        messages: [
          {
            id: 'user-1',
            isUser: true,
            userScore: 80,
          },
          {
            id: 'eza-1',
            isUser: false,
            assistantScore: 95,
            behavioral: {
              schema_version: 1,
              interaction_id: 'eza-1',
              mode: 'standalone',
              vector: {
                input_risk: 0.1,
                output_risk: 0.1,
                input_health: 0.8,
                output_health: 0.9,
                alignment_score: 0.7,
                eza_final: 95,
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
            },
          },
        ],
      }
    );
    expect(steps[0].ezaSnapshot?.assistantScore).toBe(95);
    expect(steps[0].ezaSnapshot?.userScore).toBe(80);
    expect(steps[0].ezaSnapshot?.behavioral?.interaction_id).toBe('eza-1');
    expect(steps[0].ezaSnapshot?.sourceAssistantMessageId).toBe('eza-1');
    expect(steps[0].ezaSnapshot?.sourceUserMessageId).toBe('user-1');
    expect(steps[1].ezaSnapshot).toBeUndefined();
  });

  it('does not attach another step EZA to the wrong assistant id', () => {
    vi.mocked(readBehavioralHistory).mockReturnValue([
      {
        schema_version: 1,
        interaction_id: 'eza-other',
        mode: 'standalone',
        savedAt: new Date().toISOString(),
        vector: {
          input_risk: 0.1,
          output_risk: 0.1,
          input_health: 0.8,
          output_health: 0.9,
          alignment_score: 0.7,
          eza_final: 11,
          intent: 'x',
          alignment_verdict: null,
          redirect: false,
          redirect_reason: null,
          policy_violation_count: 0,
        },
        asymmetry: {
          health_gap: 0,
          risk_delta_output_minus_input: 0,
          index: 0,
        },
      },
    ]);
    const steps = attachEzaSnapshotsToSelectedSteps(
      [
        {
          stepIndex: 1,
          sourceOrder: 0,
          sourceUserMessageId: 'user-1',
          sourceAssistantMessageId: 'eza-target',
          publicQuestion: 'Q?',
          publicAnswer: 'A.',
        },
      ],
      { messages: [] }
    );
    expect(steps[0].ezaSnapshot).toBeUndefined();
  });
});
