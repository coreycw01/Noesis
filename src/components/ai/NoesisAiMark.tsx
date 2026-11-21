'use client';

import { cn } from '@/lib/utils';

interface NoesisAiMarkProps {
  className?: string;
}

/**
 * The mark on every "Ask Noesis" control: an eye over an open book.
 *
 * It replaces lucide's ScanEye, a stock scanner icon that shipped unchanged in
 * every other product importing the set. This one says what the feature
 * actually does — it reads what you have written — and it is drawn on lucide's
 * own 24 × 24 grid at the same stroke weight, so it sits beside the other
 * icons in a toolbar without looking imported.
 *
 * Single colour, in currentColor, so the button keeps taking --brand-mark and
 * follows the theme on its own. It holds its shape down to 16px, which is
 * where ContextualAiPanel renders it.
 */
export function NoesisAiMark({ className }: NoesisAiMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0 text-brand-mark dark:text-[hsl(var(--brand-mark-dark))]', className)}
      aria-hidden="true"
    >
      {/* the eye, attending */}
      <path d="M3 7.4s3.4-4.3 9-4.3 9 4.3 9 4.3-3.4 4.3-9 4.3-9-4.3-9-4.3Z" />
      <circle cx="12" cy="7.4" r="1.8" />
      {/* the open book it is reading */}
      <path d="M12 15.6c-1.5-1.1-3.5-1.7-6-1.7H3.2v6.5H6c2.5 0 4.5.6 6 1.7" />
      <path d="M12 15.6c1.5-1.1 3.5-1.7 6-1.7h2.8v6.5H18c-2.5 0-4.5.6-6 1.7" />
      <path d="M12 15.6v6.5" />
    </svg>
  );
}
