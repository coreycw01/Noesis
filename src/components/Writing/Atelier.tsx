"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  Cloud,
  Download,
  Eraser,
  ExternalLink,
  ImageIcon,
  Link2,
  Mic,
  NotebookPen,
  PencilLine,
  PenTool,
  Plus,
  RefreshCw,
  Redo2,
  Save,
  Search,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlink,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConceptTagPicker } from '@/components/ConceptTagPicker';
import { FormattingToolbar } from './FormattingToolbar';
import { DocumentCanvas } from './DocumentCanvas';
import { PageViewControls } from './PageViewControls';
import type { Concept, Draft, DraftStatus, DraftType, ExternalDocProvider, Media, Question, UserPreferences, VaultEntry, WritingStyle } from '@/lib/types';
import { DRAFT_LABELS, WORK_CATEGORY_LABELS, WRITING_STYLE_DESCRIPTIONS, WRITING_STYLE_LABELS, WRITING_STYLES, normalizeConceptTags, today, workCategoryForDraft } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { escapeTextAsHtml, sanitizeHtml } from '@/lib/sanitize';

export type PageViewMode = 'vertical-continuous' | 'vertical-single' | 'horizontal-single';
export type PageSize = 'letter' | 'a4';
export type PaperColor = 'blank' | 'warm' | 'sepia' | 'dark';
export type PaperPattern = 'none' | 'notebook' | 'grid' | 'dotted' | 'dotted_grid';
type WritingTool = 'text' | 'pencil' | 'eraser';
type BrowserSpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface AtelierProps {
  drafts: Draft[];
  media: Media[];
  vault: VaultEntry[];
  questions: Question[];
  concepts: Concept[];
  writingDefaults: UserPreferences['writingDefaults'];
  onAddDraft: (data: Partial<Draft>) => Draft;
  onUpdateDraft: (draft: Draft) => void;
  onDeleteDraft: (id: string) => void;
  onAddConcept: (data: Partial<Concept>) => void;
}

const statuses: DraftStatus[] = ['seed', 'drafting', 'revised', 'final'];
const articulationTypes: DraftType[] = ['essay', 'script', 'field_note', 'manuscript', 'reflection', 'argument', 'source_analysis', 'text_note', 'voice_note', 'talk_to_text', 'drawing_note', 'drawing', 'recording'];
const workFilters: ('all' | DraftType | DraftStatus)[] = ['all', ...articulationTypes, 'drafting', 'final'];
const workTabs = ['all', 'writing', 'notes', 'recording', 'drawing'] as const;
const writingLabels: DraftType[] = ['essay', 'script', 'field_note', 'manuscript', 'reflection', 'argument', 'source_analysis'];
type WorkTab = (typeof workTabs)[number];

const providerLabels: Record<ExternalDocProvider, string> = {
  google_docs: 'Google Docs',
  notion: 'Notion',
  dropbox_paper: 'Dropbox Paper',
  microsoft_word: 'Microsoft Word',
  markdown: 'Markdown / Text',
  other: 'Other',
};

function detectProvider(url: string): ExternalDocProvider {
  if (url.includes('docs.google.com/document')) return 'google_docs';
  if (url.includes('notion.so')) return 'notion';
  if (url.includes('paper.dropbox.com')) return 'dropbox_paper';
  if (url.includes('office.com') || url.includes('sharepoint.com') || url.includes('onedrive.live.com')) return 'microsoft_word';
  if (url.endsWith('.md') || url.endsWith('.txt')) return 'markdown';
  return 'other';
}

function extractDocumentId(url: string) {
  const google = url.match(/docs\.google\.com\/document\/d\/([^/]+)/)?.[1];
  if (google) return google;
  const publishedGoogle = url.match(/docs\.google\.com\/document\/d\/e\/([^/]+)/)?.[1];
  if (publishedGoogle) return publishedGoogle;
  return undefined;
}

function canvasStyleForWriting(style: WritingStyle): { color: PaperColor; pattern: PaperPattern } {
  switch (style) {
    case 'ruled_notebook':
    case 'manuscript':
      return { color: 'blank', pattern: 'notebook' };
    case 'mind_map':
    case 'timeline':
      return { color: 'blank', pattern: 'grid' };
    case 'cornell_notes':
    case 'two_column_debate':
    case 'dialectic':
    case 'belief_audit':
    case 'source_analysis':
      return { color: 'warm', pattern: 'none' };
    default:
      return { color: 'blank', pattern: 'none' };
  }
}

