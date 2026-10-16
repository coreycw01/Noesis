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
    <nav aria-label={label} className={cn('border-y border-border/60 py-3', className)}>
      <ol className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[repeat(var(--workbench-steps),minmax(0,1fr))]" style={{ '--workbench-steps': steps.length } as CSSProperties}>
        {steps.map((step, index) => {
          const active = step.id === activeId;
          const content = (
            <span className="flex min-h-9 items-center gap-2">
              <span className={cn('font-code text-[9px] font-bold tabular-nums', active ? 'text-accent' : 'text-muted-foreground')}>{index + 1}</span>
              <span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
            </span>
          );

          return (
            <li key={step.id} className={cn('min-w-0 border-l-2 pl-2.5', active ? 'border-accent' : 'border-border')}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(step.id)} aria-current={active ? 'step' : undefined} className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {content}
                </button>
              ) : (
                <div aria-current={active ? 'step' : undefined}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {activeStep && <p className="mt-2 border-t border-border/40 pt-2 text-xs leading-5 text-muted-foreground">{activeStep.description}</p>}
    </nav>
  );
}
