import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-[var(--card-radius)] border-[length:var(--border-strength)] border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 md:text-sm',
          "rounded-[var(--card-radius)] border-border bg-surface font-body transition-[border-color,box-shadow] duration-150 hover:border-accent-border/70 focus-visible:border-accent-border focus-visible:ring-accent/25 focus-visible:ring-offset-0 focus-visible:ring-[3px]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
