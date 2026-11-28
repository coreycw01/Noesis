"use client";

import React, { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripHorizontal, Maximize2, Minus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import type { WorkToolSection } from '@/lib/types';
import { cn } from '@/lib/utils';
import { workDragScrollStep } from '@/lib/work-page-location';

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
  /**
   * Drop the tool on another page of the document. The geometry is already
   * relative to that page, so the tool keeps the spot you dropped it on.
   */
  onMoveToPage?: (pageId: string, geometry?: { x: number; y: number }) => void;
  pageOptions?: readonly { id: string; label: string }[];
  /** Lowest and highest layer among the tools on this page. */
  layerRange?: { min: number; max: number };
  children: ReactNode;
}

/** The page under the pointer, ignoring the tool being dragged. */
function pageUnder(x: number, y: number, dragged: HTMLElement | null) {
  for (const element of document.elementsFromPoint(x, y)) {
    if (dragged && dragged.contains(element)) continue;
    const page = element.closest<HTMLElement>('[data-work-page-id]');
    if (page) return page;
  }
  return null;
}

type Interaction = {
  kind: 'move' | 'resize';
  corner?: 'nw' | 'ne' | 'sw' | 'se';
  pointerId: number;
  startX: number;
  startY: number;
  scrollOrigin: number;
  scrollContainer: HTMLElement | null;
  scale: number;
  grabX: number;
  grabY: number;
  frame: ToolWindow;
  geometry?: Pick<ToolWindow, 'x' | 'y' | 'width' | 'height'>;
  previousUserSelect: string;
};

function normalizedWindow(section: WorkToolSection): ToolWindow {
  const legacyWidth = section.widthPercent ? Math.round(760 * (section.widthPercent / 100)) : DEFAULT_WINDOW.width;
  return {
    ...DEFAULT_WINDOW,
    width: Math.max(320, Math.min(760, legacyWidth)),
    ...section.window,
  };
}

