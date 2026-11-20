import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * For a section with nothing in it yet. One sentence of what belongs here and,
 * when there is one, the action that starts it. Page-level empties use
 * PageEmptyState; this is for a part of a page.
 */
export function SectionEmpty({ title, hint, action, className }: { title: string; hint?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('noesis-section-empty', className)}>
      <b>{title}</b>
      {hint && <span>{hint}</span>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
