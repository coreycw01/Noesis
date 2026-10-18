
"use client";

import React from 'react';
import { 
  MonitorPlay, 
  FileBox, 
  Settings2,
  Check,
  Palette,
  LayoutGrid,
  FileCog,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PageViewMode, PageSize, PaperColor, PaperPattern } from './Atelier';
import { cn } from '@/lib/utils';

interface PageViewControlsProps {
  viewMode: PageViewMode;
  onViewModeChange: (mode: PageViewMode) => void;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  paperColor: PaperColor;
  onPaperColorChange: (color: PaperColor) => void;
  paperPattern: PaperPattern;
  onPaperPatternChange: (pattern: PaperPattern) => void;
}

export function PageViewControls({ 
  viewMode, 
  onViewModeChange, 
  pageSize, 
  onPageSizeChange,
  paperColor,
  onPaperColorChange,
  paperPattern,
  onPaperPatternChange
}: PageViewControlsProps) {
  const modes: { id: PageViewMode; label: string; icon: any }[] = [
    { id: 'vertical-continuous', label: 'Continuous document', icon: MonitorPlay },
    { id: 'vertical-single', label: 'Focused page', icon: FileBox },
  ];

  const colors: { id: PaperColor; label: string; bg: string }[] = [
    { id: 'blank', label: 'White', bg: 'bg-card' },
    { id: 'warm', label: 'Warm', bg: 'bg-amber-50/50' },
    { id: 'sepia', label: 'Sepia', bg: 'bg-[#f4ecd8]' },
    { id: 'dark', label: 'Dark', bg: 'bg-slate-900' },
  ];

  const patterns: { id: PaperPattern; label: string; icon: any }[] = [
    { id: 'none', label: 'Plain', icon: Palette },
    { id: 'notebook', label: 'Lined', icon: LayoutGrid },
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'dotted', label: 'Dotted', icon: LayoutGrid },
    { id: 'dotted_grid', label: 'Dot Grid', icon: LayoutGrid },
  ];

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 rounded-md border-border/60 bg-card px-4 font-bold shadow-sm">
            <Settings2 className="size-4 text-accent" />
            Document defaults
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 border-border bg-popover font-body text-popover-foreground">
          <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest opacity-40">Document view</DropdownMenuLabel>
          {modes.map((mode) => (
            <DropdownMenuItem 
              key={mode.id} 
              onClick={() => onViewModeChange(mode.id)}
              className={cn("flex items-center gap-3 py-2 cursor-pointer", viewMode === mode.id && "bg-accent/5 text-accent")}
            >
              <mode.icon className="size-4" />
              <span className="text-xs italic">{mode.label}</span>
              {viewMode === mode.id && <Check className="size-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest opacity-40">Standard page size</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onPageSizeChange('letter')} className={cn("text-xs italic cursor-pointer flex items-center justify-between", pageSize === 'letter' && "text-accent")}>
            US Letter (8.5&quot; x 11&quot;)
            {pageSize === 'letter' && <Check className="size-3" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPageSizeChange('a4')} className={cn("text-xs italic cursor-pointer flex items-center justify-between", pageSize === 'a4' && "text-accent")}>
            A4 Standard
            {pageSize === 'a4' && <Check className="size-3" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest opacity-40">Document paper</DropdownMenuLabel>
          <div className="grid grid-cols-4 gap-2 p-2">
            {colors.map((color) => (
              <button
                key={color.id}
                onClick={() => onPaperColorChange(color.id)}
                title={color.label}
                className={cn(
                  "flex h-8 min-w-8 items-center justify-center rounded-md border px-1 transition-colors hover:border-accent",
                  color.bg,
                  paperColor === color.id ? "border-accent ring-2 ring-accent/20" : "border-border/40"
                )}
              >
                {paperColor === color.id && <Check className={cn("size-3", color.id === 'dark' ? "text-white" : "text-accent")} />}
              </button>
            ))}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest opacity-40">Writing guide</DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1 p-2">
            {patterns.map((pattern) => (
              <button
                key={pattern.id}
                onClick={() => onPaperPatternChange(pattern.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border p-2 transition-all hover:border-accent/40",
                  paperPattern === pattern.id ? "border-accent bg-accent/5" : "border-border/40"
                )}
              >
                <pattern.icon className="size-3.5 opacity-40" />
                <span className="text-[10px] italic leading-none text-center">{pattern.label}</span>
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function PageSettingsControl({
  pageLabel,
  pageSize,
  onPageSizeChange,
  paperColor,
  onPaperColorChange,
  paperPattern,
  onPaperPatternChange,
  overridden = false,
  onReset,
}: {
  pageLabel: string;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  paperColor: PaperColor;
  onPaperColorChange: (color: PaperColor) => void;
  paperPattern: PaperPattern;
  onPaperPatternChange: (pattern: PaperPattern) => void;
  overridden?: boolean;
  onReset?: () => void;
}) {
  const colors: { id: PaperColor; label: string; bg: string }[] = [
    { id: 'blank', label: 'White', bg: 'bg-white' },
    { id: 'warm', label: 'Warm', bg: 'bg-amber-50' },
    { id: 'sepia', label: 'Sepia', bg: 'bg-[#f4ecd8]' },
    { id: 'dark', label: 'Dark', bg: 'bg-slate-900' },
  ];
  const patterns: { id: PaperPattern; label: string }[] = [
    { id: 'none', label: 'Plain' },
    { id: 'notebook', label: 'Lined' },
    { id: 'grid', label: 'Grid' },
    { id: 'dotted', label: 'Dotted' },
    { id: 'dotted_grid', label: 'Dot grid' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-md border-border/60 bg-card px-3 font-bold shadow-sm" aria-label={`Page settings for ${pageLabel}`}>
          <FileCog className="size-4 text-accent" />
          <span>This page</span>
          {overridden && <span className="size-1.5 rounded-full bg-accent" aria-label="Custom page settings" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border-border bg-popover font-body text-popover-foreground">
        <DropdownMenuLabel>
          <span className="block font-code text-[9px] uppercase tracking-widest text-muted-foreground">This page only</span>
          <span className="mt-1 block truncate text-xs font-normal text-foreground">{pageLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest opacity-50">Page size</DropdownMenuLabel>
        {(['letter', 'a4'] as PageSize[]).map((size) => (
          <DropdownMenuItem key={size} onClick={() => onPageSizeChange(size)} className="flex cursor-pointer items-center justify-between text-xs">
            {size === 'letter' ? 'US Letter (8.5 x 11)' : 'A4'}
            {pageSize === size && <Check className="size-3 text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest opacity-50">Paper color</DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-2 p-2">
          {colors.map((color) => (
            <button key={color.id} type="button" onClick={() => onPaperColorChange(color.id)} aria-label={`${color.label} paper`} className={cn('flex h-8 items-center justify-center rounded-md border', color.bg, paperColor === color.id ? 'border-accent ring-2 ring-accent/20' : 'border-border/50')}>
              {paperColor === color.id && <Check className={cn('size-3', color.id === 'dark' ? 'text-white' : 'text-accent')} />}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-code text-[9px] uppercase tracking-widest opacity-50">Writing guide</DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 p-2">
          {patterns.map((pattern) => (
            <button key={pattern.id} type="button" onClick={() => onPaperPatternChange(pattern.id)} className={cn('rounded-md border px-2 py-2 text-xs', paperPattern === pattern.id ? 'border-accent bg-accent/5 text-accent' : 'border-border/50 text-muted-foreground')}>
              {pattern.label}
            </button>
          ))}
        </div>
        {onReset && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReset} disabled={!overridden} className="cursor-pointer text-xs">
              <RotateCcw className="mr-2 size-3.5" /> Use document settings
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
