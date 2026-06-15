import { splitSainaMessageIntoBlocks } from '@/lib/eza/sainaMessageBlocks';

type SainaMessageBodyProps = {
  message: string;
  role: 'user' | 'ai';
};

export default function SainaMessageBody({ message, role }: SainaMessageBodyProps) {
  if (role === 'user') {
    return <p className="saina-msg-prose saina-msg-prose--user">{message}</p>;
  }

  const blocks = splitSainaMessageIntoBlocks(message);

  return (
    <div className="saina-msg-prose" data-testid="saina-msg-prose">
      {blocks.map((block, index) =>
        block.type === 'paragraph' ? (
          <p key={`p-${index}`}>{block.text}</p>
        ) : (
          <ul key={`l-${index}`} className="saina-msg-prose-list">
            {block.items.map((item, itemIndex) => (
              <li key={`li-${index}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
