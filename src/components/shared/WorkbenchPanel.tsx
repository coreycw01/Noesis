'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The one tool tray every workbench step uses (annotation Apply, inquiry
 * Investigate, position Pressure, concept Define, ...). Pages decide what goes
 * inside; the tray, its header, and its spacing are shared so a step looks the
 * same wherever it appears.
 */
export function WorkbenchPanel({
  id,
  eyebrow,
  title,
  description,
  actions,
  collapsible = false,
  defaultOpen = true,
  open,
  onToggle,
  hidden,
  className,
  bodyClassName,
  children,
  'aria-label': ariaLabel,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  hidden?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
  'aria-label'?: string;
}) {
  const hasHeader = Boolean(eyebrow || title || description || actions);
  const heading = hasHeader && (
    <>
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="noesis-workbench-panel__eyebrow">{eyebrow}</div>}
        {title && <h3 className="noesis-workbench-panel__title">{title}</h3>}
        {description && <p className="noesis-workbench-panel__description">{description}</p>}
      </div>
      {actions && <div className="noesis-workbench-panel__actions">{actions}</div>}
    </>
  );

  if (collapsible) {
    return (
      <details
        id={id}
        open={open ?? defaultOpen}
        onToggle={onToggle ? (event) => onToggle((event.currentTarget as HTMLDetailsElement).open) : undefined}
        className={cn('noesis-workbench-panel group', hidden && 'hidden', className)}
        aria-label={ariaLabel}
      >
        <summary className="noesis-workbench-panel__header cursor-pointer list-none">
          {heading}
          <ChevronDown className="noesis-workbench-panel__chevron" aria-hidden="true" />
        </summary>
        <div className={cn('noesis-workbench-panel__body', bodyClassName)}>{children}</div>
      </details>
    );
  }

  return (
    <section id={id} className={cn('noesis-workbench-panel', hidden && 'hidden', className)} aria-label={ariaLabel}>
      {hasHeader && <header className="noesis-workbench-panel__header">{heading}</header>}
      <div className={cn('noesis-workbench-panel__body', !hasHeader && 'mt-0 border-t-0 pt-0', bodyClassName)}>{children}</div>
    </section>
  );
}

/** A set of tools or choices offered inside a workbench step. */
export function ToolOptions({
  children,
  compact = false,
  label,
  className,
}: {
  children: ReactNode;
  compact?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('noesis-tool-options', compact && 'noesis-tool-options--compact', className)}>
      {children}
    </div>
  );
}

/** One selectable tool. Active state, hover, and focus are identical everywhere. */
export function ToolOption({
  label,
  description,
  kicker,
  active = false,
  onClick,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  kicker?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn('noesis-tool-option', className)}
    >
      {kicker && <span className="noesis-tool-option__kicker">{kicker}</span>}
      <span className="noesis-tool-option__label">{label}</span>
      {description && <span className="noesis-tool-option__description">{description}</span>}
    </button>
  );
}