export function FloatingWorkToolWindow({ section, label, mobileActive, onFocus, onPatch, onPlacementChange, onRemove, onMoveToPage, pageOptions, layerRange, children }: FloatingWorkToolWindowProps) {
  const [frame, setFrame] = useState(() => normalizedWindow(section));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dragging, setDragging] = useState(false);
  const onMoveToPageRef = useRef(onMoveToPage);
  const frameRef = useRef(frame);
  const isMobile = useIsMobile();
  const interactionRef = useRef<Interaction | null>(null);
  const windowRef = useRef<HTMLElement | null>(null);
  const onPatchRef = useRef(onPatch);

  useEffect(() => {
    onPatchRef.current = onPatch;
    onMoveToPageRef.current = onMoveToPage;
  }, [onPatch, onMoveToPage]);

  useEffect(() => { frameRef.current = frame; }, [frame]);

  useEffect(() => {
    if (interactionRef.current) return;
    setFrame(normalizedWindow(section));
  }, [section]);

  useEffect(() => {
    let animation = 0;
    let cursor: { x: number; y: number } | undefined;
    const clearDropTarget = () => {
      for (const page of document.querySelectorAll<HTMLElement>('[data-tool-drop]')) delete page.dataset.toolDrop;
    };
    const stopScroll = () => { window.cancelAnimationFrame(animation); animation = 0; cursor = undefined; clearDropTarget(); };
    const updateGeometry = (interaction: Interaction, point: { x: number; y: number }) => {
      const { frame } = interaction;
      const current = interaction.geometry || frame;
      const dx = (point.x - interaction.startX) / interaction.scale;
      const dy = (point.y - interaction.startY + (interaction.scrollContainer?.scrollTop ?? 0) - interaction.scrollOrigin) / interaction.scale;
      const paper = windowRef.current?.closest<HTMLElement>('[data-work-page-paper]');
      const availableWidth = paper?.clientWidth || 850;
      const availableHeight = paper?.clientHeight || 1100;
      if (interaction.kind === 'move') {
        // Mark the page under the pointer, so dragging across a page break
        // shows where the tool would land instead of silently snapping back.
        const over = pageUnder(point.x, point.y, windowRef.current);
        clearDropTarget();
        if (over && over !== windowRef.current?.closest('[data-work-page-id]')) over.dataset.toolDrop = 'true';
        const geometry = {
          width: current.width,
          height: current.height,
          x: Math.max(0, Math.min(Math.max(0, availableWidth - current.width), frame.x + dx)),
          y: Math.max(48, Math.min(Math.max(48, availableHeight - current.height), frame.y + dy)),
        };
        interaction.geometry = geometry;
        setFrame((current) => ({ ...current, ...geometry, x: frame.x + dx, y: frame.y + dy }));
        return;
      }

      const corner = interaction.corner || 'se';
      const fromLeft = corner.endsWith('w');
      const fromTop = corner.startsWith('n');
      const nextWidth = Math.max(320, Math.min(availableWidth, frame.width + (fromLeft ? -dx : dx)));
      const nextHeight = Math.max(260, Math.min(availableHeight - 48, frame.height + (fromTop ? -dy : dy)));
      const geometry = {
        width: nextWidth,
        height: nextHeight,
        x: fromLeft ? Math.max(0, frame.x + frame.width - nextWidth) : Math.min(current.x, Math.max(0, availableWidth - nextWidth)),
        y: fromTop ? Math.max(48, frame.y + frame.height - nextHeight) : Math.min(current.y, Math.max(48, availableHeight - nextHeight)),
      };
      interaction.geometry = geometry;
      setFrame((current) => ({ ...current, ...geometry }));
    };
    const scroll = () => {
      animation = 0;
      const interaction = interactionRef.current;
      const container = interaction?.scrollContainer;
      if (!interaction || !container || !cursor) return;
      const { top, bottom } = container.getBoundingClientRect();
      const step = workDragScrollStep(cursor.y, top, bottom);
      if (!step) return;
      const before = container.scrollTop;
      container.scrollTop += step;
      if (before === container.scrollTop) return;
      updateGeometry(interaction, cursor);
      animation = window.requestAnimationFrame(scroll);
    };
    const move = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      cursor = { x: event.clientX, y: event.clientY };
      updateGeometry(interaction, cursor);
      if (interaction.kind === 'move' && !animation) animation = window.requestAnimationFrame(scroll);
    };
    const end = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      interactionRef.current = null;
      setDragging(false);
      document.body.style.userSelect = interaction.previousUserSelect;
      stopScroll();
      if (interaction.kind === 'move') {
        const from = windowRef.current?.closest<HTMLElement>('[data-work-page-id]');
        const to = pageUnder(event.clientX, event.clientY, windowRef.current);
        const pageId = to?.dataset.workPageId;
        if (to && from && to !== from && pageId && onMoveToPageRef.current) {
          // Keep the spot under the pointer: the tool lands where it was
          // dropped, grabbed at the same point on its header.
          const paper = to.querySelector<HTMLElement>('[data-work-page-paper]') ?? to;
          const bounds = paper.getBoundingClientRect();
          const scale = bounds.width / (paper.clientWidth || bounds.width || 1) || 1;
          const size = interaction.geometry || interaction.frame;
          onMoveToPageRef.current(pageId, {
            x: Math.max(0, Math.min(paper.clientWidth - size.width, (event.clientX - bounds.left) / scale - interaction.grabX)),
            y: Math.max(0, Math.min(paper.clientHeight - size.height, (event.clientY - bounds.top) / scale - interaction.grabY)),
          });
          return;
        }
      }
      if (interaction.geometry) {
        const geometry = interaction.geometry;
        setFrame(current => ({ ...current, ...geometry }));
        onPatchRef.current(geometry);
      }
    };
    const cancel = (event: Event) => {
      const interaction = interactionRef.current;
      if (!interaction || ('pointerId' in event && interaction.pointerId !== event.pointerId)) return;
      interactionRef.current = null;
      setDragging(false);
      document.body.style.userSelect = interaction.previousUserSelect;
      stopScroll();
      setFrame(interaction.frame);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      stopScroll();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      if (interactionRef.current) document.body.style.userSelect = interactionRef.current.previousUserSelect;
      interactionRef.current = null;
    };
  }, []);

  const begin = (event: ReactPointerEvent, kind: Interaction['kind'], corner?: Interaction['corner']) => {
    if (event.button !== 0 || interactionRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const element = windowRef.current;
    const focused = document.activeElement;
    if (kind === 'move' && focused instanceof HTMLElement && element?.contains(focused)) focused.blur();
    onFocus();
    const bounds = element?.getBoundingClientRect();
    const scrollContainer = element?.closest<HTMLElement>('[data-work-document-scroll]') ?? null;
    const scale = bounds && element?.offsetWidth ? bounds.width / element.offsetWidth || 1 : 1;
    interactionRef.current = {
      kind, corner, frame, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      scrollOrigin: scrollContainer?.scrollTop ?? 0, scrollContainer, scale,
      grabX: (event.clientX - (bounds?.left ?? event.clientX)) / scale,
      grabY: (event.clientY - (bounds?.top ?? event.clientY)) / scale,
      previousUserSelect: document.body.style.userSelect,
    };
    document.body.style.userSelect = 'none';
    if (kind === 'move') setDragging(true);
  };

  // A page can get narrower — a smaller window, a different page size. Pull
  // the tool back inside instead of leaving it hanging off the paper.
  useEffect(() => {
    const page = windowRef.current?.closest<HTMLElement>('[data-work-page-paper]');
    if (isMobile || !page || typeof ResizeObserver === 'undefined') return;
    const watcher = new ResizeObserver(() => {
      if (interactionRef.current) return;
      const bounds = { width: page.clientWidth, height: page.clientHeight };
      if (!bounds.width || !bounds.height) return;
      const current = frameRef.current;
      if (current.placement && current.placement !== 'overlay') return;
      const width = Math.min(current.width, Math.max(320, bounds.width));
      const height = Math.min(current.height, Math.max(260, bounds.height - 48));
      const x = Math.max(0, Math.min(current.x, Math.max(0, bounds.width - width)));
      const y = Math.max(0, Math.min(current.y, Math.max(0, bounds.height - height)));
      if (width === current.width && height === current.height && x === current.x && y === current.y) return;
      setFrame((previous) => ({ ...previous, width, height, x, y }));
      onPatchRef.current({ width, height, x, y });
    });
    watcher.observe(page);
    return () => watcher.disconnect();
  }, [isMobile]);

  const setMinimized = (minimized: boolean) => {
    const next = { ...frame, minimized };
    setFrame(next);
    onPatch({ minimized });
    if (!minimized) onFocus();
  };

  const color = frame.background?.color;
  const tint = color && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
  const savedOpacity = frame.background?.opacity;
  const opacity = typeof savedOpacity === 'number' && Number.isFinite(savedOpacity)
    ? Math.max(0, Math.min(100, Math.round(savedOpacity)))
    : undefined;
  const displayedOpacity = opacity ?? (isMobile ? 100 : 0);
  const customBackground = Boolean(tint || opacity !== undefined);
  const setLayer = (zIndex: number) => {
    setFrame((current) => ({ ...current, zIndex, layerLocked: true }));
    onPatch({ zIndex, layerLocked: true });
  };
  const alignTo = (side: 'left' | 'center' | 'right') => {
    const pageWidth = windowRef.current?.offsetParent instanceof HTMLElement ? windowRef.current.offsetParent.clientWidth : 0;
    if (!pageWidth) return;
    const room = Math.max(0, pageWidth - frame.width);
    const x = side === 'left' ? 0 : side === 'center' ? Math.round(room / 2) : room;
    setFrame((current) => ({ ...current, x }));
    onPatch({ x });
  };
  const updateBackground = (background: NonNullable<ToolWindow['background']>) => {
    setFrame((current) => ({ ...current, background }));
    onPatch({ background });
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
      tabIndex={-1}
      aria-label={`${label} tool window`}
      data-minimized={frame.minimized ? 'true' : undefined}
      data-dragging={dragging ? 'true' : undefined}
      data-custom-background={customBackground ? 'true' : undefined}
      inert={frame.minimized}
      onPointerDown={(event) => {
        event.stopPropagation();
        onFocus();
      }}
      className={cn(
        'works-tool-window group/tool flex min-h-0 flex-col overflow-hidden bg-background text-foreground max-md:shadow-sm md:bg-transparent md:text-inherit md:shadow-none',
        'fixed inset-x-2 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] top-[calc(4.5rem+env(safe-area-inset-top))] z-[45] rounded-[var(--card-radius)] border border-border/25 md:bottom-auto md:right-auto md:z-[var(--work-tool-layer)] md:h-[var(--work-tool-height)] md:w-[var(--work-tool-width)] md:rounded-md md:border-transparent md:focus-within:border-accent/45 md:hover:border-current/20',
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
        '--work-tool-tint': tint,
        '--work-tool-alpha': `${opacity ?? 100}%`,
        '--work-tool-layer': mobileActive && isMobile ? 40 : frame.zIndex,
        display: frame.minimized ? 'none' : undefined,
      } as CSSProperties}
    >
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b border-border/20 bg-background px-3 md:h-9 md:cursor-move md:border-current/10 md:bg-transparent md:px-2"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button,select')) return;
          if (isMobile || frame.placement !== 'overlay') return;
          begin(event, 'move');
        }}
      >
        <GripHorizontal className="hidden size-4 shrink-0 text-muted-foreground/60 md:block" />
        <span className="min-w-0 flex-1 truncate noesis-eyebrow font-bold opacity-75">{label}</span>
        <select
          value={frame.placement || 'overlay'}
          onChange={(event) => {
            const placement = event.target.value as NonNullable<ToolWindow['placement']>;
            setFrame((current) => ({ ...current, placement }));
            onPlacementChange(placement);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="h-7 max-w-24 rounded-md border border-border/40 bg-background/70 px-1.5 noesis-eyebrow noesis-eyebrow--sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${label} placement`}
          title="Choose how text flows around this tool"
        >
          <option value="overlay">Overlay</option>
          <option value="wrap">Wrap text</option>
          <option value="break">Break text</option>
        </select>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 md:size-7" aria-label={`${label} settings`} title="Tool settings">
              <Pencil className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" aria-label={`${label} settings`} className="max-h-[min(75dvh,32rem)] w-64 max-w-[calc(100vw-1rem)] space-y-3 overflow-y-auto" onPointerDown={(event) => event.stopPropagation()}>
            {onMoveToPage && pageOptions && pageOptions.length > 1 && <label className="grid gap-1 text-sm font-medium">
              Move to page
              <select value={section.pageId || 'main'} onChange={event => onMoveToPage(event.target.value)} className="min-h-11 min-w-0 rounded-md border border-border bg-background px-2 text-foreground">
                {pageOptions.map((page, index) => <option key={page.id} value={page.id}>{index + 1}. {page.label}</option>)}
              </select>
            </label>}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Tool appearance</span>
              <Button type="button" size="sm" variant="ghost" disabled={!customBackground} onClick={() => updateBackground({})}>Reset</Button>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              Background tint
              <input type="color" value={tint ?? '#d8a75e'} onInput={(event) => updateBackground({ color: event.currentTarget.value, opacity: displayedOpacity || 80 })} className="size-10 cursor-pointer rounded border border-border bg-transparent p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="flex justify-between gap-2">Background opacity <span aria-hidden="true" className="tabular-nums text-muted-foreground">{displayedOpacity}%</span></span>
              <input type="range" min={0} max={100} step={1} value={displayedOpacity} onChange={(event) => updateBackground({ ...frame.background, opacity: event.target.valueAsNumber })} className="h-8 w-full accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <div className="space-y-1.5 border-t border-border/60 pt-3">
              <span className="text-sm font-semibold">Layer</span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={() => setLayer((layerRange?.max ?? frame.zIndex ?? 1) + 1)}>Bring to front</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setLayer((frame.zIndex ?? 1) + 1)}>Bring forward</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setLayer(Math.max(0, (frame.zIndex ?? 1) - 1))}>Send backward</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setLayer(Math.max(0, (layerRange?.min ?? frame.zIndex ?? 1) - 1))}>Send to back</Button>
              </div>
            </div>
            {(frame.placement || 'overlay') === 'overlay' && (
              <div className="space-y-1.5">
                <span className="text-sm font-semibold">Align on the page</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['left', 'center', 'right'] as const).map((side) => (
                    <Button key={side} type="button" size="sm" variant="outline" className="capitalize" onClick={() => alignTo(side)}>{side}</Button>
                  ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <Button type="button" variant="ghost" size="icon" onClick={() => setMinimized(true)} className="size-10 shrink-0 rounded-md md:size-7" aria-label={`Minimize ${label}`}>
          <Minus className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setConfirmRemove(true)} className="size-10 shrink-0 rounded-md text-muted-foreground hover:text-destructive md:size-7" aria-label={`Remove ${label}`} title={`Remove ${label}`}>
          <Trash2 className="size-4" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain p-2 md:p-3">
        <div className="my-auto flex w-full min-w-0 shrink-0 justify-center">{children}</div>
      </div>
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
