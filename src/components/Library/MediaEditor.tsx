'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, FileText, Globe, Link2, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { buildCatalogSummary, sourceResultToMediaPatch, type NormalizedSourceResult } from '@/lib/source-intake';
import { MEDIA_ICONS_COMP, MEDIA_LABELS, MEDIA_STATUS_LABELS, MEDIA_TYPES, conceptKey, normalizeConceptTags } from '@/lib/readex';
import { cn } from '@/lib/utils';
import { noesisUserError } from '@/lib/user-facing-errors';
import type { Media, MediaStatus, MediaType } from '@/lib/types';

const statuses: MediaStatus[] = ['Want to Read', 'Consuming', 'Finished', 'Paused', 'Abandoned'];

const TYPE_TERMINOLOGY: Record<MediaType, { creator: string; publisher: string; genre: string; identifier: string }> = {
  book: { creator: 'Author', publisher: 'Publisher', genre: 'Genre', identifier: 'ISBN' },
  audiobook: { creator: 'Author/Narrator', publisher: 'Publisher', genre: 'Genre', identifier: 'ISBN' },
  podcast: { creator: 'Host', publisher: 'Platform', genre: 'Topic', identifier: 'Feed URL' },
  video: { creator: 'Creator/Channel', publisher: 'Platform', genre: 'Topic', identifier: 'Video URL' },
  movie: { creator: 'Director', publisher: 'Studio', genre: 'Genre', identifier: 'IMDb ID' },
  article: { creator: 'Author', publisher: 'Publication', genre: 'Topic', identifier: 'Article URL' },
  course: { creator: 'Instructor', publisher: 'Institution', genre: 'Subject', identifier: 'Course URL' },
  lecture: { creator: 'Speaker', publisher: 'Institution', genre: 'Subject', identifier: 'Event/URL' },
  documentary: { creator: 'Director', publisher: 'Production', genre: 'Subject', identifier: 'IMDb ID' },
  interview: { creator: 'Participants', publisher: 'Host/Event', genre: 'Topic', identifier: 'URL' },
  conversation: { creator: 'Participants', publisher: 'Context', genre: 'Topic', identifier: 'Date/URL' },
  paper: { creator: 'Authors', publisher: 'Journal/Conference', genre: 'Field of Study', identifier: 'DOI' },
  other: { creator: 'Creator', publisher: 'Publisher', genre: 'Genre', identifier: 'Identifier' },
};

