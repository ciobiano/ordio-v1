import { PROCESSING_STEPS, processingStepState, type ProcessingStepState } from '@/lib/capture/processingSteps';
import { cn } from '@/lib/utils';

function StepIcon({ state }: { state: ProcessingStepState }) {
  if (state === 'done') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="9" cy="9" r="8" className="fill-acid-text-1/10" />
        <path d="M5.5 9.2l2.3 2.3 4.7-5" className="stroke-acid-text-1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 'now') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="9" cy="9" r="7.5" className="stroke-acid-text-1/16" strokeWidth="1.6" />
        <path d="M9 1.5a7.5 7.5 0 0 1 7.5 7.5" className="ord-spin stroke-acid-accent" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="9" cy="9" r="7.5" className="stroke-acid-text-1/16" strokeWidth="1.6" strokeDasharray="2 3" />
    </svg>
  );
}

const STATE_LABEL: Record<ProcessingStepState, string> = {
  done: 'done',
  now: 'in progress',
  todo: 'waiting',
};

/**
 * The four real pipeline stages as a checklist card. States come from
 * `processingStepState`, so the list can never read as finished before the
 * pipeline says it is.
 */
export function ProcessingSteps({ progress, className }: { progress: number; className?: string }) {
  return (
    <ol
      aria-label="Progress"
      className={cn(
        'm-0 flex list-none flex-col rounded-3xl border border-acid-border-subtle bg-acid-bg-subtle px-5 py-2',
        className
      )}
    >
      {PROCESSING_STEPS.map((step, i) => {
        const state = processingStepState(i, progress);
        return (
          <li
            key={step.label}
            className="flex h-13 items-center gap-3 border-b border-acid-text-1/6 last:border-b-0 short:h-11"
          >
            <StepIcon state={state} />
            <span
              className={cn(
                'flex-1 text-[15px]',
                state === 'now' && 'font-medium text-acid-text-1',
                state === 'done' && 'text-acid-text-3',
                state === 'todo' && 'text-acid-text-3'
              )}
            >
              {step.label}
              <span className="sr-only">, {STATE_LABEL[state]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
