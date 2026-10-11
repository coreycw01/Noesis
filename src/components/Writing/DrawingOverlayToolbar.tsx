"use client";

import { ArrowUpRight, Circle, Eraser, MoveLeft, PencilLine, PenTool, Square, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DrawingTool } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DrawingOverlayToolbarProps {
  tool: DrawingTool;
  color: string;
  size: number;
  opacity: number;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onOpacityChange: (opacity: number) => void;
  onClear: () => void;
  onReturnToWriting: () => void;
}

const tools: Array<{ value: DrawingTool; label: string; Icon: typeof PencilLine }> = [
  { value: 'pencil', label: 'Pencil', Icon: PencilLine },
  { value: 'marker', label: 'Marker', Icon: PenTool },
  { value: 'line', label: 'Line', Icon: MoveLeft },
  { value: 'rectangle', label: 'Rectangle', Icon: Square },
  { value: 'ellipse', label: 'Ellipse', Icon: Circle },
  { value: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { value: 'text', label: 'Text', Icon: Type },
  { value: 'eraser', label: 'Eraser', Icon: Eraser },
];

export function DrawingOverlayToolbar({
  tool,
  color,
  size,
  opacity,
  onToolChange,
  onColorChange,
  onSizeChange,
  onOpacityChange,
  onClear,
  onReturnToWriting,
}: DrawingOverlayToolbarProps) {
  return (
    <div className="sticky top-0 z-40 flex items-center border-b border-border/30 bg-background/95 px-3 py-2 backdrop-blur sm:px-8">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--card-radius)] border border-border/60 bg-card p-1.5 shadow-sm">
        <div className="flex shrink-0 items-center gap-1 border-r border-border/40 px-2">
          <Button type="button" variant="ghost" size="sm" onClick={onReturnToWriting} className="h-8 rounded-md px-2.5 font-code text-[9px] font-bold uppercase tracking-wider" title="Return to writing tools">
            <Type className="mr-1.5 size-3.5" /> Write
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 border-r border-border/40 px-2">
          {tools.map(({ value, label, Icon }) => (
            <Button
              key={value}
              type="button"
              variant={tool === value ? 'default' : 'ghost'}
              size="icon"
              onClick={() => onToolChange(value)}
              className={cn('size-8 rounded-md', tool === value && 'shadow-none')}
              title={label}
              aria-label={`${label} drawing tool`}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>
        <label className="flex h-8 shrink-0 items-center gap-1.5 border-r border-border/40 px-2 font-code text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Ink
          <input aria-label="Drawing ink color" type="color" value={color} onChange={(event) => onColorChange(event.target.value)} className="size-5 cursor-pointer border-0 bg-transparent p-0" />
        </label>
        <label className="flex h-8 shrink-0 items-center gap-2 border-r border-border/40 px-2 font-code text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Size
          <input aria-label="Drawing size" type="range" min={1} max={24} value={size} onChange={(event) => onSizeChange(Number(event.target.value))} className="w-20 accent-[hsl(var(--accent))]" />
        </label>
        <label className="flex h-8 shrink-0 items-center gap-2 px-2 font-code text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Opacity
          <input aria-label="Drawing opacity" type="range" min={0.1} max={1} step={0.1} value={opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} className="w-16 accent-[hsl(var(--accent))]" />
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 shrink-0 rounded-md px-2.5 font-code text-[9px] font-bold uppercase tracking-wider text-destructive hover:text-destructive" title="Clear all drawing marks">
          <Eraser className="mr-1.5 size-3.5" /> Clear
        </Button>
      </div>
    </div>
  );
}
