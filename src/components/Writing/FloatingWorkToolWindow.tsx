"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripHorizontal, Maximize2, Minus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import type { WorkToolSection } from '@/lib/types';
import { cn } from '@/lib/utils';

type ToolWindow = NonNullable<WorkToolSection['window']>;

const DEFAULT_WINDOW: ToolWindow = {
  x: 72,
  y: 220,
  width: 600,
  height: 430,
  minimized: false,
  zIndex: 1,
  placement: 'overlay',
};

interface FloatingWorkToolWindowProps {
  section: WorkToolSection;
  label: string;
  mobileActive: boolean;
  onFocus: () => void;
  onPatch: (patch: Partial<ToolWindow>) => void;
  onPlacementChange: (placement: NonNullable<ToolWindow['placement']>) => void;
  onRemove: () => void;
  children: ReactNode;
}

type Interaction = {
  kind: 'move' | 'resize';
  corner?: 'nw' | 'ne' | 'sw' | 'se';
  startX: number;
  startY: number;
  frame: ToolWindow;
};

function normalizedWindow(section: WorkToolSection): ToolWindow {
  const legacyWidth = section.widthPercent ? Math.round(760 * (section.widthPercent / 100)) : DEFAULT_WINDOW.width;
  return {
    ...DEFAULT_WINDOW,
    width: Math.max(320, Math.min(760, legacyWidth)),
    ...section.window,
  };
}