export function Atelier({ drafts, concepts, writingDefaults, onAddDraft, onUpdateDraft, onDeleteDraft, onAddConcept }: AtelierProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | DraftType | DraftStatus>('all');
  const [workTab, setWorkTab] = useState<WorkTab>('all');
  const [search, setSearch] = useState('');
  const [isWorkTypeOpen, setIsWorkTypeOpen] = useState(false);
  const [isNoteTypeOpen, setIsNoteTypeOpen] = useState(false);
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [docDraft, setDocDraft] = useState({ title: '', url: '', provider: 'google_docs' as ExternalDocProvider, autoSync: true });
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [draftBuffer, setDraftBuffer] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);

  const [viewMode, setViewMode] = useState<PageViewMode>('vertical-continuous');
  const [pageSize, setPageSize] = useState<PageSize>('letter');
  const [paperColor, setPaperColor] = useState<PaperColor>('blank');
  const [paperPattern, setPaperPattern] = useState<PaperPattern>('none');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [writingTool, setWritingTool] = useState<WritingTool>('text');
  const [writingStrokeColor, setWritingStrokeColor] = useState('#4c1d95');
  const [writingStrokeSize, setWritingStrokeSize] = useState(3);

  const { toast } = useToast();
  const activeFromStore = drafts.find((draft) => draft.id === activeId) || null;
  const active = draftBuffer || activeFromStore;
  const activeCategory = active ? active.workCategory || workCategoryForDraft(active.type) : null;

  const visibleDrafts = drafts
    .filter((draft) => {
      const category = draft.workCategory || workCategoryForDraft(draft.type);
      if (workTab !== 'all' && category !== workTab) return false;
      if (filter === 'all') return true;
      return draft.type === filter || draft.status === filter;
    })
    .filter((draft) => !search || draft.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime());

  const updateActive = useCallback((patch: Partial<Draft>) => {
    setDraftBuffer((current) => {
      const base = current || activeFromStore;
      if (!base) return current;
      return { ...base, ...patch, dateUpdated: today() };
    });
    setDirty(true);
    setSaveStatus('unsaved');
  }, [activeFromStore]);

  const saveActive = useCallback((patch?: Partial<Draft>) => {
    if (!active) return null;
    const nextDraft = { ...active, ...patch, dateUpdated: today() };
    setDraftBuffer(nextDraft);
    setSaveStatus('saving');
    onUpdateDraft(nextDraft);
    setDirty(false);
    window.setTimeout(() => setSaveStatus('saved'), 600);
    return nextDraft;
  }, [active, onUpdateDraft]);

  const handleUpdateContent = useCallback((newContent: string) => {
    const clean = sanitizeHtml(newContent);
    if (active?.activeMode === 'final') {
      updateActive({ body: clean, finalContent: clean });
    } else {
      updateActive({ body: clean, draftContent: clean });
    }
  }, [active?.activeMode, updateActive]);

  const exportManuscript = () => {
    if (!active) return;
    const content = `# ${active.title}\n\nType: ${DRAFT_LABELS[active.type]}\nStatus: ${active.status}\nConcepts: ${(active.conceptTags || []).join(', ')}\n\n---\n\n${active.body.replace(/<[^>]+>/g, '\n')}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${active.title.replace(/\s+/g, '_')}_Noesis_Export.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Manuscript Exported', description: 'Your synthesis is ready as a Markdown file.' });
  };

  const spawnDraft = (type: DraftType, title?: string) => {
    const category = workCategoryForDraft(type);
    const baseTitle =
      title ||
      (type === 'recording'
        ? 'Untitled Recording'
        : type === 'drawing' || type === 'drawing_note'
          ? 'Untitled Drawing'
          : type === 'voice_note'
            ? 'Untitled Voice Note'
            : type === 'talk_to_text'
              ? 'Untitled Talk-to-Text'
              : type === 'text_note'
                ? 'Untitled Text Note'
                : 'Untitled Writing');
    const created = onAddDraft({
      title: baseTitle,
      type,
      label: DRAFT_LABELS[type],
      body: '',
      draftContent: '',
      finalContent: '',
      activeMode: 'draft',
      workCategory: category,
      paperType: writingDefaults.writingStyle,
      activeRibbon: type === 'drawing' || type === 'drawing_note' ? 'drawing' : 'writing',
      recordingType: type === 'recording' || type === 'voice_note' ? 'screen' : undefined,
      status: writingDefaults.status,
      writingStyle: writingDefaults.writingStyle,
      conceptTags: [],
      sourceIds: [],
      questionIds: [],
      beliefIds: [],
      dateCreated: today(),
      dateUpdated: today(),
    });
    setIsWorkTypeOpen(false);
    setIsNoteTypeOpen(false);
    setWorkTab(category);
    setFilter('all');
    setActiveId(created.id);
    toast({
      title: `${DRAFT_LABELS[type]} opened`,
      description:
        type === 'recording'
          ? 'The recording studio is ready.'
          : type === 'drawing' || type === 'drawing_note'
            ? 'Your drawing space is ready.'
            : type === 'voice_note'
              ? 'Voice capture is ready.'
              : 'Your new work is ready to develop.',
    });
  };

  const openDocDialog = () => {
    if (!active) return;
    setDocDraft({
      title: active.externalDoc?.title || active.title || '',
      url: active.externalDoc?.url || '',
      provider: active.externalDoc?.provider || 'google_docs',
      autoSync: active.externalDoc?.autoSync ?? true,
    });
    setIsDocOpen(true);
  };

  const connectExternalDoc = () => {
    if (!active || !docDraft.url.trim()) return;
    const url = docDraft.url.trim();
    const provider = docDraft.provider || detectProvider(url);
    updateActive({
      externalDoc: {
        provider,
        title: docDraft.title.trim() || active.title,
        url,
        documentId: extractDocumentId(url),
        autoSync: docDraft.autoSync,
        syncStatus: 'connected',
      },
    });
    setIsDocOpen(false);
  };

  const detachExternalDoc = () => {
    if (!active) return;
    const { externalDoc, ...rest } = active;
    setDraftBuffer(rest);
    setDirty(true);
    setSaveStatus('unsaved');
  };

  const syncExternalDoc = async (draft: Draft) => {
    if (!draft.externalDoc?.url || syncingId === draft.id) return;
    setSyncingId(draft.id);
    updateActive({ externalDoc: { ...draft.externalDoc, syncStatus: 'syncing', syncError: '' } });
    try {
      const response = await fetch('/api/import-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: draft.externalDoc.url, provider: draft.externalDoc.provider }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Document sync failed.');
      const importedBody = escapeTextAsHtml(result.text);
      updateActive({
        body: importedBody,
        ...(draft.activeMode === 'final' ? { finalContent: importedBody } : { draftContent: importedBody }),
        externalDoc: {
          ...draft.externalDoc,
          lastSyncedAt: result.importedAt || today(),
          syncStatus: 'synced',
          syncError: result.truncated ? 'Imported text was truncated to keep the draft responsive.' : '',
        },
      });
    } catch (error) {
      updateActive({
        externalDoc: {
          ...draft.externalDoc,
          syncStatus: 'error',
          syncError: error instanceof Error ? error.message : 'Document sync failed.',
        },
      });
    } finally {
      setSyncingId(null);
    }
  };

  useEffect(() => {
    if (!activeFromStore) {
      setDraftBuffer(null);
      setDirty(false);
      setSaveStatus('saved');
      return;
    }
    setDraftBuffer(activeFromStore);
    setDirty(false);
    setSaveStatus('saved');
  }, [activeFromStore?.id]);

  useEffect(() => {
    const style = active?.writingStyle || writingDefaults.writingStyle;
    const canvas = canvasStyleForWriting(style);
    setPaperColor(canvas.color);
    setPaperPattern(canvas.pattern);
  }, [active?.id, active?.writingStyle, writingDefaults.writingStyle]);

  useEffect(() => {
    if (!dirty || !active) return;
    const timeout = window.setTimeout(() => {
      setSaveStatus('saving');
      onUpdateDraft({ ...active, dateUpdated: today() });
      setDirty(false);
      window.setTimeout(() => setSaveStatus('saved'), 600);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [active, dirty, onUpdateDraft]);

  useEffect(() => {
    if (!active?.externalDoc?.autoSync || active.externalDoc.syncStatus === 'syncing') return;
    const lastSynced = active.externalDoc.lastSyncedAt ? new Date(active.externalDoc.lastSyncedAt).getTime() : 0;
    if (Date.now() - lastSynced > 60_000) void syncExternalDoc(active);
    const interval = window.setInterval(() => {
      const latest = drafts.find((draft) => draft.id === active.id);
      if (latest?.externalDoc?.autoSync) void syncExternalDoc(latest);
    }, 120_000);
    return () => window.clearInterval(interval);
  }, [active?.id, active?.externalDoc?.autoSync]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeContent = active
    ? active.activeMode === 'final'
      ? active.finalContent || ''
      : active.draftContent || active.body || ''
    : '';

  const activeTypeLabel = active ? DRAFT_LABELS[active.type] : '';
  const showPaperControls = !!active && activeCategory === 'writing';
  const showExternalDocControls = !!active && activeCategory === 'writing';

  if (active) {
    return (
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden font-body">
        <header className="px-8 pt-8 pb-4 border-b border-border/30 bg-background/80 backdrop-blur z-50">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveId(null)}
                className="font-code text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <ChevronLeft className="size-4" /> BACK TO WORKS
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-full border border-border/60 bg-white p-1 shadow-sm">
                  {(['draft', 'final'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateActive({ activeMode: mode, body: mode === 'final' ? active.finalContent || '' : active.draftContent || active.body || '' })}
                      className={cn(
                        'rounded-full px-3 py-1 font-code text-[9px] font-bold uppercase tracking-widest transition-colors',
                        (active.activeMode || 'draft') === mode ? 'bg-accent text-white' : 'text-muted-foreground hover:text-primary'
                      )}
                    >
                      {mode === 'draft' ? 'Drafting' : 'Final'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-code text-[9px] uppercase tracking-widest opacity-40 font-bold">STATUS</span>
                  <Select value={active.status} onValueChange={(value) => updateActive({ status: value as DraftStatus })}>
                    <SelectTrigger className="h-8 border-border/40 bg-white shadow-sm font-code text-[9px] uppercase tracking-wider rounded-full w-32 px-3 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s} className="font-code text-[9px] uppercase">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showPaperControls && (
                  <div className="flex items-center gap-3">
                    <span className="font-code text-[9px] uppercase tracking-widest opacity-40 font-bold">PAPER</span>
                    <Select value={active.writingStyle || writingDefaults.writingStyle} onValueChange={(value) => updateActive({ writingStyle: value as WritingStyle })}>
                      <SelectTrigger className="h-8 border-border/40 bg-white shadow-sm font-code text-[9px] uppercase tracking-wider rounded-full w-44 px-3 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WRITING_STYLES.map((style) => (
                          <SelectItem key={style} value={style} className="font-code text-[9px] uppercase">{WRITING_STYLE_LABELS[style]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {showExternalDocControls && (
                  <Button variant="outline" size="sm" onClick={openDocDialog} className="h-9 px-5 rounded-full font-bold shadow-sm bg-white border-border/60">
                    <Link2 className="size-4 mr-2" /> {active.externalDoc ? 'Doc' : 'Connect Doc'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => saveActive()} className="h-9 px-5 rounded-full font-bold shadow-sm bg-white border-border/60">
                  <Save className="size-4 mr-2" /> {dirty ? 'Save*' : 'Save'}
                </Button>
                {activeCategory === 'writing' && (
                  <Button variant="outline" size="sm" onClick={exportManuscript} className="h-9 px-5 rounded-full font-bold shadow-sm bg-white border-border/60">
                    <Download className="size-4 mr-2" /> Export
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => { onDeleteDraft(active.id); setActiveId(null); }} className="h-9 w-9 rounded-full shadow-sm">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Input
                  className="bg-transparent border-none text-4xl font-headline font-bold focus-visible:ring-0 italic p-0 h-auto rounded-none shadow-none text-primary placeholder:text-muted-foreground/20 flex-1"
                  value={active.title}
                  onChange={(event) => updateActive({ title: event.target.value })}
                  placeholder={`Enter ${activeTypeLabel} Title...`}
                />
                <div className="flex items-center gap-3 bg-muted/10 px-4 py-2 rounded-full border border-border/30">
                  <div className={cn('size-2 rounded-full', saveStatus === 'saved' ? 'bg-emerald-500' : saveStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-red-400')} />
                  <span className="font-code text-[9px] uppercase tracking-widest font-bold opacity-60">
                    {saveStatus === 'saved' ? 'Changes Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
                  </span>
                </div>
              </div>

              {showExternalDocControls && active.externalDoc && (
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-code text-[9px] uppercase tracking-widest text-accent font-bold">External Writing Source</div>
                    <p className="font-body text-sm italic text-primary/80">
                      {providerLabels[active.externalDoc.provider]} - {active.externalDoc.title || active.title}
                    </p>
                    <p className="font-code text-[8px] uppercase tracking-widest text-muted-foreground mt-1">
                      {active.externalDoc.lastSyncedAt ? `Last synced ${new Date(active.externalDoc.lastSyncedAt).toLocaleString()}` : 'Not synced yet'}
                      {active.externalDoc.syncError ? ` - ${active.externalDoc.syncError}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => syncExternalDoc(active)} disabled={syncingId === active.id} className="rounded-full bg-white">
                      <RefreshCw className={cn('mr-2 size-4', syncingId === active.id && 'animate-spin')} /> Sync Now
                    </Button>
                    <Button variant="outline" size="sm" asChild className="rounded-full bg-white">
                      <a href={active.externalDoc.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 size-4" /> Open</a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={detachExternalDoc} className="rounded-full text-destructive hover:text-destructive">
                      <Unlink className="mr-2 size-4" /> Detach
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/10">
                <div className="flex items-center gap-4">
                  <span className="font-code text-[10px] uppercase tracking-widest opacity-40 font-bold">CONCEPTS</span>
                  <ConceptTagPicker
                    concepts={concepts}
                    value={active.conceptTags || []}
                    onChange={(tags) => updateActive({ conceptTags: normalizeConceptTags(tags) })}
                    onCreateConcept={(name) => onAddConcept({ name, description: '', createdFrom: 'tag' })}
                    compact
                  />
                </div>

                {showPaperControls && (
                  <PageViewControls
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    paperColor={paperColor}
                    onPaperColorChange={setPaperColor}
                    paperPattern={paperPattern}
                    onPaperPatternChange={setPaperPattern}
                  />
                )}
              </div>
              {showPaperControls && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/30 bg-white/70 px-4 py-3">
                  <span className="font-code text-[9px] uppercase tracking-widest opacity-40 font-bold">PENCIL</span>
                  <Button variant={writingTool === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setWritingTool('text')} className="rounded-full">
                    <Type className="mr-2 size-4" /> Type
                  </Button>
                  <Button variant={writingTool === 'pencil' ? 'default' : 'outline'} size="sm" onClick={() => setWritingTool('pencil')} className="rounded-full">
                    <PencilLine className="mr-2 size-4" /> Pencil
                  </Button>
                  <Button variant={writingTool === 'eraser' ? 'default' : 'outline'} size="sm" onClick={() => setWritingTool('eraser')} className="rounded-full">
                    <Eraser className="mr-2 size-4" /> Erase
                  </Button>
                  <input type="color" value={writingStrokeColor} onChange={(event) => setWritingStrokeColor(event.target.value)} className="h-9 w-11 rounded border border-border bg-background p-1" aria-label="Pencil color" />
                  <input type="range" min={1} max={14} value={writingStrokeSize} onChange={(event) => setWritingStrokeSize(Number(event.target.value))} className="w-28" aria-label="Pencil size" />
                  <Button variant="outline" size="sm" onClick={() => updateActive({ writingOverlayData: '' })} className="rounded-full bg-white">
                    <Square className="mr-2 size-4" /> Clear Marks
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {activeCategory === 'writing' ? (
            <>
              <FormattingToolbar saveStatus={saveStatus} />
              <DocumentCanvas
                content={activeContent}
                onContentChange={handleUpdateContent}
                viewMode={viewMode}
                pageSize={pageSize}
                paperColor={paperColor}
                paperPattern={paperPattern}
                writingStyle={active.writingStyle || writingDefaults.writingStyle}
                title={active.title}
                overlayData={active.writingOverlayData || ''}
                onOverlayChange={(overlayData) => updateActive({ writingOverlayData: overlayData })}
                overlayTool={writingTool}
                overlayColor={writingStrokeColor}
                overlayBrushSize={writingStrokeSize}
              />
            </>
          ) : active.type === 'recording' ? (
            <RecordingStudio draft={active} updateActive={updateActive} />
          ) : active.type === 'voice_note' ? (
            <RecordingStudio draft={active} updateActive={updateActive} audioOnly />
          ) : active.type === 'drawing' ? (
            <DrawingStudio draft={active} updateActive={updateActive} />
          ) : active.type === 'drawing_note' ? (
            <DrawingStudio draft={active} updateActive={updateActive} compact />
          ) : (
            <QuickNoteStudio draft={active} updateActive={updateActive} />
          )}
        </div>

        {showExternalDocControls && (
          <ExternalDocDialog
            open={isDocOpen}
            onOpenChange={setIsDocOpen}
            docDraft={docDraft}
            setDocDraft={setDocDraft}
            onConnect={connectExternalDoc}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 pt-8 max-w-7xl mx-auto w-full font-body">
      <header className="flex justify-between items-start mb-12">
        <div>
          <h1 className="text-[28px] font-headline font-semibold italic text-foreground/80">Works</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Develop essays, scripts, field notes, and longer pieces from the ideas gathered across Noesis.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search works..."
              className="w-72 pl-9 h-9 rounded-full"
            />
          </div>
          <Button onClick={() => setIsWorkTypeOpen(true)} size="sm" className="h-9 px-6 font-code text-[10px] tracking-widest rounded-full uppercase font-bold shadow-sm shadow-accent/20">
            <Plus className="mr-2 size-4" /> Add Work
          </Button>
        </div>
      </header>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2.5">
          {workTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setWorkTab(tab); setFilter('all'); }}
              className={cn(
                'px-6 py-2.5 rounded-full text-[10px] font-code font-bold uppercase tracking-[0.16em] transition-all shadow-sm',
                workTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted/5'
              )}
            >
              {tab === 'all' ? 'All' : WORK_CATEGORY_LABELS[tab]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {(['all', 'drafting', 'final'] as const).map((val) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={cn(
                'px-5 py-2 rounded-full text-[10px] font-code font-bold uppercase tracking-[0.16em] transition-all shadow-sm',
                filter === val
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted/5'
              )}
            >
              {val === 'all' ? 'ALL' : val.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {visibleDrafts.map((draft) => (
          <Card
            key={draft.id}
            className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-accent/20 bg-white/95 p-6 rounded-xl shadow-md relative"
            onClick={() => setActiveId(draft.id)}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="font-code text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">
                {DRAFT_LABELS[draft.type]}
              </span>
              <div className="flex items-center gap-2">
              {draft.externalDoc && <Cloud className="size-3.5 text-accent" />}
                <Badge variant="outline" className="font-code text-[8px] uppercase tracking-tighter bg-white shadow-sm border-border/60 rounded-full font-bold px-2 py-0.5">
                  {draft.status}
                </Badge>
              </div>
            </div>

            <h3 className="font-headline text-2xl font-bold italic leading-tight group-hover:text-accent transition-colors text-primary mb-6">
              {draft.title || 'Untitled Draft'}
            </h3>

            <div className="flex flex-wrap gap-1.5 mb-6">
              <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-accent/10 text-accent border-transparent rounded-full font-bold">
                {DRAFT_LABELS[draft.type]}
              </Badge>
              {(draft.workCategory || workCategoryForDraft(draft.type)) === 'writing' && (
                <Badge variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/60 rounded-full font-bold">
                  {WRITING_STYLE_LABELS[draft.writingStyle || writingDefaults.writingStyle]}
                </Badge>
              )}
              {(draft.conceptTags || []).slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="font-code text-[8px] uppercase tracking-widest bg-muted/20 border-transparent text-muted-foreground/60 rounded-full font-bold">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-border/20">
              <div className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/40 font-bold">
                {draft.type === 'recording' || draft.type === 'voice_note'
                  ? `${Math.max(0, draft.durationSeconds || 0)} SEC`
                  : draft.type === 'drawing' || draft.type === 'drawing_note'
                    ? (draft.canvasData ? 'CANVAS SAVED' : 'BLANK CANVAS')
                    : `${draft.body.split(/\s+/).filter(Boolean).length} WORDS`}
              </div>
              <time className="font-code text-[8px] uppercase tracking-widest text-muted-foreground/20 font-bold">
                {new Date(draft.dateUpdated).toLocaleDateString()}
              </time>
            </div>
          </Card>
        ))}

        <Card
          className="aspect-video rounded-xl border-2 border-dashed border-border/50 bg-white/50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white transition-all group shadow-sm hover:shadow-xl hover:-translate-y-1"
          onClick={() => setIsWorkTypeOpen(true)}
        >
          <div className="size-12 rounded-full bg-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md border border-border/30">
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <div className="readex-kicker text-muted-foreground font-bold text-[10px]">CREATE WORK</div>
        </Card>
      </div>

      <Dialog open={isWorkTypeOpen} onOpenChange={setIsWorkTypeOpen}>
        <DialogContent className="max-w-2xl border-none bg-white shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-3xl italic">Add Work</DialogTitle>
            <p className="text-sm italic text-muted-foreground">Choose the workspace you want to open right now.</p>
          </DialogHeader>
          <div className="grid gap-4 pt-4 sm:grid-cols-2">
            {[
              { title: 'Writing', description: 'Open a long-form writing document.', icon: PencilLine, onClick: () => spawnDraft('essay', 'Untitled Writing') },
              { title: 'Note', description: 'Choose a quick written, voice, or drawing note.', icon: NotebookPen, onClick: () => { setIsWorkTypeOpen(false); setIsNoteTypeOpen(true); } },
              { title: 'Recording', description: 'Open the video recording studio with camera and microphone.', icon: Camera, onClick: () => spawnDraft('recording') },
              { title: 'Drawing', description: 'Open a full visual thinking canvas.', icon: PenTool, onClick: () => spawnDraft('drawing') },
            ].map((option) => (
              <button
                key={option.title}
                onClick={option.onClick}
                className="rounded-full border border-border/60 bg-card px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-accent">
                    <option.icon className="size-5" />
                  </div>
                  <div>
                    <div className="font-headline text-2xl font-bold italic text-primary">{option.title}</div>
                    <p className="mt-1 text-sm italic leading-5 text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoteTypeOpen} onOpenChange={setIsNoteTypeOpen}>
        <DialogContent className="max-w-xl border-none bg-white shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-3xl italic">Choose Note Type</DialogTitle>
            <p className="text-sm italic text-muted-foreground">Notes can start as voice, drawing, or text and stay lightweight.</p>
          </DialogHeader>
          <div className="grid gap-3 pt-4">
            {[
              { title: 'Voice Note', description: 'Capture a spoken thought.', type: 'voice_note' as DraftType },
              { title: 'Talk-to-Text', description: 'Dictate a note and refine the transcript.', type: 'talk_to_text' as DraftType },
              { title: 'Drawing Note', description: 'Sketch an idea or diagram.', type: 'drawing_note' as DraftType },
              { title: 'Text Note', description: 'Write a quick definition, fragment, or observation.', type: 'text_note' as DraftType },
            ].map((option) => (
              <button
                key={option.title}
                onClick={() => spawnDraft(option.type, `Untitled ${option.title}`)}
                className="rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="font-headline text-xl font-bold italic text-primary">{option.title}</div>
                <p className="mt-1 text-sm italic leading-5 text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickNoteStudio({
  draft,
  updateActive,
}: {
  draft: Draft;
  updateActive: (patch: Partial<Draft>) => void;
}) {
  const recognitionRef = useRef<InstanceType<BrowserSpeechRecognitionCtor> | null>(null);
  const [dictationState, setDictationState] = useState<'idle' | 'listening' | 'unsupported' | 'error'>('idle');
  const [dictationError, setDictationError] = useState('');
  const isTalkToText = draft.type === 'talk_to_text';

  const startDictation = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionCtor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
    };
    const RecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setDictationState('unsupported');
      setDictationError('Speech-to-text is not supported in this browser.');
      return;
    }
    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      updateActive({
        body: transcript,
        draftContent: transcript,
      });
    };
    recognition.onerror = (event) => {
      setDictationState('error');
      setDictationError(event.error || 'Dictation could not continue.');
    };
    recognition.onend = () => setDictationState((current) => (current === 'error' ? current : 'idle'));
    recognitionRef.current = recognition;
    setDictationError('');
    setDictationState('listening');
    recognition.start();
  };

  const stopDictation = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setDictationState('idle');
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-8">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-accent">
            {draft.type === 'talk_to_text' ? <Mic className="size-5" /> : <Type className="size-5" />}
          </div>
          <div>
            <h2 className="font-headline text-2xl font-bold italic">
              {draft.type === 'talk_to_text' ? 'Talk-to-Text Note' : 'Quick Written Note'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {draft.type === 'talk_to_text'
                ? 'Dictate a thought, then clean it up without leaving Works.'
                : 'Fast capture for fragments, definitions, observations, and quick reflections.'}
            </p>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
        {isTalkToText && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
            <div>
              <p className="font-code text-[10px] font-bold uppercase tracking-widest text-accent">Dictation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dictationState === 'listening'
                  ? 'Listening now. Your transcript will update in the note body.'
                  : dictationState === 'unsupported'
                    ? 'Browser speech recognition is unavailable here.'
                    : 'Start dictation to capture a spoken draft, then refine it as text.'}
              </p>
              {dictationError && <p className="mt-1 text-sm text-destructive">{dictationError}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={startDictation} disabled={dictationState === 'listening'} className="rounded-full">
                <Mic className="mr-2 size-4" /> Start Dictation
              </Button>
              <Button onClick={stopDictation} disabled={dictationState !== 'listening'} variant="outline" className="rounded-full bg-background">
                Stop
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <Label className="readex-kicker text-[9px] font-bold uppercase">Note Body</Label>
          <textarea
            value={draft.body || ''}
            onChange={(event) => updateActive({ body: event.target.value, draftContent: event.target.value })}
            placeholder={isTalkToText ? 'Your dictated transcript will appear here. You can also type and revise it manually.' : 'Write the note you want to capture...'}
            className="min-h-[340px] w-full rounded-2xl border border-border bg-background px-4 py-4 text-base leading-7 text-foreground outline-none transition-colors focus:border-accent"
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-xs italic text-muted-foreground">
            Notes stay lightweight. You can still link concepts and reopen them later from Works.
          </p>
        </div>
      </Card>
    </div>
  );
}

function RecordingStudio({
  draft,
  updateActive,
  audioOnly = false,
}: {
  draft: Draft;
  updateActive: (patch: Partial<Draft>) => void;
  audioOnly?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [state, setState] = useState<'idle' | 'requesting' | 'ready' | 'recording' | 'stopped' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(draft.durationSeconds || 0);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (draft.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.fileUrl);
    };
  }, [draft.fileUrl]);

  useEffect(() => {
    let timer: number | undefined;
    if (state === 'recording') {
      timer = window.setInterval(() => setDuration((current) => current + 1), 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [state]);

  const requestMedia = async () => {
    setState('requesting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: audioOnly ? false : true,
        audio: true,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      setState('ready');
    } catch (err) {
      setState('error');
      setError(audioOnly ? 'Microphone access was denied. Please allow permission to record voice notes.' : 'Camera or microphone access was denied. Please allow permission to record video.');
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    try {
      chunksRef.current = [];
      const mimeType = audioOnly
        ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '')
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm');
      const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setState('saving');
        const blob = new Blob(chunksRef.current, { type: audioOnly ? 'audio/webm' : 'video/webm' });
        const fileUrl = await blobToDataUrl(blob);
        updateActive({
          fileUrl,
          durationSeconds: duration,
        });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (previewRef.current) {
          previewRef.current.src = fileUrl;
        }
        setState('stopped');
      };
      setDuration(0);
      recorder.start();
      setState('recording');
    } catch (err) {
      setState('error');
      setError(audioOnly ? 'Your browser does not support audio recording.' : 'Your browser does not support video recording.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setState('stopped');
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto p-8">
      <Card className="rounded-2xl border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-accent">
              {audioOnly ? <Mic className="size-5" /> : <Video className="size-5" />}
            </div>
            <div>
              <h2 className="font-headline text-2xl font-bold italic">{audioOnly ? 'Quick Voice Note' : 'Recording Studio'}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {audioOnly ? 'Capture an audio-only note without opening the full writing editor.' : 'Record video with camera and microphone, then save it back into Works.'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full font-code text-[8px] uppercase tracking-widest">
            {state}
          </Badge>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          {!audioOnly ? (
            <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-black">
              {draft.fileUrl && (state === 'saved' || state === 'stopped') ? (
                <video ref={previewRef} src={draft.fileUrl} controls className="h-full w-full object-contain" />
              ) : (
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              )}
            </div>
          ) : (
            <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-border bg-background">
              {draft.fileUrl && (state === 'saved' || state === 'stopped') ? (
                <audio controls src={draft.fileUrl} className="w-full max-w-md" />
              ) : (
                <div className="text-center">
                  <Mic className="mx-auto size-10 text-accent" />
                  <p className="mt-3 text-sm text-muted-foreground">Microphone preview is ready once permission is granted.</p>
                </div>
              )}
            </div>
          )}
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </Card>

        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <div className="font-code text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recorder Status</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>{audioOnly ? 'Use this for fast audio capture inside Notes.' : 'Use this for camera + microphone recordings inside Works.'}</p>
            <p>Duration: <span className="font-code text-foreground">{duration}s</span></p>
            <p>{state === 'idle' && 'Waiting for permission.'}</p>
            <p>{state === 'ready' && 'Camera and microphone are ready.'}</p>
            <p>{state === 'recording' && 'Recording is in progress.'}</p>
            <p>{state === 'saving' && 'Preparing recorded media...'}</p>
            <p>{state === 'stopped' && 'Recording is staged. Use the top Save button to persist it.'}</p>
            <p>{state === 'saved' && 'Recording saved. You can reopen it later from Works.'}</p>
          </div>
          <div className="mt-6 space-y-2">
            <Label className="readex-kicker text-[9px] font-bold uppercase">Recording Notes</Label>
            <textarea
              value={draft.body || ''}
              onChange={(event) => updateActive({ body: event.target.value, draftContent: event.target.value })}
              placeholder={audioOnly ? 'Add a short summary or transcript note...' : 'Add context, notes, or a summary for this recording...'}
              className="min-h-[160px] w-full rounded-2xl border border-border bg-background px-4 py-4 text-sm leading-6 text-foreground outline-none transition-colors focus:border-accent"
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={requestMedia} variant="outline" className="rounded-full bg-background">
              <Camera className="mr-2 size-4" /> {audioOnly ? 'Enable Microphone' : 'Enable Camera'}
            </Button>
            <Button onClick={startRecording} disabled={state !== 'ready'} className="rounded-full">
              <Video className="mr-2 size-4" /> Start Recording
            </Button>
            <Button onClick={stopRecording} disabled={state !== 'recording'} variant="outline" className="rounded-full bg-background">
              Stop Recording
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DrawingStudio({
  draft,
  updateActive,
  compact = false,
}: {
  draft: Draft;
  updateActive: (patch: Partial<Draft>) => void;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#1f2937');
  const [brushSize, setBrushSize] = useState(4);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    setHistory((prev) => {
      const next = [...prev.slice(0, historyIndex + 1), data];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = compact ? 720 : 1120;
    const height = compact ? 420 : 680;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    if (draft.canvasData) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, width, height);
      image.src = draft.canvasData;
    } else {
      snapshot();
    }
  }, [compact, draft.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const point = getPoint(event);
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    snapshot();
    window.setTimeout(saveDrawing, 0);
  };

  const restoreHistory = (index: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !history[index]) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, parseInt(canvas.style.width, 10), parseInt(canvas.style.height, 10));
      window.setTimeout(saveDrawing, 0);
    };
    image.src = history[index];
    setHistoryIndex(index);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, parseInt(canvas.style.width, 10), parseInt(canvas.style.height, 10));
    snapshot();
    window.setTimeout(saveDrawing, 0);
  };

  const saveDrawing = () => {
    const data = canvasRef.current?.toDataURL('image/png');
    if (!data) return;
    updateActive({ canvasData: data, thumbnailUrl: data });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 overflow-y-auto p-8">
      <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl font-bold italic">{compact ? 'Quick Drawing Note' : 'Drawing Studio'}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {compact ? 'A lightweight sketch space for capturing visual ideas fast.' : 'A full visual thinking workspace for diagrams, sketches, and concept maps.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={tool === 'pen' ? 'default' : 'outline'} onClick={() => setTool('pen')} className="rounded-full">
              <PenTool className="mr-2 size-4" /> Pen
            </Button>
            <Button variant={tool === 'eraser' ? 'default' : 'outline'} onClick={() => setTool('eraser')} className="rounded-full">
              <Eraser className="mr-2 size-4" /> Eraser
            </Button>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-12 rounded border border-border bg-background p-1" />
            <input type="range" min={1} max={24} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="w-28" />
            <Button variant="outline" onClick={() => restoreHistory(Math.max(0, historyIndex - 1))} disabled={historyIndex <= 0} className="rounded-full bg-background">
              <Undo2 className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => restoreHistory(Math.min(history.length - 1, historyIndex + 1))} disabled={historyIndex >= history.length - 1} className="rounded-full bg-background">
              <Redo2 className="size-4" />
            </Button>
            <Button variant="outline" onClick={clearCanvas} className="rounded-full bg-background">
              <Square className="mr-2 size-4" /> Clear
            </Button>
          </div>
        </div>
      </Card>

      <div className={cn("grid gap-6", compact ? "xl:grid-cols-[1fr_320px]" : "xl:grid-cols-[1fr_360px]")}>
        <div className="overflow-auto rounded-2xl border border-border bg-muted/10 p-4">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              drawingRef.current = false;
            }}
            className="mx-auto block rounded-xl border border-border bg-white shadow-sm touch-none"
          />
        </div>
        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <div className="font-code text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Drawing Notes</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {compact ? 'Keep this quick. Use text for labels, context, or one sharp takeaway.' : 'Use text for labels, context, explanation, or the argument behind the sketch.'}
          </p>
          <textarea
            value={draft.body || ''}
            onChange={(event) => updateActive({ body: event.target.value, draftContent: event.target.value })}
            placeholder={compact ? 'Add a short note for this sketch...' : 'Explain the diagram, map the idea, or write the reasoning behind the drawing...'}
            className={cn(
              "mt-4 w-full rounded-2xl border border-border bg-background px-4 py-4 text-sm leading-6 text-foreground outline-none transition-colors focus:border-accent",
              compact ? "min-h-[220px]" : "min-h-[420px]"
            )}
          />
        </Card>
      </div>
    </div>
  );
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function PaperPreview({ styleName }: { styleName: WritingStyle }) {
  return (
    <div className={cn(
      'relative h-24 overflow-hidden rounded-lg border border-border/50 bg-white',
      styleName === 'ruled_notebook' && 'bg-[linear-gradient(#e7dfd5_1px,transparent_1px)] bg-[length:100%_16px]',
      styleName === 'manuscript' && 'bg-[linear-gradient(#ece4da_1px,transparent_1px)] bg-[length:100%_22px]',
      styleName === 'cornell_notes' && 'after:absolute after:left-1/3 after:top-0 after:bottom-5 after:w-px after:bg-accent/30 before:absolute before:left-0 before:right-0 before:bottom-5 before:h-px before:bg-accent/30',
      styleName === 'two_column_debate' && 'after:absolute after:left-1/2 after:top-2 after:bottom-2 after:w-px after:bg-accent/30',
      styleName === 'dialectic' && 'bg-[linear-gradient(#e7dfd5_1px,transparent_1px)] bg-[length:100%_32%]',
      styleName === 'belief_audit' && 'after:absolute after:inset-3 after:rounded after:border after:border-dashed after:border-accent/30',
      styleName === 'source_analysis' && 'bg-[linear-gradient(#ece4da_1px,transparent_1px)] bg-[length:100%_33%]',
      styleName === 'mind_map' && 'after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-accent/40 before:absolute before:left-1/2 before:top-1/2 before:size-20 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-dashed before:border-accent/20',
      styleName === 'timeline' && 'before:absolute before:left-4 before:right-4 before:top-1/2 before:h-px before:bg-accent/40 after:absolute after:left-6 after:top-1/2 after:size-2 after:-translate-y-1/2 after:rounded-full after:bg-accent/50 after:shadow-[40px_0_0_hsl(var(--accent)/0.45),80px_0_0_hsl(var(--accent)/0.35)]'
    )}>
      <div className="absolute left-4 right-4 top-4 space-y-2 opacity-35">
        <div className="h-1.5 w-2/3 rounded bg-primary/30" />
        <div className="h-1 w-full rounded bg-primary/20" />
        <div className="h-1 w-3/4 rounded bg-primary/20" />
      </div>
    </div>
  );
}

function ExternalDocDialog({
  open,
  onOpenChange,
  docDraft,
  setDocDraft,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docDraft: { title: string; url: string; provider: ExternalDocProvider; autoSync: boolean };
  setDocDraft: React.Dispatch<React.SetStateAction<{ title: string; url: string; provider: ExternalDocProvider; autoSync: boolean }>>;
  onConnect: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-none shadow-2xl rounded-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="font-headline text-3xl italic">Connect External Document</DialogTitle>
          <p className="text-sm text-muted-foreground">Write in your preferred platform and let Noesis keep a synced copy when the document exposes readable text.</p>
        </DialogHeader>
        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">Platform</Label>
            <Select value={docDraft.provider} onValueChange={(value) => setDocDraft((prev) => ({ ...prev, provider: value as ExternalDocProvider }))}>
              <SelectTrigger className="h-11 rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(providerLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">Document Name</Label>
            <Input value={docDraft.title} onChange={(event) => setDocDraft((prev) => ({ ...prev, title: event.target.value }))} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">Document URL</Label>
            <Input
              value={docDraft.url}
              onChange={(event) => {
                const url = event.target.value;
                setDocDraft((prev) => ({ ...prev, url, provider: detectProvider(url) }));
              }}
              placeholder="Paste a Google Doc, Notion, Word, Markdown, or text link..."
              className="h-11"
            />
            <p className="text-xs text-muted-foreground italic">Auto-import works best with published Google Docs, public Markdown/text files, or pages that expose readable text.</p>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/10 p-4">
            <input type="checkbox" checked={docDraft.autoSync} onChange={(event) => setDocDraft((prev) => ({ ...prev, autoSync: event.target.checked }))} className="size-4 accent-accent" />
            <span className="text-sm font-body">Auto-sync while this draft is open</span>
          </label>
        </div>
        <DialogFooter className="pt-6 gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={onConnect} disabled={!docDraft.url.trim()} className="rounded-full bg-accent px-8">Connect Document</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
