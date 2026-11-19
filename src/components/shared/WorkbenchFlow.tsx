'use client';

import React, { useId, useRef, type CSSProperties } from 'react';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { workbenchFocusIndex } from '@/lib/workbench-keyboard';

export type WorkbenchStep = {
  id: string;
  label: string;
  description: string;
  /** Optional 0 to 1 completion; when given, the step shows a progress ring. */
  progress?: number;
  /** Optional one-line status under the label, such as "3 notes · 1 developed". */
  meta?: string;
};

export function WorkbenchFlow({
  label,
  steps,
  activeId,
  onSelect,
  className,
  nextId,
  nextHint,
}: {
  label: string;
  steps: WorkbenchStep[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  /** The step the reader should take next; marked and explained in place. */
  nextId?: string | null;
  nextHint?: string;
}) {
  const activeStep = steps.find((step) => step.id === activeId) || steps[0];
  const descriptionId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  return (
    <nav aria-label={label} className={cn('noesis-thought-spine max-sm:sticky max-sm:top-0 max-sm:z-20 [@media(max-height:600px)]:py-1', className)}>
      <div className="mb-1.5 inline-flex items-center gap-2 px-2 text-sm font-semibold text-foreground sm:px-0">
        <Wrench className="size-4 shrink-0 text-accent" aria-hidden="true" />
        <span>Workbench</span>
      </div>
      <ol className="relative grid grid-cols-2 gap-1 sm:gap-0 lg:grid-cols-[repeat(var(--workbench-steps),minmax(0,1fr))] [@media(max-height:600px)]:flex [@media(max-height:600px)]:overflow-x-auto scrollbar-hide" style={{ '--workbench-steps': steps.length } as CSSProperties}>
        {steps.map((step, index) => {
          const active = step.id === activeStep?.id;
          const isNext = step.id === nextId;
          const content = (
            <span className="flex min-h-11 items-center gap-2.5 px-2 py-1 sm:pl-0 sm:pr-4">

              <span className="grid min-w-0">
                <span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
                {step.meta && <span className="truncate font-code text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{step.meta}</span>}
                {isNext && <span className="noesis-step-next mt-0.5 text-[11px] leading-4">Next{nextHint ? ` · ${nextHint}` : ''}</span>}
              </span>
            </span>
          );

          return (
            <li key={step.id} className="relative z-10 min-w-[7.5rem] shrink-0 snap-start sm:min-w-0 [@media(max-height:600px)]:min-w-[7.5rem]">
              {onSelect ? (
                <button
                  ref={(button) => { if (button) buttons.current.set(step.id, button); else buttons.current.delete(step.id); }}
                  type="button"
                  onClick={() => onSelect(step.id)}
                  onKeyDown={(event) => {
                    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                    const next = workbenchFocusIndex(event.key, index, steps.length, getComputedStyle(event.currentTarget).direction === 'rtl');
                    if (next === null) return;
                    event.preventDefault();
                    buttons.current.get(steps[next].id)?.focus();
                  }}
                  aria-current={active ? 'step' : undefined}
                  aria-describedby={`${descriptionId}-${index}`}
                  className={cn('w-full rounded-[var(--button-radius)] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', active ? 'bg-accent/10 sm:bg-transparent' : 'hover:bg-muted/50')}
                >
                  {content}
                </button>
              ) : (
                <div aria-current={active ? 'step' : undefined}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {activeStep && <div className="mt-2 grid min-h-10 border-l-2 border-accent pl-3 [@media(max-height:600px)]:mt-1 [@media(max-height:600px)]:min-h-0">
        {steps.map((step, index) => <p key={step.id} id={`${descriptionId}-${index}`} aria-hidden={step.id !== activeStep.id} className={cn('col-start-1 row-start-1 self-start text-xs leading-5 text-muted-foreground', step.id !== activeStep.id && 'invisible')}>{step.description}</p>)}
      </div>}
    </nav>
  );
}
