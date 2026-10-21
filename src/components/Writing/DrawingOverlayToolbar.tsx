"use client";

import { ArrowUpRight, Circle, Eraser, Feather, Highlighter, Menu, MoveLeft, Paintbrush, PenLine, PencilLine, Redo2, Settings2, Square, Type, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onReturnToWriting: () => void;
}

const utensils: Array<{ value: DrawingTool; label: string; Icon: typeof PencilLine }> = [
  { value: 'pen', label: 'Pen', Icon: PenLine },
  { value: 'calligraphy', label: 'Calligraphy', Icon: Feather },
  { value: 'marker', label: 'Marker', Icon: Paintbrush },
  { value: 'highlighter', label: 'Highlighter', Icon: Highlighter },
];

const secondaryTools: Array<{ value: DrawingTool; label: string; Icon: typeof PencilLine }> = [
  { value: 'pencil', label: 'Pencil', Icon: PencilLine },
  { value: 'line', label: 'Line', Icon: MoveLeft },
  { value: 'rectangle', label: 'Rectangle', Icon: Square },
  { value: 'ellipse', label: 'Ellipse', Icon: Circle },
  { value: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { value: 'text', label: 'Text', Icon: Type },
  { value: 'eraser', label: 'Eraser', Icon: Eraser },
];

export function DrawingOverlayToolbar({ tool, color, size, opacity, onToolChange, onColorChange, onSizeChange, onOpacityChange, onClear, onUndo, onRedo, canUndo, canRedo, onReturnToWriting }: DrawingOverlayToolbarProps) {
  const activeTool = [...utensils, ...secondaryTools].find((item) => item.value === tool);
  const ActiveIcon = activeTool?.Icon || Menu;
  const previewOpacity = tool === 'highlighter' ? Math.min(opacity, 0.35) : tool === 'marker' ? Math.min(opacity, 0.85) : opacity;
  const previewWidth = tool === 'highlighter' ? size * 3.5 : tool === 'marker' ? size * 2.5 : tool === 'calligraphy' ? size * 1.8 : size;

  return (
    <div className="sticky top-0 z-40 h-[60px] shrink-0 overflow-hidden border-b border-border/30 bg-background/95 px-3 py-2 backdrop-blur sm:h-[101px] sm:px-6">
      <div className="flex min-h-11 w-full flex-nowrap items-center justify-start gap-1 rounded-[var(--card-radius)] border border-border/60 bg-card p-1.5 shadow-sm sm:flex-wrap sm:justify-center sm:gap-1.5">
        <div className="flex shrink-0 items-center gap-1 border-r border-border/40 pr-2">
          <Button type="button" variant="ghost" size="sm" onClick={onReturnToWriting} className="h-8 rounded-md px-2.5 font-code text-[9px] font-bold uppercase tracking-wider" title="Return to writing tools">
            <Type className="mr-1.5 size-3.5" /> Write
          </Button>
        </div>

        <div className="hidden shrink-0 items-center gap-0.5 border-r border-border/40 pr-2 sm:flex">
          {utensils.map(({ value, label, Icon }) => (
            <Button key={value} type="button" variant={tool === value ? 'default' : 'ghost'} size="icon" onClick={() => onToolChange(value)} className={cn('size-8 rounded-md', tool === value && 'shadow-none')} title={label} aria-label={`${label} drawing tool`}>
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 min-w-0 rounded-md border-border/60 px-2.5" aria-label="Choose drawing utensil">
              <ActiveIcon className="mr-2 size-4" /><span className="max-w-24 truncate">{activeTool?.label || 'Tools'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Writing utensils</DropdownMenuLabel>
            {utensils.map(({ value, label, Icon }) => <DropdownMenuItem key={value} onSelect={() => onToolChange(value)}><Icon className="mr-2 size-4" />{label}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Shapes and actions</DropdownMenuLabel>
            {secondaryTools.map(({ value, label, Icon }) => <DropdownMenuItem key={value} onSelect={() => onToolChange(value)}><Icon className="mr-2 size-4" />{label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex h-8 min-w-16 flex-1 items-center justify-center px-2 sm:max-w-28 sm:flex-none" aria-label={`${activeTool?.label || 'Drawing'} stroke preview`}>
          <span className="block w-full rounded-full" style={{ height: Math.max(2, Math.min(12, previewWidth)), backgroundColor: color, opacity: previewOpacity, transform: tool === 'calligraphy' ? 'skewX(-24deg)' : undefined }} />
        </div>

        <label className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-muted" title="Ink color">
          <span className="size-5 rounded-full border border-border shadow-sm" style={{ backgroundColor: color }} />
          <input aria-label="Drawing ink color" type="color" value={color} onChange={(event) => onColorChange(event.target.value)} className="sr-only" />
        </label>

        <div className="flex shrink-0 items-center gap-0.5 border-l border-border/40 pl-1">
          <Button type="button" variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="size-8 rounded-md" aria-label="Undo drawing stroke"><Undo2 className="size-4" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} className="size-8 rounded-md" aria-label="Redo drawing stroke"><Redo2 className="size-4" /></Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md" aria-label="Drawing settings"><Settings2 className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-3">
            <div className="space-y-4">
              <label className="block text-xs font-medium text-foreground">Stroke size <span className="float-right tabular-nums text-muted-foreground">{size}px</span><input aria-label="Drawing size" type="range" min={1} max={24} value={size} onChange={(event) => onSizeChange(Number(event.target.value))} className="mt-2 w-full accent-[hsl(var(--accent))]" /></label>
              <label className="block text-xs font-medium text-foreground">Opacity <span className="float-right tabular-nums text-muted-foreground">{Math.round(opacity * 100)}%</span><input aria-label="Drawing opacity" type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} className="mt-2 w-full accent-[hsl(var(--accent))]" /></label>
              <p className="text-xs leading-5 text-muted-foreground">Pen responds to pointer pressure. Calligraphy uses an angled nib. Marker stays opaque; highlighter remains translucent.</p>
            </div>
            <DropdownMenuSeparator className="my-3" />
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="min-h-10 w-full justify-start text-destructive hover:text-destructive"><Eraser className="mr-2 size-4" /> Clear page drawing</Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