export function FloatingWorkToolWindow({ section, label, mobileActive, onFocus, onPatch, onPlacementChange, onRemove, children }: FloatingWorkToolWindowProps) {
  const [frame, setFrame] = useState(() => normalizedWindow(section));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const interactionRef = useRef<Interaction | null>(null);
  const windowRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (interactionRef.current) return;
    setFrame(normalizedWindow(section));
  }, [section]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      const bounds = windowRef.current?.parentElement?.getBoundingClientRect();
      const availableWidth = Math.max(360, bounds?.width || 850);
      const availableHeight = Math.max(420, bounds?.height || 1030);
      if (interaction.kind === 'move') {
        setFrame((current) => ({
          ...current,
          x: Math.max(0, Math.min(Math.max(0, availableWidth - current.width), interaction.frame.x + dx)),
          y: Math.max(48, Math.min(Math.max(48, availableHeight - current.height), interaction.frame.y + dy)),
        }));
        return;
      }

      const corner = interaction.corner || 'se';
      const fromLeft = corner.endsWith('w');
      const fromTop = corner.startsWith('n');
      const nextWidth = Math.max(320, Math.min(availableWidth, interaction.frame.width + (fromLeft ? -dx : dx)));
      const nextHeight = Math.max(260, Math.min(availableHeight - 48, interaction.frame.height + (fromTop ? -dy : dy)));
      setFrame((current) => ({
        ...current,
        width: nextWidth,
        height: nextHeight,
        x: fromLeft ? Math.max(0, interaction.frame.x + interaction.frame.width - nextWidth) : Math.min(current.x, Math.max(0, availableWidth - nextWidth)),
        y: fromTop ? Math.max(48, interaction.frame.y + interaction.frame.height - nextHeight) : Math.min(current.y, Math.max(48, availableHeight - nextHeight)),
      }));
    };
    const end = () => {
      if (!interactionRef.current) return;
      interactionRef.current = null;
      document.body.style.userSelect = '';
      setFrame((current) => {
        onPatch(current);
        return current;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.body.style.userSelect = '';
    };
  }, [onPatch]);

  const begin = (event: ReactPointerEvent, kind: Interaction['kind'], corner?: Interaction['corner']) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    interactionRef.current = { kind, corner, startX: event.clientX, startY: event.clientY, frame };
    document.body.style.userSelect = 'none';
  };

  const setMinimized = (minimized: boolean) => {
    const next = { ...frame, minimized };
    setFrame(next);
    onPatch({ minimized });
    if (!minimized) onFocus();
  };

  const focusEditor = () => {
    onFocus();
    windowRef.current?.querySelector<HTMLElement>('input, textarea, select, [contenteditable="true"]')?.focus();
  };

  const minimizedControl = frame.minimized ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setMinimized(false)}
        className={cn('z-30 hidden min-h-9 max-w-56 rounded-[var(--button-radius)] border-border/60 bg-background/95 shadow-md md:inline-flex', frame.placement === 'overlay' ? 'absolute left-[var(--work-tool-x)] top-[var(--work-tool-y)]' : 'relative my-2')}
        style={{ '--work-tool-x': `${frame.x}px`, '--work-tool-y': `${frame.y}px`, zIndex: frame.zIndex } as CSSProperties}
        aria-label={`Restore ${label}`}
      >
        <Maximize2 className="mr-2 size-3.5" /> <span className="truncate">{label}</span>
      </Button>
    ) : null;

  return (
    <>
    {minimizedControl}
    <section
      ref={windowRef}
      id={`work-tool-${section.id}`}
      aria-label={`${label} tool window`}
      onPointerDown={(event) => {
        event.stopPropagation();
        onFocus();
      }}
      className={cn(
        'group/tool flex min-h-0 flex-col overflow-hidden bg-background text-foreground max-md:shadow-sm transition-[background-color,border-color,box-shadow] md:bg-transparent md:text-inherit md:shadow-none',
        'fixed inset-x-2 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] top-[calc(4.5rem+env(safe-area-inset-top))] z-40 border border-border/25 md:bottom-auto md:right-auto md:h-[var(--work-tool-height)] md:w-[var(--work-tool-width)] md:rounded-md md:border-transparent md:focus-within:border-accent/45 md:hover:border-current/20',
        frame.placement === 'overlay' && 'md:absolute md:left-[var(--work-tool-x)] md:top-[var(--work-tool-y)]',
        frame.placement === 'wrap' && 'md:relative md:float-right md:inset-auto md:mb-5 md:ml-6 md:mr-[var(--document-page-padding)] md:mt-2 md:max-w-[62%]',
        frame.placement === 'break' && 'md:relative md:inset-auto md:mx-auto md:my-6 md:clear-both md:max-w-[85%]',
        !mobileActive && 'max-md:hidden',
      )}
      style={{
        '--work-tool-x': `${frame.x}px`,
        '--work-tool-y': `${frame.y}px`,
        '--work-tool-width': `${frame.width}px`,
        '--work-tool-height': `${frame.height}px`,
        zIndex: mobileActive ? 40 : frame.zIndex,
        display: frame.minimized ? 'none' : undefined,
      } as CSSProperties}
    >
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b border-border/20 bg-background px-3 md:h-9 md:cursor-move md:border-current/10 md:bg-transparent md:px-2"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button,select')) return;
          if (frame.placement !== 'overlay') return;
          begin(event, 'move');
        }}
      >
        <GripHorizontal className="hidden size-4 shrink-0 text-muted-foreground/60 md:block" />
        <span className="min-w-0 flex-1 truncate font-code text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">{label}</span>
        <select
          value={frame.placement || 'overlay'}
          onChange={(event) => {
            const placement = event.target.value as NonNullable<ToolWindow['placement']>;
            setFrame((current) => ({ ...current, placement }));
            onPlacementChange(placement);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="h-7 max-w-24 rounded-md border border-border/40 bg-background/70 px-1.5 font-code text-[9px] uppercase tracking-wide text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${label} placement`}
          title="Choose how text flows around this tool"
        >
          <option value="overlay">Overlay</option>
          <option value="wrap">Wrap text</option>
          <option value="break">Break text</option>
        </select>
        <Button type="button" variant="ghost" size="icon" onClick={focusEditor} className="size-10 shrink-0 rounded-md md:size-7" aria-label={`Edit ${label}`} title={`Edit ${label}`}>
          <Pencil className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setMinimized(true)} className="size-10 shrink-0 rounded-md md:size-7" aria-label={`Minimize ${label}`}>
          <Minus className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setConfirmRemove(true)} className="size-10 shrink-0 rounded-md text-muted-foreground hover:text-destructive md:size-7" aria-label={`Remove ${label}`} title={`Remove ${label}`}>
          <Trash2 className="size-4" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-x-hidden overflow-y-auto overscroll-contain p-2 md:p-3">{children}</div>
      <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-t border-border/40 px-3 md:hidden">
        <Button type="button" variant="outline" onClick={() => setMinimized(true)} className="min-h-11">Minimize</Button>
        <Button type="button" onClick={() => setMinimized(true)} className="min-h-11">Done</Button>
      </div>
      {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
        <button
          key={corner}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onPointerDown={(event) => begin(event, 'resize', corner)}
          className={cn(
            'absolute hidden size-5 touch-none opacity-0 transition-opacity group-hover/tool:opacity-100 group-focus-within/tool:opacity-100 md:block',
            corner.includes('n') ? '-top-1.5' : '-bottom-1.5',
            corner.includes('w') ? '-left-1.5' : '-right-1.5',
            corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
          )}
        >
          <span className="absolute inset-1 rounded-sm border border-accent/70 bg-background" />
        </button>
      ))}
      <ConfirmActionDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${label}?`}
        description="This removes the tool and its contents from this document. Your writing and other tools stay unchanged."
        confirmLabel="Remove tool"
        destructive
        onConfirm={onRemove}
      />
    </section>
    </>
  );
}
