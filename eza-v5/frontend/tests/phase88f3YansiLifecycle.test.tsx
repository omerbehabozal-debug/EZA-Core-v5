import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MirrorPublishShareActions from '@/components/mirror/MirrorPublishShareActions';
import {
  dismissJourneyWindowInvitation,
  getAwaitingDecisionWindow,
  isPrivateChatMode,
  isSainaYansiInvitationEnabled,
  syncJourneyConversationState,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';
import { buildCuriosityCard } from '@/lib/eza/mirror/curiosityBuilder';
import { MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION } from '@/lib/eza/mirror/semanticAnchors/types';

function pairMessages(n: number): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      id: `u${i}`,
      text: `Soru ${i + 1} neden böyle?`,
      role: 'user',
    });
    out.push({
      id: `a${i}`,
      text: `Cevap ${i + 1} tamamlanmış ve yeterli.`,
      role: 'assistant',
    });
  }
  return out;
}

describe('Phase 8.8F.3 Yansı lifecycle closure', () => {
  it('invitation helper is on without NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1', () => {
    expect(isSainaYansiInvitationEnabled({})).toBe(true);
  });

  it('8 eligible Q/A pairs produce an awaiting-decision window', () => {
    const state = syncJourneyConversationState({
      state: null,
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      messages: pairMessages(8),
    });
    expect(state.eligiblePairCount).toBe(8);
    expect(getAwaitingDecisionWindow(state)?.status).toBe('awaiting_decision');
  });

  it('continue without Yansı keeps the conversation and future eligibility', () => {
    let state = syncJourneyConversationState({
      state: null,
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      messages: pairMessages(8),
    });
    const windowIndex = getAwaitingDecisionWindow(state)!.windowIndex;
    state = dismissJourneyWindowInvitation(state, windowIndex);
    expect(isPrivateChatMode(state)).toBe(false);
    state = syncJourneyConversationState({
      state,
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      messages: pairMessages(16),
    });
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(1);
  });

  it('ready unpublished preview hides Share and shows Yayınla', () => {
    render(
      <MirrorPublishShareActions
        isPublished={false}
        onPublish={() => undefined}
        onShare={() => undefined}
      />
    );
    expect(screen.getByTestId('mirror-publish-btn')).toHaveTextContent('Yayınla');
    expect(screen.queryByTestId('mirror-share-social-btn')).toBeNull();
  });

  it('published preview shows live status and Share', () => {
    render(
      <MirrorPublishShareActions
        isPublished
        onPublish={() => undefined}
        onShare={() => undefined}
        onOpenPublic={() => undefined}
      />
    );
    expect(screen.getByTestId('mirror-publish-live-status')).toHaveTextContent('Yayında');
    expect(screen.getByTestId('mirror-share-social-btn')).toBeInTheDocument();
  });

  it('publish failure is visible and retry remains available', () => {
    render(
      <MirrorPublishShareActions
        isPublished={false}
        publishError="Yayınlanamadı · Tekrar dene"
        onPublish={() => undefined}
        onShare={() => undefined}
      />
    );
    expect(screen.getByTestId('mirror-publish-error')).toHaveTextContent(/Yayınlanamadı/);
    expect(screen.getByTestId('mirror-publish-btn')).not.toBeDisabled();
    expect(screen.queryByTestId('mirror-share-social-btn')).toBeNull();
  });

  it('editorial builder strips Bu ayna openings and mechanical etiketten copy', () => {
    const card = buildCuriosityCard({
      anchors: {
        contractVersion: MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION,
        place: null,
        scene: [],
        emotion: ['yorgun'],
        topic: 'Bu ayna uykunun kalitesi ve süresinin',
        userIntent:
          'Bu ayna uykunun kalitesi ve süresinin insanların dinlenmiş hissetmesi — ilginç tarafı, his ve konforun düzgün bir etiketten daha ağır basması',
        decisionCriteria: ['his', 'konfor'],
        question: null,
        anchorsHash: 'sleep-test',
        evidenceCount: 2,
      },
      interpretation: {
        title: 'Bu ayna uykunun kalitesi ve süresinin',
        interpretationSummary:
          'Bu ayna uykunun kalitesi ve süresinin insanların dinlenmiş hissetmesi — ilginç tarafı, his ve konforun düzgün bir etiketten daha ağır basması',
        imageIntent: 'Quiet bedroom, dim phone glow.',
        atmosphereHint: 'tired',
      },
      locale: 'tr',
    });
    expect(card.publicTitle.toLowerCase()).not.toMatch(/^bu ayna/);
    expect(card.publicSummary.toLowerCase()).not.toMatch(/^bu ayna/);
    expect(card.publicSummary).not.toMatch(/düzgün bir etiket/i);
    expect(card.publicSummary).not.toMatch(/ilginç tarafı/i);
  });
});
