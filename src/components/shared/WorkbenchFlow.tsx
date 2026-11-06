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
    <nav aria-label={label} className={cn('noesis-thought-spine max-sm:sticky max-sm:top-0 max-sm:z-20', className)}>
      <ol className="relative grid grid-cols-2 gap-1 sm:gap-0 lg:grid-cols-[repeat(var(--workbench-steps),minmax(0,1fr))]" style={{ '--workbench-steps': steps.length } as CSSProperties}>
        {steps.map((step) => {
          const active = step.id === activeStep?.id;
          const content = (
            <span className="flex min-h-11 items-center gap-2 px-2 sm:gap-3 sm:pl-0 sm:pr-4">
              <span className={cn('relative z-10 size-2.5 shrink-0 rounded-full border bg-background', active ? 'border-accent bg-accent' : 'border-border')} aria-hidden="true" />
              <span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
            </span>
          );

          return (
            <li key={step.id} className="relative z-10 min-w-[7.5rem] shrink-0 snap-start sm:min-w-0">
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
      {activeStep && <p className="mt-2 min-h-10 border-l-2 border-accent pl-3 text-xs leading-5 text-muted-foreground">{activeStep.description}</p>}
    </nav>
  );
}
