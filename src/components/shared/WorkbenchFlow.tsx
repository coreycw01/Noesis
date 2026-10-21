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
    <nav aria-label={label} className={cn('noesis-thought-spine max-sm:sticky max-sm:top-0 max-sm:z-20', className)}>
      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <span>{label}</span>
          <span>{Math.max(steps.findIndex((step) => step.id === activeStep?.id) + 1, 1)} / {steps.length}</span>
        </div>
        <Select value={activeStep?.id} onValueChange={(value) => onSelect?.(value)} disabled={!onSelect}>
          <SelectTrigger aria-label={label} className="min-h-11 w-full rounded-md border-border bg-background text-left shadow-none">
            <SelectValue placeholder="Choose a workbench step" />
          </SelectTrigger>
          <SelectContent>
            {steps.map((step) => <SelectItem key={step.id} value={step.id}>{step.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {activeStep && <p className="mt-2 border-l-2 border-accent pl-3 text-xs leading-5 text-muted-foreground">{activeStep.description}</p>}
      </div>
      <ol className="relative hidden sm:grid sm:grid-cols-2 lg:grid-cols-[repeat(var(--workbench-steps),minmax(0,1fr))]" style={{ '--workbench-steps': steps.length } as CSSProperties}>
        {steps.map((step) => {
          const active = step.id === activeId;
          const content = (
            <span className="flex min-h-10 items-center gap-3 pr-4">
              <span className={cn('relative z-10 size-2.5 shrink-0 rounded-full border bg-background', active ? 'border-accent bg-accent' : 'border-border')} aria-hidden="true" />
              <span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
            </span>
          );

          return (
            <li key={step.id} className="relative z-10 min-w-[7.5rem] shrink-0 snap-start sm:min-w-0">
              {onSelect ? (
                <button type="button" onClick={() => onSelect(step.id)} aria-current={active ? 'step' : undefined} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {content}
                </button>
              ) : (
                <div aria-current={active ? 'step' : undefined}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {activeStep && <p className="mt-2 hidden border-l-2 border-accent pl-3 text-xs leading-5 text-muted-foreground sm:block">{activeStep.description}</p>}
    </nav>
  );
}
