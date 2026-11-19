'use client';

import { cn } from '@/lib/utils';
import { ScanEye } from 'lucide-react';

interface NoesisAiMarkProps {
  className?: string;
}

export function NoesisAiMark({ className }: NoesisAiMarkProps) {
  return (
    <ScanEye
      className={cn('inline-block shrink-0 text-[#563795] dark:text-[#d1b9ff]', className)}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}
