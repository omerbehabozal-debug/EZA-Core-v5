'use client';

import Markdown, { type Components } from 'react-markdown';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';
import type { EditorialStep } from '@/lib/eza/mirror/yansiEditorial';

export default function YansiEditorialBody({ text, isUser, structure }: { text: string; isUser: boolean; structure?: EditorialStep }) {
  if (isUser) return <div className="yansi-editorial-question" data-testid="yansi-editorial-question"><SainaMessageBody message={text} role="user" /></div>;
  const heading: Components['h1'] = ({ children, node }) => {
    const offset = node?.position?.start.offset;
    const section = structure?.blocks.find((block) => block.type === 'sectionHeading' && offset !== undefined && block.startOffset <= offset && offset < block.endOffset);
    return <h3 className="yansi-editorial-heading">{section ? <span className="yansi-editorial-heading__number" aria-hidden="true">{section.displayNumber}</span> : null}<span>{children}</span></h3>;
  };
  return <div className="saina-msg-prose saina-msg-prose--markdown yansi-editorial-answer" data-testid="yansi-editorial-answer">
    {/* Parse the whole original source, preserving references, nested lists,
        links, code and quotes. Metadata decorates AST headings only. */}
    <Markdown className="saina-markdown" skipHtml components={{ h1: heading, h2: heading, h3: heading, h4: heading, h5: heading, h6: heading,
      ul: ({ children }) => <ul className="saina-msg-prose-list">{children}</ul>,
      ol: ({ children }) => <ol className="saina-msg-prose-list saina-msg-prose-list--ordered">{children}</ol>,
      pre: ({ children }) => <pre className="saina-msg-prose-pre">{children}</pre>,
      code: ({ className, children }) => <code className={className || 'saina-msg-prose-code'}>{children}</code>,
      blockquote: ({ children }) => <blockquote className="saina-msg-prose-quote">{children}</blockquote>,
      a: ({ href, children }) => <a href={href} className="saina-msg-prose-link" target="_blank" rel="noopener noreferrer">{children}</a>,
    }}>{text}</Markdown>
  </div>;
}
