"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, Layers3, Plus, Search, X } from 'lucide-react';
import { ContextualAiPanel } from '@/components/ai/ContextualAiPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { iconForNoesisView } from '@/lib/noesis-icons';
import type { AiContextEnvelope, ContextualAiAction } from '@/lib/contextual-ai';
import type { AiSettings, Concept, Draft, Media, Practice, Question, TimelineEvent, VaultEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

type ContextRecordType = 'source' | 'annotation' | 'concept' | 'inquiry' | 'position' | 'work' | 'practice' | 'evolution';

interface ContextRecord {
  key: string;
  id: string;
  type: ContextRecordType;
  label: string;
  summary: string;
  memory: string[];
}

interface ContextDeskRoutePageProps {
  aiSettings: AiSettings;
  media: Media[];
  concepts: Concept[];
  questions: Question[];
  positions: VaultEntry[];
  works: Draft[];
  practices: Practice[];
  timeline: TimelineEvent[];
  onAddDraft: (data: Partial<Draft>) => Promise<Draft>;
  onNavigate: (view: string, targetId?: string | null) => void;
}

const SESSION_KEY = 'noesis:context-desk:selected';
const MAX_CONTEXT_ITEMS = 12;

const viewForType: Record<ContextRecordType, string> = {
  source: 'library',
  annotation: 'annotations',
  concept: 'concepts',
  inquiry: 'questions',
  position: 'vault',
  work: 'writing',
  practice: 'practices',
  evolution: 'evolution',
};

function compact(value?: string, fallback = 'No additional context recorded.') {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

export function ContextDeskRoutePage({
  aiSettings,
  media,
  concepts,
  questions,
  positions,
  works,
  practices,
  timeline,
  onAddDraft,
  onNavigate,
}: ContextDeskRoutePageProps) {
  const records = useMemo<ContextRecord[]>(() => [
    ...media.map((item) => ({
      key: `source:${item.id}`,
      id: item.id,
      type: 'source' as const,
      label: item.title,
      summary: compact(item.description, `${item.type} by ${item.creator || 'unknown creator'}`),
      memory: [
        `Source: ${item.title}${item.creator ? ` by ${item.creator}` : ''}`,
        `Type and status: ${item.type}; ${item.status}`,
        `Description: ${item.description || 'Not recorded.'}`,
        `Main idea: ${item.capture?.after?.coreArgument || 'Not recorded.'}`,
        `User reflection: ${item.capture?.after?.lasting || item.capture?.after?.beliefChange || 'Not recorded.'}`,
      ],
    })),
    ...media.flatMap((source) => (source.annotations || []).map((annotation) => ({
      key: `annotation:${source.id}:${annotation.id}`,
      id: annotation.id,
      type: 'annotation' as const,
      label: compact(annotation.text, 'Untitled annotation'),
      summary: `${source.title} · ${annotation.type}`,
      memory: [
        `Annotation from ${source.title}: ${annotation.text}`,
        `Annotation type: ${annotation.type}`,
        `Surrounding context: ${annotation.context || 'Not recorded.'}`,
        `User interpretation: ${annotation.consequenceNote || 'Not recorded.'}`,
        `Concepts: ${(annotation.conceptTags || []).join(', ') || 'None linked.'}`,
      ],
    }))),
    ...concepts.map((item) => ({
      key: `concept:${item.id}`,
      id: item.id,
      type: 'concept' as const,
      label: item.name,
      summary: compact(item.description),
      memory: [
        `Concept: ${item.name}`,
        `Definition: ${item.description || 'Not recorded.'}`,
        `Aliases: ${(item.aliases || []).join(', ') || 'None recorded.'}`,
        `Not the same as: ${(item.notSameAs || []).join(', ') || 'Not recorded.'}`,
        `Examples: ${(item.examples || []).join('; ') || 'Not recorded.'}`,
      ],
    })),
    ...questions.map((item) => ({
      key: `inquiry:${item.id}`,
      id: item.id,
      type: 'inquiry' as const,
      label: item.text,
      summary: compact(item.answer || item.currentIntuition, `Status: ${item.status}`),
      memory: [
        `Inquiry: ${item.text}`,
        `Status: ${item.status}`,
        `Why it matters: ${item.whyItMatters || 'Not recorded.'}`,
        `Current view: ${item.currentIntuition || item.answer || 'Not recorded.'}`,
        `Remaining uncertainty: ${item.uncertainty || 'Not recorded.'}`,
      ],
    })),
    ...positions.map((item) => ({
      key: `position:${item.id}`,
      id: item.id,
      type: 'position' as const,
      label: item.title || item.statement,
      summary: compact(item.statement || item.description),
      memory: [
        `Position: ${item.statement || item.title}`,
        `Status and confidence: ${item.status}; ${item.confidence}%`,
        `Rationale: ${item.rationale || item.description || 'Not recorded.'}`,
        `Assumptions: ${(item.assumptions || []).join('; ') || 'None recorded.'}`,
        `Supporting evidence: ${(item.evidenceFor || []).join('; ') || 'None recorded.'}`,
        `Challenging evidence: ${(item.evidenceAgainst || []).join('; ') || 'None recorded.'}`,
      ],
    })),
    ...works.map((item) => ({
      key: `work:${item.id}`,
      id: item.id,
      type: 'work' as const,
      label: item.title,
      summary: compact(item.body || item.draftContent, `${item.type} in ${item.status}`),
      memory: [
        `Work: ${item.title}`,
        `Type, purpose, and status: ${item.type}; ${item.workPurpose || 'not specified'}; ${item.status}`,
        `Content: ${compact(item.body || item.draftContent, 'No written content recorded.')}`,
        `Concepts: ${(item.conceptTags || []).join(', ') || 'None linked.'}`,
      ],
    })),
    ...practices.map((item) => ({
      key: `practice:${item.id}`,
      id: item.id,
      type: 'practice' as const,
      label: item.title,
      summary: compact(item.action || item.description, `Status: ${item.status}`),
      memory: [
        `Practice: ${item.title}`,
        `Status and type: ${item.status}; ${item.type}`,
        `Hypothesis: ${item.hypothesis || 'Not recorded.'}`,
        `Action: ${item.action || item.description || 'Not recorded.'}`,
        `Observed outcome: ${item.observedOutcome || item.conclusion?.whatHappened || 'Not recorded.'}`,
        ...(item.logs || []).slice(-5).map((log) => `Log ${log.date}: performed ${log.actionCompleted ? 'yes' : 'no'}; ${log.observations || log.outcome || 'no observation recorded'}`),
      ],
    })),
    ...timeline.map((item) => ({
      key: `evolution:${item.id}`,
      id: item.id,
      type: 'evolution' as const,
      label: item.entityTitle || item.reason,
      summary: compact(item.reason, `${item.eventType} on ${item.date}`),
      memory: [
        `Evolution event: ${item.eventType} - ${item.entityTitle}`,
        `Date: ${item.date}`,
        `Recorded reason: ${item.reason || 'Not recorded.'}`,
        `Object type: ${item.entityType}`,
      ],
    })),
  ], [concepts, media, positions, practices, questions, timeline, works]);

  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SESSION_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setSelectedKeys(parsed.filter((value): value is string => typeof value === 'string'));
    } catch {
      setSelectedKeys([]);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(selectedKeys));
  }, [selectedKeys]);

  const selected = useMemo(() => selectedKeys
    .map((key) => records.find((record) => record.key === key))
    .filter((record): record is ContextRecord => Boolean(record)), [records, selectedKeys]);
  const staleSelectionCount = selectedKeys.length - selected.length;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records.slice(0, 60);
    return records.filter((record) => `${record.label} ${record.summary} ${record.type}`.toLowerCase().includes(normalized)).slice(0, 60);
  }, [query, records]);

  const toggleRecord = (record: ContextRecord) => {
    setSelectedKeys((current) => {
      if (current.includes(record.key)) return current.filter((key) => key !== record.key);
      if (current.length >= MAX_CONTEXT_ITEMS) return current;
      return [...current, record.key];
    });
  };

  const buildEnvelope = (_action: ContextualAiAction, userPrompt?: string): AiContextEnvelope | null => {
    if (!selected.length) return null;
    const [primary, ...linked] = selected;
    return {
      action: 'review_selected_context',
      targetType: 'context_desk',
      targetId: `selection:${selected.map((record) => record.key).sort().join('|')}`.slice(0, 256),
      scope: 'linked_items',
      itemMemory: [`Primary selected record (${primary.type})`, ...primary.memory],
      linkedMemory: linked.flatMap((record) => [`Selected ${record.type}: ${record.label}`, ...record.memory]),
      userPrompt,
    };
  };

  const selectedConceptNames = selected.filter((record) => record.type === 'concept').map((record) => record.label);
  const selectedIds = (type: ContextRecordType) => selected.filter((record) => record.type === type).map((record) => record.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <header className="border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <Layers3 className="mt-1 size-6 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="font-code text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected-context reasoning</p>
            <h1 className="mt-1 text-3xl font-semibold text-foreground">Context Desk</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose the records Noesis may consider. Nothing else in your workspace is included, and no result is saved until you review it.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
        <section aria-labelledby="context-library-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="context-library-heading" className="text-lg font-semibold">Choose context</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search your records, then add only what this review needs.</p>
            </div>
            <span className="font-code text-xs text-muted-foreground">{selected.length}/{MAX_CONTEXT_ITEMS}</span>
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a source, concept, inquiry, position, work, or practice" className="h-11 pl-10" aria-label="Search workspace records" />
          </div>
          <ScrollArea className="mt-3 h-[min(52vh,34rem)] border-y border-border">
            <div className="divide-y divide-border">
              {filtered.map((record) => {
                const active = selectedKeys.includes(record.key);
                const Icon = iconForNoesisView(viewForType[record.type]);
                return (
                  <button
                    key={record.key}
                    type="button"
                    onClick={() => toggleRecord(record)}
                    disabled={!active && selected.length >= MAX_CONTEXT_ITEMS}
                    className={cn('grid w-full grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-start gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-45', active && 'bg-accent/8')}
                    aria-pressed={active}
                  >
                    <span className="flex size-9 items-center justify-center text-muted-foreground"><Icon className="size-[18px]" aria-hidden="true" /></span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{record.label}</span><Badge variant="outline" className="text-[9px] uppercase">{record.type}</Badge></span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{record.summary}</span>
                    </span>
                    <span className={cn('mt-1 flex size-8 items-center justify-center border', active ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground')} aria-hidden="true">{active ? <Check className="size-4" /> : <Plus className="size-4" />}</span>
                  </button>
                );
              })}
              {!filtered.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No records match that search.</p>}
            </div>
          </ScrollArea>
        </section>

        <section aria-labelledby="selected-context-heading" className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="selected-context-heading" className="text-lg font-semibold">Selected context</h2>
              <p className="mt-1 text-sm text-muted-foreground">This exact set is sent for review.</p>
            </div>
            {selected.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys([])}>Clear</Button>}
          </div>

          <div className="mt-4 min-h-36 divide-y divide-border border-y border-border">
            {selected.map((record) => {
              const Icon = iconForNoesisView(viewForType[record.type]);
              return (
                <div key={record.key} className="grid grid-cols-[1.75rem_minmax(0,1fr)_2.5rem] items-start gap-2 py-3">
                  <Icon className="mt-1 size-4 text-muted-foreground" aria-hidden="true" />
                  <button type="button" className="min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onNavigate(viewForType[record.type], record.id)}>
                    <span className="block text-sm font-medium leading-5 text-foreground">{record.label}</span>
                    <span className="mt-0.5 block text-[10px] uppercase text-muted-foreground">{record.type}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">Included: {record.summary}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => toggleRecord(record)} aria-label={`Remove ${record.label} from context`}><X className="size-4" /></Button>
                </div>
              );
            })}
            {!selected.length && <div className="flex min-h-36 items-center justify-center px-5 text-center text-sm leading-6 text-muted-foreground">Select at least one record to begin. Two or more records are best for comparison and contradiction checks.</div>}
          </div>

          {staleSelectionCount > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 border-l-2 border-destructive/60 pl-3 text-xs leading-5 text-muted-foreground">
              <span>{staleSelectionCount} previously selected {staleSelectionCount === 1 ? 'record is' : 'records are'} no longer available and will not be sent.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(selected.map((record) => record.key))}>Remove stale</Button>
            </div>
          )}
          {selected.length >= MAX_CONTEXT_ITEMS && (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Selection limit reached. Remove an item before adding another; no unselected records will be included.</p>
          )}

          <Separator className="my-5" />
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Review destination</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Approved findings become a new editable Work. The selected records remain unchanged.</p>
            </div>
            <ContextualAiPanel
              actions={['review_selected_context']}
              enabled={aiSettings.aiAssistanceEnabled && selected.length > 0}
              showContextBeforeSending={aiSettings.showContextBeforeSending}
              reasoningDepth={aiSettings.defaultReasoningDepth}
              retainAcceptedProvenance={aiSettings.retainAcceptedAiProvenance}
              buttonLabel={selected.length ? 'Review Selected Context' : 'Select context first'}
              promptLabel="What should Noesis examine across these records?"
              promptPlaceholder="For example: Where do these records contradict each other, and what should I investigate next?"
              buildEnvelope={buildEnvelope}
              onAccept={async (_result, content) => {
                const created = await onAddDraft({
                  title: `Context review - ${new Date().toLocaleDateString()}`,
                  body: content,
                  draftContent: content,
                  type: 'reflection',
                  status: 'drafting',
                  workCategory: 'writing',
                  workPurpose: 'synthesize',
                  conceptTags: selectedConceptNames,
                  sourceIds: selectedIds('source'),
                  questionIds: selectedIds('inquiry'),
                  beliefIds: selectedIds('position'),
                });
                onNavigate('writing', created.id);
              }}
            />
            {!aiSettings.aiAssistanceEnabled && <p className="text-xs text-muted-foreground">Contextual assistance is disabled in Settings.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
