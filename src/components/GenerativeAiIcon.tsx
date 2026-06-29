"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface GenerativeAiIconProps {
  className?: string;
}

export function GenerativeAiIcon({ className }: GenerativeAiIconProps) {
  return (
    <span className={cn("relative inline-flex aspect-square shrink-0 items-center justify-center align-middle", className)}>
      <Image
        src="/noesis-generative-ai.png"
        alt="Generative AI"
        fill
        sizes="64px"
        className="object-contain object-center"
      />
    </span>
  );
}
