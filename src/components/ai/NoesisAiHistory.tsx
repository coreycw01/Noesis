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
  const [type, setType] = useState<AiHistoryRecordType | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const presentTypes = useMemo(() => (Object.keys(TYPE_LABELS) as AiHistoryRecordType[]).filter((key) => items.some((item) => item.type === key)), [items]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => (type === 'all' || item.type === type) && (!needle || [item.entry.action, item.entry.title, item.entry.content, item.recordLabel].some((text) => text?.toLowerCase().includes(needle))));
  }, [items, query, type]);

  return (
    <section aria-labelledby="ai-history-heading" className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ai-history-heading" className="text-lg font-semibold">AI history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Every reviewed result you kept, from every page. Reread it here instead of generating it again.</p>
        </div>
        <span className="font-code text-xs text-muted-foreground">{visible.length} of {items.length}</span>
      </div>
      {items.length > 0 && (
        <div className="noesis-flowbar mt-4" role="group" aria-label="AI results by page">
          {presentTypes.map((key) => {
            const count = items.filter((item) => item.type === key).length;
            return (
              <button key={key} type="button" data-stage-tone={TYPE_TONES[key]} aria-pressed={type === key} onClick={() => setType(type === key ? 'all' : key)} className="noesis-flowbar__seg" style={{ flexGrow: count }} title={`${TYPE_LABELS[key]}: ${count}`}>
                <span>{TYPE_LABELS[key]} · {count}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search past AI results" aria-label="Search past AI results" className="pl-9" />
        </div>
        <Select value={type} onValueChange={(value) => setType(value as AiHistoryRecordType | 'all')}>
          <SelectTrigger className="w-[12rem]" aria-label="From page"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pages</SelectItem>
            {presentTypes.map((key) => <SelectItem key={key} value={key}>{TYPE_LABELS[key]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[var(--card-radius)] border border-border bg-card">
        {visible.map((item) => {
          const expanded = open === item.key;
          return (
            <li key={item.key} data-stage-tone={TYPE_TONES[item.type]}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : item.key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Badge variant="outline" className="noesis-stage-badge shrink-0 rounded-full noesis-eyebrow noesis-eyebrow--sm" style={{ borderColor: 'hsl(var(--stage) / .5)' }}>{TYPE_LABELS[item.type]}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.entry.action}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.recordLabel}</span>
                </span>
                <span className="shrink-0 noesis-eyebrow text-muted-foreground">{formatDate(item.entry.date)}</span>
                <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
              </button>
              {expanded && (
                <div className="space-y-3 border-t border-border/60 bg-background/40 px-4 py-4">
                  {item.entry.title && item.entry.title !== item.entry.action && <p className="text-sm font-medium">{item.entry.title}</p>}
                  <ContextualAiDocument content={item.entry.content} />
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => onNavigate(TYPE_VIEWS[item.type], item.recordId, item.sourceId)}>
                      Open {item.type === 'source' ? 'source' : 'item'}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {!visible.length && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            {items.length ? 'No AI results match that search.' : 'No reviewed AI results yet. Results you keep on any page collect here.'}
          </li>
        )}
      </ul>
    </section>
  );
}
