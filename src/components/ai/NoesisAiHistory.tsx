"use client";

import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { ContextualAiDocument } from '@/components/ai/ContextualAiPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AiAssistedHistoryEntry, Concept, Draft, Media, Practice, Question, VaultEntry } from '@/lib/types';
import type { DeskFinding } from '@/lib/context-desk-handoff';
import { cn } from '@/lib/utils';

export type AiHistoryRecordType = 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'work' | 'practice';

export interface AiHistoryItem {
  key: string;
  entry: AiAssistedHistoryEntry;
  type: AiHistoryRecordType;
  recordId: string;
  recordLabel: string;
  sourceId?: string;
}

const TYPE_LABELS: Record<AiHistoryRecordType, string> = {
  source: 'Library',
  annotation: 'Annotations',
  concept: 'Concepts',
  inquiry: 'Inquiries',
  position: 'Positions',
  work: 'Works',
  practice: 'Praxis',
};

const TYPE_VIEWS: Record<AiHistoryRecordType, string> = {
  source: 'library',
  annotation: 'annotations',
  concept: 'concepts',
  inquiry: 'questions',
  position: 'vault',
  work: 'writing',
  practice: 'labs',
};

const TYPE_TONES: Record<AiHistoryRecordType, string> = {
  source: 'encounter',
  annotation: 'encounter',
  concept: 'examine',
  inquiry: 'examine',
  position: 'claim',
  work: 'more',
  practice: 'act',
};

