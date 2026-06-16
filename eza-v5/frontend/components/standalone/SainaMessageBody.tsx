import SainaMarkdown from './SainaMarkdown';

type SainaMessageBodyProps = {
  message: string;
  role: 'user' | 'ai';
};

export default function SainaMessageBody({ message, role }: SainaMessageBodyProps) {
  const proseClass =
    role === 'user'
      ? 'saina-msg-prose saina-msg-prose--user saina-msg-prose--markdown'
      : 'saina-msg-prose saina-msg-prose--markdown';

  return (
    <div className={proseClass} data-testid="saina-msg-prose">
      <SainaMarkdown content={message} />
    </div>
  );
}
