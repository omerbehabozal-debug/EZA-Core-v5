import MessageList from '@/components/standalone/MessageList';
import { publicReplayMessages, type PublicReplayContext } from '@/lib/eza/mirror-network/publicReplayContinuation';

export default function YansiPersonalReplayHistory({ context }: { context: PublicReplayContext }) {
  return <>
    {context.steps.length ? <section aria-label="Deneyimlenen yayınlanmış sohbet" data-testid="yansi-personal-public-history">
      <MessageList messages={publicReplayMessages(context)} variant="saina" isLoading={false} autoScroll={false} ezaVisibilityEnabled={false} />
    </section> : null}
    <div role="separator" aria-label="Buradan sonrası senin sohbetin" className="yansi-personal-history-divider">Buradan sonrası senin sohbetin</div>
  </>;
}
