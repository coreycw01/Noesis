'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function useSectionDisclosure(label: string, toggleClassName?: string, defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const toggle = (
    <IconButton type="button" variant="ghost" label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      className={cn('relative z-10 size-11 shrink-0 text-muted-foreground', toggleClassName)}
      aria-expanded={open} aria-controls={id} onClick={(event) => { event.stopPropagation(); setOpen(!open); }}>
      <ChevronDown aria-hidden="true" className={cn('size-4', !open && '-rotate-90')} />
    </IconButton>
  );
  return { open, toggle, body: { id, hidden: !open } };
}
