import { describe, it, expect } from 'vitest';
import { feedbackContextFromGovernance, parseGovernance } from '@/lib/standaloneFeedback';

describe('standaloneFeedback', () => {
  it('parseGovernance returns null for missing payload', () => {
    expect(parseGovernance(null)).toBeNull();
  });

  it('parseGovernance extracts event_id when logging enabled', () => {
    const g = parseGovernance({
      event_id: 'abc-123',
      event_logging_enabled: true,
    });
    expect(g?.event_id).toBe('abc-123');
    expect(g?.event_logging_enabled).toBe(true);
  });

  it('feedbackContextFromGovernance returns null without event_id', () => {
    expect(
      feedbackContextFromGovernance({ event_logging_enabled: false, event_id: null })
    ).toBeNull();
  });

  it('feedbackContextFromGovernance builds context with scores', () => {
    const ctx = feedbackContextFromGovernance(
      { event_id: 'evt-1', event_logging_enabled: true },
      { assistantScore: 72, safety: 'Safe' }
    );
    expect(ctx?.eventId).toBe('evt-1');
    expect(ctx?.originalScore).toBe(72);
    expect(ctx?.originalLabel).toBe('Safe');
  });
});
