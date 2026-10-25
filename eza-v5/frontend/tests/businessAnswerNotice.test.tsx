import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BusinessAnswerNotice, { BUSINESS_ANSWER_NOTICE } from '@/components/saina/BusinessAnswerNotice';

describe('Business Yansı answer notice', () => {
  it('shows the fixed disclaimer once, outside any message', () => {
    render(<BusinessAnswerNotice />);
    expect(screen.getByTestId('business-answer-note').textContent).toBe(BUSINESS_ANSWER_NOTICE);
  });

  it('is mounted only for a Business Yansı continuation', () => {
    const chat = readFileSync(resolve(__dirname, '../components/standalone/StandaloneChatInner.tsx'), 'utf8');
    expect(chat).toContain('publicReplayContext?.businessPublisher ? <BusinessAnswerNotice />');
    expect(chat).not.toContain('assistant_answer + BUSINESS_ANSWER_NOTICE');
  });
});
