'use client';

import { useState } from 'react';
import ChatBubble from '@/components/standalone/ChatBubble';
import type { StudioDraftStep, StudioEvidence } from '@/lib/eza/businessStudio';

type Props = {
  title: string;
  summary: string;
  steps: StudioDraftStep[];
  sourceTitles?: Record<string, string>;
};

function EvidencePanel({
  evidence,
  sourceTitle,
}: {
  evidence: StudioEvidence;
  sourceTitle?: string;
}) {
  return (
    <details className="biz-studio-evidence">
      <summary>Kaynak ve pasaj</summary>
      <p className="biz-studio-evidence-meta">
        {sourceTitle || 'Bilgi kaydı'} · v{evidence.version}
      </p>
      <blockquote className="biz-studio-passage">{evidence.text}</blockquote>
    </details>
  );
}

export default function StudioChatPreview({ title, summary, steps, sourceTitles }: Props) {
  const [openEvidence, setOpenEvidence] = useState<number | null>(0);

  return (
    <section className="biz-studio-chat" data-testid="biz-studio-chat-preview" aria-label="Yansı sohbet önizlemesi">
      <header className="biz-studio-chat-head">
        <h3>{title}</h3>
        <p>{summary}</p>
      </header>
      <div className="biz-studio-chat-thread">
        {steps.map((step, index) => {
          const sourceTitle = sourceTitles?.[step.evidence.versionId];
          return (
            <div className="biz-studio-turn" key={`${index}-${step.evidence.passageHash}`}>
              <ChatBubble
                variant="saina"
                isUser
                message={step.question}
                userInitial="B"
                isFirstAssistantMessage={false}
                ezaVisibilityEnabled={false}
              />
              <ChatBubble
                variant="saina"
                isUser={false}
                message={step.answer}
                isFirstAssistantMessage={index === 0}
                ezaVisibilityEnabled={false}
                renderedBody={
                  <div className="biz-studio-answer-body">
                    <p className="biz-studio-answer-text">{step.answer}</p>
                    <button
                      type="button"
                      className="biz-studio-evidence-toggle"
                      data-testid={`biz-studio-evidence-toggle-${index}`}
                      onClick={() => setOpenEvidence((cur) => (cur === index ? null : index))}
                    >
                      {openEvidence === index ? 'Kaynağı gizle' : 'Kaynağı göster'}
                    </button>
                    {openEvidence === index ? (
                      <EvidencePanel evidence={step.evidence} sourceTitle={sourceTitle} />
                    ) : null}
                  </div>
                }
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
