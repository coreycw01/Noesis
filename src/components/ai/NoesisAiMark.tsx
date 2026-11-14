'use client';

import { cn } from '@/lib/utils';

interface NoesisAiMarkProps {
  className?: string;
}

export function NoesisAiMark({ className }: NoesisAiMarkProps) {
  return (
    <span
      className={cn('inline-block shrink-0 bg-contain bg-center bg-no-repeat bg-[url(/noesis-assistance-light.webp)] dark:bg-[url(/noesis-assistance-dark.webp)]', className)}
      aria-hidden="true"
    />
  );
}
