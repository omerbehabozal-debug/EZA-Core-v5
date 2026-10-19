'use client';

export type StudioRailStepId = 'sources' | 'topics' | 'chat' | 'preview';

export type StudioRailStep = {
  id: StudioRailStepId;
  label: string;
  state: 'active' | 'complete' | 'locked' | 'upcoming';
};

type Props = {
  steps: StudioRailStep[];
  onSelect: (id: StudioRailStepId) => void;
};

export default function StudioStepRail({ steps, onSelect }: Props) {
  return (
    <ol className="biz-studio-steps-rail" aria-label="Stüdyo adımları" data-testid="biz-studio-step-rail">
      {steps.map((step, index) => {
        const clickable = step.state === 'complete' || step.state === 'active' || step.state === 'upcoming';
        return (
          <li key={step.id} data-state={step.state} data-testid={`biz-studio-rail-${step.id}`}>
            <button
              type="button"
              className="biz-studio-rail-btn"
              disabled={!clickable || step.state === 'locked'}
              aria-current={step.state === 'active' ? 'step' : undefined}
              onClick={() => {
                if (step.state !== 'locked') onSelect(step.id);
              }}
            >
              <span className="biz-studio-rail-index" aria-hidden>
                {step.state === 'complete' ? '✓' : index + 1}
              </span>
              <span className="biz-studio-rail-label">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
