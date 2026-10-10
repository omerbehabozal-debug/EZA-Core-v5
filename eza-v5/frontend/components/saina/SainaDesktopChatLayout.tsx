import type { ReactNode, RefObject } from 'react';

/** Shared desktop geometry; controllers and message ownership stay with callers. */
export default function SainaDesktopChatLayout({ header, messages, composer, action, scrollRef, replay = false }: {
  header: ReactNode; messages: ReactNode; composer: ReactNode; action?: ReactNode;
  scrollRef?: RefObject<HTMLDivElement>; replay?: boolean;
}) {
  return <>
    <header className="saina-desktop-chat-header" data-yansi-title-position={replay ? 'elevated' : undefined} data-testid={replay ? 'yansi-title-block' : 'saina-desktop-chat-header'}>
      {header}
    </header>
    <div className="saina-chat-column" data-testid="saina-chat-column">
      <div className="saina-chat-scroll-region">
        <div className="saina-chat-float">
          <div className="saina-chat-card saina-chat-card--growth" data-testid="saina-chat-card">
            <div ref={scrollRef} className="saina-standalone-messages-scroll" tabIndex={0}
              aria-label="Sohbet mesajları" data-testid={replay ? 'mirror-frozen-replay-thread' : 'saina-chat-messages-scroll'}>
              {messages}
            </div>
          </div>
        </div>
      </div>
      {action ? <div className="saina-desktop-replay-action">{action}</div> : null}
      <div className="saina-chat-bottom-anchor" data-testid={replay ? 'yansi-chat-composer-lane' : 'saina-chat-bottom-anchor'}>
        <div className="saina-composer-zone saina-standalone-composer">{composer}</div>
      </div>
    </div>
  </>;
}
