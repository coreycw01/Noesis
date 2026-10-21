'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <nav aria-label={label} className={cn('border-y border-border/60 bg-background/95 py-3 max-sm:sticky max-sm:top-0 max-sm:z-20', className)}>
      <div className="sm:hidden">
        <Select value={activeStep?.id} onValueChange={(value) => onSelect?.(value)} disabled={!onSelect}>
          <SelectTrigger aria-label={label} className="min-h-11 w-full bg-background text-left">
            <SelectValue placeholder="Choose a workbench step" />
          </SelectTrigger>
          <SelectContent>
            {steps.map((step) => <SelectItem key={step.id} value={step.id}>{step.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {activeStep && <p className="mt-2 min-h-[3.75rem] border-t border-border/40 pt-2 text-xs leading-5 text-muted-foreground">{activeStep.description}</p>}
      </div>
      <ol className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-[repeat(var(--workbench-steps),minmax(0,1fr))]" style={{ '--workbench-steps': steps.length } as CSSProperties}>
        {steps.map((step) => {
          const active = step.id === activeId;
          const content = (
            <span className="flex min-h-9 items-center">
              <span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
            </span>
          );

          return (
            <li key={step.id} className={cn('min-w-[7.5rem] shrink-0 snap-start border-l-2 pl-2.5 sm:min-w-0', active ? 'border-accent' : 'border-border')}>
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
      {activeStep && <p className="mt-2 hidden border-t border-border/40 pt-2 text-xs leading-5 text-muted-foreground sm:block">{activeStep.description}</p>}
    </nav>
  );
}
