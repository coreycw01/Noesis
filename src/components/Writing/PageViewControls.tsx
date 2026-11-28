'use client';

import { FileCog, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentViewMode } from '@/lib/types';
import type { ResolvedDocumentPageSettings as PaperSettings } from '@/lib/work-page-settings';

const pageSizes = { letter: 'US Letter (8.5 x 11 in)', a4: 'A4 (210 x 297 mm)' };
const paperColors = { blank: 'White', warm: 'Warm', sepia: 'Sepia', dark: 'Dark' };
const paperPatterns = { none: 'Plain', notebook: 'Lined notebook', grid: 'Grid', dotted: 'Dotted', dotted_grid: 'Dot grid' };

function ChoiceMenu<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return <DropdownMenuSub>
    <DropdownMenuSubTrigger className="min-h-10 gap-2">
      <span>{label}</span><span className="ml-auto truncate text-xs text-muted-foreground">{options[value]}</span>
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent className="min-w-36">
      <DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as T)}>
        {(Object.keys(options) as T[]).map(key => <DropdownMenuRadioItem key={key} value={key} className="min-h-10">{options[key]}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}

function PaperChoices({ settings, onChange }: { settings: PaperSettings; onChange: (patch: Partial<PaperSettings>) => void }) {
  return <>
    <ChoiceMenu label="Page size" value={settings.pageSize} options={pageSizes} onChange={pageSize => onChange({ pageSize })} />
    <ChoiceMenu label="Paper color" value={settings.paperColor} options={paperColors} onChange={paperColor => onChange({ paperColor })} />
    <ChoiceMenu label="Writing guide" value={settings.paperPattern} options={paperPatterns} onChange={paperPattern => onChange({ paperPattern })} />
  </>;
}

export function PageViewControls({ viewMode, onViewModeChange, settings, onChange, multiplePages }: {
  viewMode: DocumentViewMode;
  onViewModeChange: (view: DocumentViewMode) => void;
  settings: PaperSettings;
  onChange: (patch: Partial<PaperSettings>) => void;
  multiplePages: boolean;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="min-h-10 shrink-0" title="Document settings" aria-label="Document settings">
        <Settings2 className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Document settings</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64">
      <DropdownMenuLabel>Default paper for all pages</DropdownMenuLabel>
      <PaperChoices settings={settings} onChange={onChange} />
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Document view</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={multiplePages || viewMode === 'vertical-continuous' ? 'vertical-continuous' : 'vertical-single'} onValueChange={value => onViewModeChange(value as DocumentViewMode)}>
        <DropdownMenuRadioItem value="vertical-continuous" className="min-h-10">Continuous</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="vertical-single" className="min-h-10" disabled={multiplePages}>Fit single page</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function PageSettingsControl({ pageLabel, settings, onChange, overridden, onReset }: {
  pageLabel: string;
  settings: PaperSettings;
  onChange: (patch: Partial<PaperSettings>) => void;
  overridden: boolean;
  onReset: () => void;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="min-h-10 shrink-0" title="Page settings" aria-label={`Page settings for ${pageLabel}${overridden ? ', customized' : ''}`}>
        <FileCog className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Page settings</span>
        {overridden && <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel>
        <span className="block truncate">{pageLabel}</span>
        <span className="block text-xs font-normal text-muted-foreground">{overridden ? 'Custom paper settings' : 'Uses document defaults'}</span>
      </DropdownMenuLabel>
      <PaperChoices settings={settings} onChange={onChange} />
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onReset} disabled={!overridden} className="min-h-10">
        <RotateCcw className="size-4" aria-hidden="true" /> Reset to document defaults
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
