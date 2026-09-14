import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Yansı sidebar row actions', () => {
  it('11. Yansı row does not expose conversation rename/delete menu', () => {
    const yansi: SainaConversationItem = {
      id: 'yansi::conv-1::journey-a::v1',
      kind: 'yansi',
      sourceConversationId: 'conv-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
      yansiSourceIdentity: 'journey-a::v1',
      title: 'İstanbul Semtleri',
      preview: 'özet',
      time: 'şimdi',
      savedAt: new Date().toISOString(),
      thumbGradient: 'g',
      thumbImageUrl: 'https://cdn.example.com/a.jpg',
      yansiStatus: 'ready',
    };
    const conv: SainaConversationItem = {
      id: 'conv-1',
      kind: 'conversation',
      title: 'Kaynak',
      preview: 'p',
      time: 'şimdi',
      savedAt: new Date().toISOString(),
      thumbGradient: 'g',
    };

    render(
      <SainaConversationSidebar
        conversations={[conv, yansi]}
        activeChatId="conv-1"
        activeYansiIdentity="journey-a::v1"
        onSelectChat={() => undefined}
        onSelectYansi={() => undefined}
        onDeleteChat={() => undefined}
      />
    );

    expect(screen.getByTestId(`saina-yansi-row-${yansi.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`saina-conv-menu-${yansi.id}`)).toBeNull();
    expect(screen.getByTestId(`saina-conv-menu-${conv.id}`)).toBeTruthy();
  });
});
