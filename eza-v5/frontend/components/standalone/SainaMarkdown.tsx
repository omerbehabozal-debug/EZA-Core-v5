'use client';

import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';

type SainaMarkdownProps = {
  content: string;
  className?: string;
};

function normalizeMarkdownSource(raw: string): string {
  return raw.replace(/\r\n/g, '\n').trim();
}

const components: Components = {
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => <ul className="saina-msg-prose-list">{children}</ul>,
  ol: ({ children }) => (
    <ol className="saina-msg-prose-list saina-msg-prose-list--ordered">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="saina-msg-prose-strong">{children}</strong>,
  em: ({ children }) => <em className="saina-msg-prose-em">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="saina-msg-prose-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return <code className="saina-msg-prose-code">{children}</code>;
  },
  pre: ({ children }) => <pre className="saina-msg-prose-pre">{children}</pre>,
  h1: ({ children }) => <h3 className="saina-msg-prose-heading">{children}</h3>,
  h2: ({ children }) => <h3 className="saina-msg-prose-heading">{children}</h3>,
  h3: ({ children }) => <h4 className="saina-msg-prose-subheading">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="saina-msg-prose-quote">{children}</blockquote>
  ),
};

export default function SainaMarkdown({ content, className }: SainaMarkdownProps) {
  const source = normalizeMarkdownSource(content);
  if (!source) return null;

  return (
    <Markdown className={className} components={components} skipHtml>
      {source}
    </Markdown>
  );
}