export function MediaEditor({ open, onOpenChange, draft, setDraft, onSave, saving = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Partial<Media>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Media>>>;
  onSave: () => void;
  saving?: boolean;
}) {
  const { toast } = useToast();
  const [tagInput, setTagInput] = useState('');
  const [locatorQuery, setLocatorQuery] = useState('');
  const [locatorResults, setLocatorResults] = useState<NormalizedSourceResult[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locatorError, setLocatorError] = useState('');
  const [completedLocatorQuery, setCompletedLocatorQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  const [importUrl, setImportUrl] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const terms = TYPE_TERMINOLOGY[draft.type || 'book'];

  const isDigital = ['video', 'podcast', 'article', 'course', 'lecture', 'documentary', 'interview', 'conversation', 'other'].includes(draft.type || 'book');
  const isPaper = draft.type === 'paper';

  const showSearch = true;
  const showImport = isDigital || isPaper || ['book', 'audiobook', 'movie'].includes(draft.type || 'book');

  useEffect(() => {
    const query = locatorQuery.trim();
    if (query.length < 3) {
      setLocatorResults([]);
      setCompletedLocatorQuery('');
      setLocatorError('');
      setShowDropdown(false);
      setIsLocating(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLocating(true);
      setLocatorError('');
      try {
        const response = await authenticatedFetch(`/api/source-search?query=${encodeURIComponent(query)}&type=${draft.type || 'book'}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Source search is unavailable.');
        if (controller.signal.aborted) return;
        setLocatorResults(Array.isArray(data.results) ? data.results : []);
        setCompletedLocatorQuery(query);
        setShowDropdown(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLocatorResults([]);
        setCompletedLocatorQuery(query);
        setLocatorError(noesisUserError(error, 'Source search is unavailable. You can still enter the source manually or import its URL.'));
        setShowDropdown(true);
      } finally {
        if (!controller.signal.aborted) setIsLocating(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft.type, locatorQuery]);

  const handleImportUrl = useCallback(async () => {
    if (!importUrl.trim() || importRequest.current) return;
    const controller = new AbortController();
    importRequest.current = controller;
    setIsImporting(true);
    try {
      const response = await authenticatedFetch('/api/source-metadata', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim(), type: draft.type || 'article' }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (data.result) {
        const patch = sourceResultToMediaPatch(data.result);
        setDraft((prev) => ({
          ...prev,
          ...patch,
          tags: normalizeConceptTags([...(prev.tags || []), ...(patch.tags || [])]),
        }));
        setImportUrl('');
        const filled = [patch.title, patch.creator, patch.description, patch.thumbnailUrl].filter(Boolean).length;
        toast({
          title: "Link Imported",
          description: filled >= 3
            ? "Title, creator, description, and available artwork were filled from the source."
            : "Available source details were filled. Review any fields the provider did not publish.",
        });
      } else {
        throw new Error(data.error || "Could not read metadata from URL.");
      }
    } catch (error: any) {
      if (controller.signal.aborted) return;
      toast({ variant: "destructive", title: "Import Failed", description: noesisUserError(error, "Noesis could not archive this URL automatically.") });
    } finally {
      importRequest.current = null;
      if (!controller.signal.aborted) setIsImporting(false);
    }
  }, [draft.type, importUrl, setDraft, toast]);

  const addTag = () => {
    if (!tagInput.trim()) return;
    const next = normalizeConceptTags([...(draft.tags || []), tagInput]);
    setDraft(prev => ({ ...prev, tags: next }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const next = (draft.tags || []).filter(t => conceptKey(t) !== conceptKey(tag));
    setDraft(prev => ({ ...prev, tags: normalizeConceptTags(next) }));
  };

  const selectLocatedSource = (item: NormalizedSourceResult) => {
    const patch = sourceResultToMediaPatch(item);
    setDraft(prev => ({
      ...prev,
      ...patch,
    }));
    setLocatorResults([]);
    setShowDropdown(false);
    setLocatorQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl overflow-hidden rounded-lg border-none bg-card p-0 font-body shadow-2xl sm:rounded-2xl">
        <ScrollArea className="max-h-[calc(100dvh-9rem)] sm:max-h-[85vh]">
          <div className="p-4 sm:p-8">
            <DialogHeader className="mb-5 sm:mb-8">
              <DialogTitle className="mb-1 text-2xl font-headline italic sm:mb-2 sm:text-4xl">
                {draft.id ? 'Edit Source' : 'Add to Library'}
              </DialogTitle>
              <DialogDescription className="text-sm font-body italic text-muted-foreground">
                {draft.id ? `Update this ${MEDIA_LABELS[draft.type || 'book']}.` : `Archive a ${MEDIA_LABELS[draft.type || 'book']}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 sm:space-y-8">
              {!draft.id && (
                <>
                  {showSearch && (
                    <section className="rounded-lg border border-dashed border-border/60 bg-muted/5 p-4 sm:rounded-xl sm:p-5">
                      <Label className="readex-kicker block mb-4 font-bold text-[10px] text-accent flex items-center gap-2">
                        <Globe className="size-3" /> INTELLECTUAL LOCATOR
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
                        <Input
                          placeholder={`Search ${MEDIA_LABELS[draft.type || 'book']} locator...`}
                          value={locatorQuery}
                          onChange={(e) => setLocatorQuery(e.target.value)}
                          className="h-11 rounded-md bg-card pl-9 text-sm italic sm:rounded-full"
                        />
                        {isLocating && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 size-4 animate-spin text-accent" />}
                      </div>
                      {showDropdown && (
                        <div className="mt-4 space-y-2 border-t border-border/20 pt-4 animate-fade-in-up" aria-live="polite">
                          {locatorResults.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => selectLocatedSource(item)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-card hover:shadow-md transition-all text-left group border border-transparent hover:border-border/40"
                            >
                              <div className="size-12 bg-muted/20 rounded shrink-0 overflow-hidden border border-border/20 flex items-center justify-center">
                                {item.thumbnailUrl ? (
                                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Globe className="size-5 text-muted-foreground/30" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-headline font-bold italic truncate group-hover:text-accent">{item.title}</div>
                                <div className="text-[10px] text-muted-foreground truncate uppercase font-code tracking-tighter">{item.creators.join(', ')} {item.year && `(${item.year})`}</div>
                                <div className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{item.catalogSummary || buildCatalogSummary(item.description) || 'No provider description available.'}</div>
                                <div className="mt-1 font-code text-[8px] uppercase tracking-wider text-muted-foreground/70">{item.provider.replace(/_/g, ' ')} · {MEDIA_LABELS[item.type]}</div>
                              </div>
                              <Check className="size-3.5 opacity-0 group-hover:opacity-100 text-accent" />
                            </button>
                          ))}
                          {!locatorResults.length && !locatorError && completedLocatorQuery && (
                            <p className="px-2 py-4 text-sm leading-6 text-muted-foreground">No provider match for “{completedLocatorQuery}.” Try the title with a creator name, paste a URL, or enter the source manually.</p>
                          )}
                          {locatorError && <p className="px-2 py-4 text-sm leading-6 text-destructive">{locatorError}</p>}
                        </div>
                      )}
                    </section>
                  )}

                  {showImport && (
                    <section className="rounded-lg border border-dashed border-border/60 bg-muted/5 p-4 sm:rounded-xl sm:p-5">
                      <Label className="readex-kicker block mb-4 font-bold text-[10px] text-accent flex items-center gap-2">
                        <Link2 className="size-3" /> PASTE URL
                      </Label>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Input
                          placeholder="Paste a YouTube, article, podcast, or other public URL..."
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          className="h-11 rounded-md bg-card text-sm italic sm:rounded-full"
                        />
                        <Button variant="outline" onClick={handleImportUrl} disabled={isImporting || !importUrl.trim()} className="h-11 w-full rounded-md px-6 font-bold sm:w-auto sm:rounded-full">
                          {isImporting ? <Loader2 className="size-4 animate-spin" /> : 'IMPORT'}
                        </Button>
                      </div>
                    </section>
                  )}
                </>
              )}

              <section>
                <Label className="readex-kicker block mb-4 font-bold text-[10px]">MEDIA TYPE</Label>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {MEDIA_TYPES.map((type) => {
                    const Icon = MEDIA_ICONS_COMP[type];
                    const isActive = draft.type === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setDraft(prev => ({ ...prev, type }))}
                        className={cn(
                          "flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-center font-code text-[9px] font-bold uppercase tracking-widest shadow-sm transition-all sm:min-h-0 sm:justify-start sm:rounded-full sm:px-4",
                          isActive
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-card text-muted-foreground border-border/60 hover:border-accent hover:text-accent"
                        )}
                      >
                        <Icon className="size-3.5" />
                        {MEDIA_LABELS[type]}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">SOURCE TITLE</Label>
                  <Input
                    aria-label="Source title"
                    value={draft.title || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
                    className="h-11 text-base italic"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.creator.toUpperCase()}</Label>
                  <Input
                    aria-label={terms.creator}
                    value={draft.creator || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, creator: e.target.value }))}
                    className="h-11 text-base italic"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">YEAR</Label>
                    <Input
                      aria-label="Year"
                      value={draft.year || ''}
                      onChange={(e) => setDraft(prev => ({ ...prev, year: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.genre.toUpperCase()}</Label>
                    <Input
                      aria-label={terms.genre}
                      value={draft.genre || ''}
                      onChange={(e) => setDraft(prev => ({ ...prev, genre: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.publisher.toUpperCase()}</Label>
                  <Input
                    aria-label={terms.publisher}
                    value={draft.publisher || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, publisher: e.target.value }))}
                    className="h-11 text-base"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">{terms.identifier.toUpperCase()}</Label>
                    <Input
                      aria-label={terms.identifier}
                      value={draft.isbn || draft.doi || ''}
                      onChange={(e) => setDraft(prev => ({ ...prev, isbn: e.target.value, doi: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">URL</Label>
                    <Input
                      aria-label="Source URL"
                      value={draft.url || ''}
                      onChange={(e) => setDraft(prev => ({ ...prev, url: e.target.value }))}
                      className="h-11 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONCEPTS</Label>
                  <div className="flex flex-wrap gap-2">
                    {(draft.tags || []).map(tag => (
                      <Badge key={tag} variant="secondary" className="px-4 py-1.5 font-code text-[9px] uppercase tracking-widest rounded-full border-border/60 bg-card shadow-sm font-bold">
                        {tag}
                        <button type="button" aria-label={`Remove concept ${tag}`} title={`Remove ${tag}`} onClick={() => removeTag(tag)} className="ml-2 inline-flex size-8 items-center justify-center hover:text-destructive transition-colors"><X className="size-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:gap-3">
                    <Input
                      placeholder="Add concept vocabulary..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                      className="h-11 rounded-md text-sm sm:rounded-full"
                    />
                    <Button variant="outline" onClick={addTag} className="h-11 rounded-md border-border/60 bg-card px-4 font-code text-[10px] font-bold uppercase tracking-widest shadow-sm sm:rounded-full sm:px-6">ADD</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">SOURCE DESCRIPTION</Label>
                  <Textarea
                    aria-label="Source description"
                    placeholder="A factual description of the source. Provider metadata appears here when available."
                    value={draft.description || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value, catalogSummary: buildCatalogSummary(e.target.value) }))}
                    className="min-h-[120px] resize-none p-4 italic text-base"
                  />
                  {draft.catalogSummary && <p className="text-xs leading-5 text-muted-foreground"><span className="font-medium text-foreground">Automatic catalog summary:</span> {draft.catalogSummary}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">YOUR NOTES</Label>
                  <Textarea
                    aria-label="Your source notes"
                    placeholder="Why you added this source, what you expect from it, or anything private you want to remember."
                    value={draft.sourceNotes || ''}
                    onChange={(e) => setDraft(prev => ({ ...prev, sourceNotes: e.target.value }))}
                    className="min-h-[100px] resize-y p-4 italic text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="readex-kicker uppercase opacity-50 font-bold text-[9px]">CONSUMPTION STATUS</Label>
                  <select
                    aria-label="Consumption status"
                    value={draft.status || 'Want to Read'}
                    onChange={(e) => setDraft(prev => ({ ...prev, status: e.target.value as MediaStatus }))}
                    className="h-11 w-full appearance-none rounded-md border border-border/60 bg-card px-4 font-body text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent sm:rounded-full sm:px-5"
                  >
                    {statuses.map(status => <option key={status} value={status}>{MEDIA_STATUS_LABELS[status]}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="grid grid-cols-2 gap-2 border-t bg-muted/10 p-4 sm:flex sm:justify-end sm:gap-4 sm:p-8 sm:pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-11 rounded-md px-4 font-code text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-transparent sm:rounded-full sm:px-8">Cancel</Button>
          <Button onClick={onSave} disabled={saving || !draft.title?.trim()} className="h-11 rounded-md bg-accent px-4 font-code text-[11px] font-bold uppercase tracking-widest sm:rounded-full sm:px-10">
            {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add to Library'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