/** Every reviewed AI result saved anywhere in the workspace, newest first. */
export function collectAiHistory({ media, concepts, questions, positions, works, practices }: {
  media: Media[];
  concepts: Concept[];
  questions: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
}): AiHistoryItem[] {
  const items: AiHistoryItem[] = [];
  const add = (type: AiHistoryRecordType, recordId: string, recordLabel: string, entries: AiAssistedHistoryEntry[] | undefined, sourceId?: string) => {
    for (const entry of entries || []) {
      items.push({ key: `${type}:${recordId}:${entry.id}`, entry, type, recordId, recordLabel: recordLabel || 'Untitled', sourceId });
    }
  };
  const deskEntries = (findings?: DeskFinding[]): AiAssistedHistoryEntry[] | undefined => findings?.map(finding => ({
    ...finding, title: 'Context Desk finding', action: 'review_selected_context',
  }));
  for (const source of media) {
    add('source', source.id, source.title, source.aiReviewHistory);
    for (const annotation of source.annotations || []) {
      add('annotation', annotation.id, (annotation.text || '').slice(0, 90) || source.title, annotation.aiReviewHistory, source.id);
    }
  }
  for (const concept of concepts) add('concept', concept.id, concept.name, concept.aiReviewHistory);
  for (const question of questions) {
    add('inquiry', question.id, question.text, question.aiReviewHistory);
    add('inquiry', question.id, question.text, deskEntries(question.contextDeskFindings));
  }
  for (const position of positions) {
    add('position', position.id, position.title, position.aiReviewHistory);
    add('position', position.id, position.title, deskEntries(position.contextDeskFindings));
  }
  for (const work of works) add('work', work.id, work.title, work.aiReviewHistory);
  for (const practice of practices) {
    add('practice', practice.id, practice.title, practice.aiReviewHistory);
    add('practice', practice.id, practice.title, deskEntries(practice.contextDeskFindings));
  }
  const time = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return items.sort((a, b) => time(b.entry.date) - time(a.entry.date));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function NoesisAiHistory({ items, onNavigate }: {
  items: AiHistoryItem[];
  onNavigate: (view: string, targetId?: string | null, sourceId?: string) => void;
}) {
  const [query, setQuery] = useState('');
  /**
   * Three stacks of the same runs. By page answers "where has the assistant
   * been, and where has it never been"; opening one threads its runs under the
   * record they were about. Recent is the plain chronological list, which is
   * the only one that answers "what was I just doing" after an hour of jumping
   * between pages.
   */
  const [view, setView] = useState<'pages' | 'recent'>('pages');
  const [page, setPage] = useState<AiHistoryRecordType | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.entry.action, item.entry.title, item.entry.content, item.recordLabel]
      .some((text) => text?.toLowerCase().includes(needle)));
  }, [items, query]);

  const byPage = useMemo(() => {
    const map = new Map<AiHistoryRecordType, AiHistoryItem[]>();
    for (const key of Object.keys(TYPE_LABELS) as AiHistoryRecordType[]) map.set(key, []);
    for (const item of matches) map.get(item.type)?.push(item);
    return map;
  }, [matches]);

  /** Within one page, runs gathered under the record they were about. */
  const threads = useMemo(() => {
    if (!page) return [];
    const map = new Map<string, AiHistoryItem[]>();
    for (const item of byPage.get(page) || []) {
      const list = map.get(item.recordId) || [];
      list.push(item);
      map.set(item.recordId, list);
    }
    return [...map.values()].sort((left, right) => right.length - left.length);
  }, [byPage, page]);

  const search = (
    <div className="relative min-w-[14rem] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search past AI results" aria-label="Search past AI results" className="pl-9" />
    </div>
  );

  const run = (item: AiHistoryItem, showRecord: boolean) => {
    const expanded = open === item.key;
    return (
      <li key={item.key} data-stage-tone={TYPE_TONES[item.type]}>
        <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : item.key)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          {showRecord && <Badge variant="outline" className="noesis-stage-badge shrink-0 rounded-full noesis-eyebrow noesis-eyebrow--sm" style={{ borderColor: 'hsl(var(--stage) / .5)' }}>{TYPE_LABELS[item.type]}</Badge>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{item.entry.action}</span>
            {showRecord && <span className="block truncate text-xs text-muted-foreground">{item.recordLabel}</span>}
          </span>
          <span className="shrink-0 noesis-eyebrow text-muted-foreground">{formatDate(item.entry.date)}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        </button>
        {expanded && (
          <div className="space-y-3 border-t border-border/60 bg-background/40 px-4 py-4">
            {item.entry.title && item.entry.title !== item.entry.action && <p className="text-sm font-medium">{item.entry.title}</p>}
            <ContextualAiDocument content={item.entry.content} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onNavigate(TYPE_VIEWS[item.type], item.recordId, item.sourceId)}>
                Open {item.type === 'source' ? 'source' : 'item'}
              </Button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <section aria-labelledby="ai-history-heading" className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ai-history-heading" className="text-lg font-semibold">
            {view === 'recent' ? 'Recent results' : page ? TYPE_LABELS[page] : 'AI history'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === 'recent' ? 'Everything you kept, newest first — the order you did it in.'
              : page ? 'Runs gathered under the record they were about, so a line of thinking reads in order.'
                : 'Every reviewed result you kept, by the page it came from. Reread it here instead of generating it again.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="noesis-figure">{matches.length} of {items.length}</span>
          {(page || view === 'recent') && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setPage(null); setView('pages'); }}>← All pages</Button>
          )}
          {view !== 'recent' && !page && (
            <Button type="button" variant="outline" size="sm" onClick={() => setView('recent')}>Recent</Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">{search}</div>

      {/* By page: the only view that shows where the assistant has never been. */}
      {view === 'pages' && !page && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(TYPE_LABELS) as AiHistoryRecordType[]).map((key) => {
            const runs = byPage.get(key) || [];
            return (
              <button key={key} type="button" data-stage-tone={TYPE_TONES[key]} disabled={!runs.length}
                onClick={() => setPage(key)}
                className={cn('grid gap-2 rounded-[var(--card-radius)] border p-4 text-left transition-colors',
                  runs.length ? 'border-border bg-card hover:border-[hsl(var(--stage)/.6)]' : 'border-dashed border-border/70 bg-transparent')}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold" style={{ color: runs.length ? 'hsl(var(--stage))' : undefined }}>{TYPE_LABELS[key]}</span>
                  <span className="noesis-figure" style={{ color: runs.length ? 'hsl(var(--stage))' : undefined }}>{runs.length}</span>
                </div>
                {runs.length ? (
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {runs.slice(0, 2).map((item) => <li key={item.key} className="truncate">{item.recordLabel}</li>)}
                    {runs.length > 2 && <li className="text-[hsl(var(--stage))]">See all {runs.length} →</li>}
                  </ul>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">Never reviewed. Nothing here has been through the assistant.</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* By record: one thread per record, most worked first. */}
      {view === 'pages' && page && (
        <div className="mt-4 grid gap-3">
          {threads.map((thread) => (
            <div key={thread[0].recordId} data-stage-tone={TYPE_TONES[page]} className="overflow-hidden rounded-[var(--card-radius)] border border-border bg-card">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{thread[0].recordLabel}</p>
                <span className="noesis-figure">{thread.length === 1 ? '1 run' : `${thread.length} runs`}</span>
              </div>
              <ul className="divide-y divide-border/60">{thread.map((item) => run(item, false))}</ul>
            </div>
          ))}
          {!threads.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing on this page matches that search.</p>}
        </div>
      )}

      {/* Recent: what you were just doing, across every page. */}
      {view === 'recent' && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[var(--card-radius)] border border-border bg-card">
          {matches.map((item) => run(item, true))}
          {!matches.length && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {items.length ? 'No AI results match that search.' : 'No reviewed AI results yet. Results you keep on any page collect here.'}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}