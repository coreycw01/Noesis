'use client';

import { cn } from '@/lib/utils';
import { ScanEye } from 'lucide-react';

interface NoesisAiMarkProps {
  className?: string;
}

export function NoesisAiMark({ className }: NoesisAiMarkProps) {
  return (
    <ScanEye
      className={cn('inline-block shrink-0 text-brand-mark dark:text-[hsl(var(--brand-mark-dark))]', className)}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}
