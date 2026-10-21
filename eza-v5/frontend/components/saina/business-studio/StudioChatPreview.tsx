'use client';

import { useState } from 'react';
import ChatBubble from '@/components/standalone/ChatBubble';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import type { StudioEvidence } from '@/lib/eza/businessStudio';

export type StudioBrand = {
  name: string;
  logoUrl?: string | null;
  cacheBust?: string | number | null;
  verified?: boolean;
  official?: boolean;
};

export type StudioPreviewTurn = {
  question: string;
  answer: string;
  evidence?: StudioEvidence | null;
  sourceLabel?: string;
};

type Props = {
  title: string;
  summary: string;
  turns: StudioPreviewTurn[];
  editingStep: number | null;
  onSelectStep: (index: number) => void;
  onTitleChange?: (value: string) => void;
  onSummaryChange?: (value: string) => void;
  titleEditable?: boolean;
  disabled?: boolean;
  brand?: StudioBrand | null;
};

function EvidencePanel({
  evidence,
  sourceTitle,
}: {
  evidence: StudioEvidence;
  sourceTitle?: string;
}) {
  return (
    <details className="biz-studio-evidence" open>
      <summary>Kaynak pasajı</summary>
      <p className="biz-studio-evidence-meta">
        {sourceTitle || 'Bilgi kaydı'} · v{evidence.version}
      </p>
      <blockquote className="biz-studio-passage">{evidence.text}</blockquote>
    </details>
  );
}

export default function StudioChatPreview({
  title,
  summary,
  turns,
  editingStep,
  onSelectStep,
  onTitleChange,
  onSummaryChange,
  titleEditable = false,
  disabled = false,
  brand = null,
}: Props) {
  const [openEvidence, setOpenEvidence] = useState<number | null>(null);

  return (
    <section className="biz-studio-chat" data-testid="biz-studio-chat-preview" aria-label="Yansı sohbet önizlemesi">
      {brand ? (
        <div className="biz-studio-publisher" data-testid="biz-studio-publisher">
          <ProfileUserAvatar displayName={brand.name} avatarUrl={brand.logoUrl} cacheBust={brand.cacheBust ?? undefined} size="sm" alt="" />
          <span className="biz-studio-publisher-name">{brand.name}</span>
          {brand.official ? (
            <span className="biz-chip biz-chip--gold">Resmî Business</span>
          ) : brand.verified ? (
            <span className="biz-chip biz-chip--gold">Doğrulanmış Business</span>
          ) : null}
        </div>
      ) : null}
      <header className="biz-studio-chat-head">
        {titleEditable && onTitleChange ? (
          <div className="biz-studio-meta-edit">
            <label>
              Başlık
              <input
                aria-label="Yansı başlığı"
                value={title}
                disabled={disabled}
                onChange={(e) => onTitleChange(e.target.value)}
                data-testid="biz-studio-preview-title-input"
              />
            </label>
            <label>
              Özet
              <textarea
                aria-label="Yansı özeti"
                value={summary}
                disabled={disabled}
                rows={2}
                onChange={(e) => onSummaryChange?.(e.target.value)}
                data-testid="biz-studio-preview-summary-input"
              />
            </label>
          </div>
        ) : (
          <>
            <h3>{title}</h3>
            <p>{summary}</p>
          </>
        )}
      </header>

      <div className="biz-studio-chat-thread">
        {turns.map((turn, index) => {
          const selected = editingStep === index;
          return (
            <div
              className={`biz-studio-turn${selected ? ' is-editing' : ''}`}
              key={`${index}-${turn.question.slice(0, 24)}`}
              data-testid={`biz-studio-turn-${index}`}
            >
              <div className="biz-studio-turn-toolbar">
                <span className="biz-studio-turn-index">Adım {index + 1}</span>
                <button
                  type="button"
                  className="biz-studio-turn-edit"
                  disabled={disabled}
                  data-testid={`biz-studio-edit-step-${index}`}
                  onClick={() => onSelectStep(index)}
                >
                  {selected ? 'Düzenleniyor' : 'Bu adımı düzenle'}
                </button>
              </div>
              <ChatBubble
                variant="saina"
                isUser
                message={turn.question}
                userInitial="B"
                isFirstAssistantMessage={false}
                ezaVisibilityEnabled={false}
              />
              <ChatBubble
                variant="saina"
                isUser={false}
                message={turn.answer}
                isFirstAssistantMessage={index === 0}
                ezaVisibilityEnabled={false}
                renderedBody={
                  <div className="biz-studio-answer-body">
                    <p className="biz-studio-answer-text">{turn.answer}</p>
                    {turn.evidence ? (
                      <>
                        <button
                          type="button"
                          className="biz-studio-evidence-toggle"
                          data-testid={`biz-studio-evidence-toggle-${index}`}
                          onClick={() => setOpenEvidence((cur) => (cur === index ? null : index))}
                        >
                          {openEvidence === index ? 'Kaynağı gizle' : 'Kaynağı incele'}
                        </button>
                        {openEvidence === index ? (
                          <EvidencePanel evidence={turn.evidence} sourceTitle={turn.sourceLabel} />
                        ) : null}
                      </>
                    ) : turn.sourceLabel ? (
                      <p className="biz-studio-evidence-meta">Kaynak: {turn.sourceLabel}</p>
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
