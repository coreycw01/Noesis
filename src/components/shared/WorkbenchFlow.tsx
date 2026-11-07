'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export type WorkbenchStep = {
  id: string;
  label: string;
  description: string;
};

export function WorkbenchFlow({
  label,
  steps,
  activeId,
  onSelect,
  className,
}: {
  label: string;
  steps: WorkbenchStep[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const activeStep = steps.find((step) => step.id === activeId) || steps[0];

  return (
    <nav aria-label={label} className={cn('noesis-thought-spine max-sm:sticky max-sm:top-0 max-sm:z-20 [@media(max-height:600px)]:py-1', className)}>
      <ol className="relative grid grid-cols-2 gap-1 sm:gap-0 lg:grid-cols-[repeat(var(--workbench-steps),minmax(0,1fr))] [@media(max-height:600px)]:flex [@media(max-height:600px)]:overflow-x-auto scrollbar-hide" style={{ '--workbench-steps': steps.length } as CSSProperties}>
        {steps.map((step) => {
          const active = step.id === activeStep?.id;
          const content = (
            <span className="flex min-h-11 items-center gap-2 px-2 sm:gap-3 sm:pl-0 sm:pr-4">
              <span className={cn('relative z-10 size-2.5 shrink-0 rounded-full border bg-background', active ? 'border-accent bg-accent' : 'border-border')} aria-hidden="true" />
              <span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
            </span>
          );

          return (
            <li key={step.id} className="relative z-10 min-w-[7.5rem] shrink-0 snap-start sm:min-w-0 [@media(max-height:600px)]:min-w-[7.5rem]">
              {onSelect ? (
                <button type="button" onClick={() => onSelect(step.id)} aria-current={active ? 'step' : undefined} className={cn('w-full rounded-[var(--button-radius)] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'bg-accent/10 sm:bg-transparent' : 'hover:bg-muted/50')}>
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
        {steps.map((step) => <p key={step.id} aria-hidden={step.id !== activeStep.id} className={cn('col-start-1 row-start-1 self-start text-xs leading-5 text-muted-foreground', step.id !== activeStep.id && 'invisible')}>{step.description}</p>)}
      </div>}
    </nav>
  );
}
