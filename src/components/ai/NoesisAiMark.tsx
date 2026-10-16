'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface NoesisAiMarkProps {
  className?: string;
}

export function NoesisAiMark({ className }: NoesisAiMarkProps) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden', className)} aria-hidden="true">
      <Image
        src="/noesis-contextual-assistance.png"
        alt=""
        width={64}
        height={64}
        className="size-full object-contain dark:hidden"
      />
      <Image
        src="/noesis-contextual-assistance-dark.png"
        alt=""
        width={64}
        height={64}
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}
