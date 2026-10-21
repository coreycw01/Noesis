"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripHorizontal, Maximize2, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
};

interface FloatingWorkToolWindowProps {
  section: WorkToolSection;
  label: string;
  mobileActive: boolean;
  onFocus: () => void;
  onPatch: (patch: Partial<ToolWindow>) => void;
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

export function FloatingWorkToolWindow({ section, label, mobileActive, onFocus, onPatch, onRemove, children }: FloatingWorkToolWindowProps) {
  const [frame, setFrame] = useState(() => normalizedWindow(section));
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

  if (frame.minimized) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setMinimized(false)}
        className="absolute z-30 hidden h-9 max-w-56 rounded-md border-border/60 bg-background/95 shadow-md md:inline-flex"
        style={{ left: frame.x, top: frame.y, zIndex: frame.zIndex }}
        aria-label={`Restore ${label}`}
      >
        <Maximize2 className="mr-2 size-3.5" /> <span className="truncate">{label}</span>
      </Button>
    );
  }

  return (
    <section
      ref={windowRef}
      id={`work-tool-${section.id}`}
      aria-label={`${label} tool window`}
      onPointerDown={(event) => {
        event.stopPropagation();
        onFocus();
      }}
      className={cn(
        'group/tool flex min-h-0 flex-col overflow-hidden bg-background/95 shadow-xl backdrop-blur-sm',
        'fixed inset-x-2 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] top-[calc(4.5rem+env(safe-area-inset-top))] z-40 border border-border md:absolute md:bottom-auto md:left-[var(--work-tool-x)] md:right-auto md:top-[var(--work-tool-y)] md:h-[var(--work-tool-height)] md:w-[var(--work-tool-width)] md:rounded-md md:border-border/35 md:focus-within:border-accent/55 md:hover:border-border/70',
        !mobileActive && 'max-md:hidden',
      )}
      style={{
        '--work-tool-x': `${frame.x}px`,
        '--work-tool-y': `${frame.y}px`,
        '--work-tool-width': `${frame.width}px`,
        '--work-tool-height': `${frame.height}px`,
        zIndex: mobileActive ? 40 : frame.zIndex,
      } as CSSProperties}
    >
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-3 md:h-9 md:cursor-move md:px-2"
        onPointerDown={(event) => begin(event, 'move')}
      >
        <GripHorizontal className="hidden size-4 shrink-0 text-muted-foreground/60 md:block" />
        <span className="min-w-0 flex-1 truncate font-code text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/75">{label}</span>
        <Button type="button" variant="ghost" size="icon" onClick={() => setMinimized(true)} className="size-10 shrink-0 rounded-md md:size-7" aria-label={`Minimize ${label}`}>
          <Minus className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="size-10 shrink-0 rounded-md text-muted-foreground hover:text-destructive md:size-7" aria-label={`Close ${label}`}>
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">{children}</div>
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
    </section>
  );
}
