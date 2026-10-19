"use client";

import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import type { DocumentPaperPattern, WorkMindMapNode, WorkTemplateData, WorkTimelineEntry, WorkToolKind, WritingStyle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type StructuredWorkStyle = WorkToolKind;

type FieldDefinition = { key: string; label: string; prompt: string; multiline?: boolean };

const FORMAT_COPY: Record<StructuredWorkStyle, { title: string; purpose: string; fields: FieldDefinition[] }> = {
  bar_chart: {
    title: 'Bar Chart',
    purpose: 'Compare magnitudes visually. Adjust each bar directly; the chart remains an editable object instead of becoming document text.',
    fields: [],
  },
  visual_table: {
    title: 'Visual Table',
    purpose: 'Arrange a compact set of values in a visual grid that can be resized and edited as one object.',
    fields: [],
  },
  cornell_notes: {
    title: 'Cornell Notes',
    purpose: 'Capture notes, add cues that help you return to them, then write the takeaway in your own words.',
    fields: [
      { key: 'cues', label: 'Cues and questions', prompt: 'What terms, questions, or prompts will help you revisit these notes?', multiline: true },
      { key: 'notes', label: 'Notes', prompt: 'Capture observations, quotations, and connections here.', multiline: true },
      { key: 'summary', label: 'Summary', prompt: 'What is the essential takeaway?', multiline: true },
    ],
  },
  two_column_debate: {
    title: 'Two-Column Debate',
    purpose: 'Put the strongest case on each side beside one another before you decide what survives the comparison.',
    fields: [
      { key: 'for', label: 'Case for', prompt: 'What is the strongest reason, evidence, or implication in favor?', multiline: true },
      { key: 'against', label: 'Case against', prompt: 'What is the strongest objection, counterexample, or cost?', multiline: true },
      { key: 'judgement', label: 'Working judgment', prompt: 'What do you currently conclude, and what could still change it?', multiline: true },
    ],
  },
  dialectic: {
    title: 'Dialectic',
    purpose: 'Develop a position by giving the objection its full force, then state the view that remains after the pressure.',
    fields: [
      { key: 'thesis', label: 'Initial claim', prompt: 'What do you initially think is true?', multiline: true },
      { key: 'antithesis', label: 'Strongest challenge', prompt: 'What is the best challenge to that claim?', multiline: true },
      { key: 'synthesis', label: 'Revised view', prompt: 'What more precise view emerges from the tension?', multiline: true },
    ],
  },
  belief_audit: {
    title: 'Belief Review',
    purpose: 'Make a belief inspectable: where it came from, what supports it, what strains it, and what you will do with it now.',
    fields: [
      { key: 'belief', label: 'The belief', prompt: 'State the belief plainly.', multiline: true },
      { key: 'origin', label: 'Origin', prompt: 'Where did this belief come from?', multiline: true },
      { key: 'evidence', label: 'What supports it', prompt: 'What experience, source, or reasoning supports it?', multiline: true },
      { key: 'tension', label: 'What strains it', prompt: 'What objection, exception, or uncertainty matters most?', multiline: true },
      { key: 'revision', label: 'Current revision', prompt: 'Keep, refine, suspend, or replace it. Why?', multiline: true },
    ],
  },
  source_analysis: {
    title: 'Source Analysis',
    purpose: 'Separate what the source says from what you make of it, then record the connection that is worth carrying forward.',
    fields: [
      { key: 'claim', label: 'Main claim', prompt: 'What does this source argue or show?', multiline: true },
      { key: 'evidence', label: 'Key evidence', prompt: 'Which passage, example, or observation matters?', multiline: true },
      { key: 'interpretation', label: 'Your interpretation', prompt: 'What does it change, clarify, or complicate for you?', multiline: true },
      { key: 'limitation', label: 'Limitation or challenge', prompt: 'What should not be assumed from this source?', multiline: true },
      { key: 'connection', label: 'Connection', prompt: 'Where should this connect in Noesis?', multiline: true },
    ],
  },
  mind_map: { title: 'Mind Map', purpose: 'Start with one central idea, then add the ideas that belong around it. Use branches for association, not a disguised outline.', fields: [] },
  timeline: { title: 'Timeline', purpose: 'Place only the events, shifts, or stages that make the development of an idea easier to understand.', fields: [] },
  venn_diagram: {
    title: 'Venn Diagram',
    purpose: 'Compare two ideas by separating what belongs to each from what they genuinely share.',
    fields: [
      { key: 'left_label', label: 'First idea', prompt: 'Name the first idea' },
      { key: 'left_only', label: 'Only the first', prompt: 'What belongs only to the first idea?', multiline: true },
      { key: 'shared', label: 'Shared ground', prompt: 'What do both ideas share?', multiline: true },
      { key: 'right_label', label: 'Second idea', prompt: 'Name the second idea' },
      { key: 'right_only', label: 'Only the second', prompt: 'What belongs only to the second idea?', multiline: true },
    ],
  },
  comparison_matrix: {
    title: 'Comparison Matrix',
    purpose: 'Compare alternatives against the same criteria so the differences remain visible and fair.',
    fields: [
      { key: 'options', label: 'Options', prompt: 'Which ideas, choices, or interpretations are you comparing?', multiline: true },
      { key: 'criteria', label: 'Criteria', prompt: 'What standards should each option be judged against?', multiline: true },
      { key: 'comparison', label: 'Comparison', prompt: 'How does each option perform against those standards?', multiline: true },
      { key: 'conclusion', label: 'Working conclusion', prompt: 'What survives the comparison, and why?', multiline: true },
    ],
  },
  causal_chain: {
    title: 'Causal Chain',
    purpose: 'Trace how one condition may lead to another while marking uncertain or disputed links.',
    fields: [
      { key: 'starting_condition', label: 'Starting condition', prompt: 'Where does the chain begin?' },
      { key: 'steps', label: 'Intermediate links', prompt: 'List each step in order and explain why it follows.', multiline: true },
      { key: 'outcome', label: 'Outcome', prompt: 'What result does the chain produce?' },
      { key: 'weak_link', label: 'Weakest link', prompt: 'Which causal step is least certain or most contestable?', multiline: true },
    ],
  },
};

export function workToolLabel(style: StructuredWorkStyle) {
  return FORMAT_COPY[style].title;
}

const paperTone = {
  blank: 'bg-transparent text-inherit',
  warm: 'bg-amber-50 text-stone-900',
  sepia: 'bg-[#f4ecd8] text-[#493727]',
  dark: 'bg-slate-900 text-slate-100',
} as const;

function paperPatternStyle(paperColor: keyof typeof paperTone, pattern: DocumentPaperPattern): CSSProperties {
  if (pattern === 'none') return {};
  const guide = paperColor === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(86,72,56,0.13)';
  if (pattern === 'notebook') return { backgroundImage: `linear-gradient(${guide} 1px, transparent 1px)`, backgroundSize: '100% 2.4em' };
  if (pattern === 'grid') return { backgroundImage: `linear-gradient(${guide} 1px, transparent 1px), linear-gradient(90deg, ${guide} 1px, transparent 1px)`, backgroundSize: '20px 20px' };
  if (pattern === 'dotted') return { backgroundImage: `radial-gradient(${guide} 1px, transparent 1px)`, backgroundSize: '18px 18px' };
  return { backgroundImage: `linear-gradient(${guide} 1px, transparent 1px), linear-gradient(90deg, ${guide} 1px, transparent 1px), radial-gradient(${guide} 1px, transparent 1px)`, backgroundSize: '28px 28px, 28px 28px, 14px 14px' };
}

export function isStructuredWorkStyle(style: WritingStyle | WorkToolKind): style is StructuredWorkStyle {
  return style in FORMAT_COPY;
}

export function StructuredWorkSurface({
  style,
  data,
  onChange,
  paperColor,
  pageSize,
  paperPattern = 'none',
  embedded = false,
}: {
  style: StructuredWorkStyle;
  data?: WorkTemplateData;
  onChange: (data: WorkTemplateData) => void;
  paperColor: keyof typeof paperTone;
  pageSize: 'letter' | 'a4';
  paperPattern?: DocumentPaperPattern;
  /** Renders the tool as a page inside a normal document instead of a whole studio. */
  embedded?: boolean;
}) {
  const current: WorkTemplateData = data || { version: 1, fields: {}, branches: [], timeline: [] };
  const [newBranchParentId, setNewBranchParentId] = useState('central');
  const updateFields = (key: string, value: string) => onChange({ ...current, fields: { ...current.fields, [key]: value } });
  const widthClass = pageSize === 'letter' ? 'max-w-[850px]' : 'max-w-[827px]';

  if (style === 'bar_chart') {
    const rowCount = Math.min(8, Math.max(2, Number(current.fields.row_count) || 3));
    const rows = Array.from({ length: rowCount }, (_, index) => {
      const savedValue = Number(current.fields[`bar_${index}_value`]);
      return {
        label: current.fields[`bar_${index}_label`] || ['Support', 'Challenge', 'Unknown'][index] || `Item ${index + 1}`,
        value: Math.min(100, Math.max(0, Number.isFinite(savedValue) && current.fields[`bar_${index}_value`] !== undefined ? savedValue : ([70, 35, 50][index] ?? 50))),
      };
    });
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="space-y-6 p-5 sm:p-8">
          <Input value={current.fields.chart_title || ''} onChange={(event) => updateFields('chart_title', event.target.value)} placeholder="Chart title" aria-label="Chart title" className="h-auto border-0 bg-transparent px-0 font-headline text-xl font-bold italic shadow-none focus-visible:ring-0" />
          <div className="space-y-4" aria-label="Visual bar chart">
            {rows.map((row, index) => (
              <div key={index} className="grid items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)_52px_auto]">
                <Input value={row.label} onChange={(event) => updateFields(`bar_${index}_label`, event.target.value)} aria-label={`Bar ${index + 1} label`} className="h-9 border-0 border-b border-current/20 bg-transparent px-1 text-sm shadow-none focus-visible:ring-1" />
                <div className="relative h-8 overflow-hidden border border-current/15 bg-current/5">
                  <div className="h-full bg-accent/75 transition-[width] duration-200" style={{ width: `${row.value}%` }} />
                  <input type="range" min="0" max="100" value={row.value} onChange={(event) => updateFields(`bar_${index}_value`, event.target.value)} aria-label={`${row.label} value`} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
                </div>
                <output className="font-code text-xs font-bold tabular-nums">{row.value}</output>
                {rowCount > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => {
                  const nextFields: Record<string, string> = { ...current.fields, row_count: String(rowCount - 1) };
                  for (let cursor = index; cursor < rowCount - 1; cursor += 1) {
                    nextFields[`bar_${cursor}_label`] = rows[cursor + 1].label;
                    nextFields[`bar_${cursor}_value`] = String(rows[cursor + 1].value);
                  }
                  onChange({ ...current, fields: nextFields });
                }} className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Remove ${row.label} bar`}><Trash2 className="size-3.5" /></Button>}
              </div>
            ))}
          </div>
          {rowCount < 8 && <Button type="button" variant="outline" size="sm" onClick={() => updateFields('row_count', String(rowCount + 1))}><Plus className="mr-2 size-4" /> Add bar</Button>}
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'visual_table') {
    const rows = Math.min(8, Math.max(2, Number(current.fields.table_rows) || 3));
    const columns = Math.min(6, Math.max(2, Number(current.fields.table_columns) || 3));
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="space-y-5 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input value={current.fields.table_title || ''} onChange={(event) => updateFields('table_title', event.target.value)} placeholder="Table title" aria-label="Table title" className="h-auto max-w-md border-0 bg-transparent px-0 font-headline text-xl font-bold italic shadow-none focus-visible:ring-0" />
            <div className="flex items-center gap-3 font-code text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              <label className="flex items-center gap-1">Rows <input type="range" min="2" max="8" value={rows} onChange={(event) => updateFields('table_rows', event.target.value)} aria-label="Table rows" className="w-20 accent-[hsl(var(--accent))]" /><span>{rows}</span></label>
              <label className="flex items-center gap-1">Columns <input type="range" min="2" max="6" value={columns} onChange={(event) => updateFields('table_columns', event.target.value)} aria-label="Table columns" className="w-20 accent-[hsl(var(--accent))]" /><span>{columns}</span></label>
            </div>
          </div>
          <div className="overflow-x-auto border border-current/25">
            <div className="grid min-w-[560px]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(120px, 1fr))` }}>
              {Array.from({ length: rows * columns }, (_, index) => {
                const row = Math.floor(index / columns);
                const column = index % columns;
                return <Input key={index} value={current.fields[`cell_${row}_${column}`] || ''} onChange={(event) => updateFields(`cell_${row}_${column}`, event.target.value)} aria-label={`Table row ${row + 1}, column ${column + 1}`} placeholder={row === 0 ? `Heading ${column + 1}` : '—'} className={cn('h-12 rounded-none border-0 border-b border-r border-current/15 bg-transparent px-3 shadow-none focus-visible:z-10 focus-visible:ring-2', row === 0 && 'bg-accent/8 font-semibold')} />;
              })}
            </div>
          </div>
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'venn_diagram') {
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="overflow-x-auto p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input aria-label="First idea" value={current.fields.left_label || ''} onChange={(event) => updateFields('left_label', event.target.value)} placeholder="First idea" className="bg-background/55" />
            <Input aria-label="Second idea" value={current.fields.right_label || ''} onChange={(event) => updateFields('right_label', event.target.value)} placeholder="Second idea" className="bg-background/55" />
          </div>
          <div className="relative mx-auto mt-6 h-[420px] min-w-[620px] max-w-[650px]">
            <div className="absolute left-2 top-4 size-[360px] rounded-full border-2 border-accent/55 bg-accent/8" aria-hidden="true" />
            <div className="absolute right-2 top-4 size-[360px] rounded-full border-2 border-foreground/30 bg-background/45" aria-hidden="true" />
            <div className="absolute left-12 top-28 z-10 w-44">
              <label className="font-code text-[9px] font-bold uppercase tracking-[0.16em] opacity-60">Only {current.fields.left_label || 'the first'}</label>
              <Textarea value={current.fields.left_only || ''} onChange={(event) => updateFields('left_only', event.target.value)} placeholder="Distinct qualities, evidence, or implications" className="mt-3 min-h-40 resize-none border-0 bg-background/45 text-sm shadow-none focus-visible:ring-1" />
            </div>
            <div className="absolute left-1/2 top-24 z-20 w-44 -translate-x-1/2 text-center">
              <label className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">Shared ground</label>
              <Textarea value={current.fields.shared || ''} onChange={(event) => updateFields('shared', event.target.value)} placeholder="What genuinely overlaps?" className="mt-3 min-h-40 resize-none border border-accent/30 bg-background/90 text-center text-sm shadow-sm" />
            </div>
            <div className="absolute right-12 top-28 z-10 w-44 text-right">
              <label className="font-code text-[9px] font-bold uppercase tracking-[0.16em] opacity-60">Only {current.fields.right_label || 'the second'}</label>
              <Textarea value={current.fields.right_only || ''} onChange={(event) => updateFields('right_only', event.target.value)} placeholder="Distinct qualities, evidence, or implications" className="mt-3 min-h-40 resize-none border-0 bg-background/45 text-right text-sm shadow-none focus-visible:ring-1" />
            </div>
          </div>
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'mind_map') {
    const legacyNodes: WorkMindMapNode[] = (current.branches || []).map((label, index) => ({
      id: `legacy-branch-${index}`,
      label,
      parentId: null,
    }));
    const nodes = current.mindMapNodes?.length ? current.mindMapNodes : legacyNodes;
    const saveNodes = (next: WorkMindMapNode[]) => onChange({
      ...current,
      mindMapNodes: next,
      branches: next.map((node) => node.label),
    });
    const updateNode = (id: string, patch: Partial<WorkMindMapNode>) => {
      const next = nodes.map((node) => node.id === id ? { ...node, ...patch } : node);
      saveNodes(next);
    };
    const removeNode = (id: string) => {
      const removed = nodes.find((node) => node.id === id);
      saveNodes(nodes
        .filter((node) => node.id !== id)
        .map((node) => node.parentId === id ? { ...node, parentId: removed?.parentId || null } : node));
    };
    const depthFor = (node: WorkMindMapNode) => {
      let depth = 0;
      let parentId = node.parentId;
      const visited = new Set<string>();
      while (parentId && depth < 4 && !visited.has(parentId)) {
        visited.add(parentId);
        depth += 1;
        parentId = nodes.find((candidate) => candidate.id === parentId)?.parentId || null;
      }
      return depth;
    };
    const wouldCreateCycle = (nodeId: string, parentId: string) => {
      let cursor: string | null = parentId;
      const visited = new Set<string>();
      while (cursor && !visited.has(cursor)) {
        if (cursor === nodeId) return true;
        visited.add(cursor);
        cursor = nodes.find((node) => node.id === cursor)?.parentId || null;
      }
      return false;
    };
    const addBranch = () => {
      const parentId = newBranchParentId === 'central' ? null : newBranchParentId;
      saveNodes([...nodes, { id: crypto.randomUUID(), label: '', parentId }]);
    };
    const center = { x: 360, y: 260 };
    const nodePositions = nodes.map((node) => {
      const depth = depthFor(node);
      const peers = nodes.filter((candidate) => depthFor(candidate) === depth);
      const peerIndex = peers.findIndex((candidate) => candidate.id === node.id);
      const radius = Math.min(230, 170 + depth * 48);
      const angle = -Math.PI / 2 + ((Math.PI * 2) / Math.max(peers.length, 1)) * peerIndex + depth * 0.28;
      return { id: node.id, x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    });
    const nodePosition = (id: string | null) => id ? nodePositions.find((position) => position.id === id) || center : center;
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="space-y-5 overflow-x-auto p-5 sm:p-8">
          <div className="relative mx-auto h-[540px] min-w-[720px] max-w-[720px] overflow-hidden rounded-[50%] border border-dashed border-current/15 bg-background/20" aria-label="Mind map branches">
            <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 720 540" aria-hidden="true">
              {nodes.map((node) => {
                const from = nodePosition(node.parentId);
                const to = nodePosition(node.id);
                return <line key={node.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />;
              })}
            </svg>
            <div className="absolute left-[280px] top-[205px] z-10 flex h-[110px] w-40 items-center justify-center rounded-full border-2 border-accent bg-background p-3 shadow-md">
              <Input value={current.fields.central || ''} onChange={(event) => updateFields('central', event.target.value)} placeholder="Central idea" aria-label="Central idea" className="h-auto border-0 bg-transparent px-0 text-center font-headline text-lg font-bold italic shadow-none focus-visible:ring-0" />
            </div>
            {nodes.length === 0 && <p className="absolute bottom-10 left-1/2 w-80 -translate-x-1/2 text-center text-sm opacity-60">Add a branch and choose exactly which idea it grows from.</p>}
            {nodes.map((node) => {
              const position = nodePosition(node.id);
              return (
                <div key={node.id} className="absolute z-10 w-40 -translate-x-1/2 -translate-y-1/2 border border-current/25 bg-background/95 p-2 shadow-sm" style={{ left: position.x, top: position.y }}>
                  <div className="flex items-start gap-1">
                    <Input value={node.label} onChange={(event) => updateNode(node.id, { label: event.target.value })} placeholder="Related idea" className="h-8 min-w-0 border-0 bg-transparent px-1 text-center text-sm font-medium shadow-none focus-visible:ring-1" aria-label="Branch idea" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeNode(node.id)} className="size-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${node.label || 'branch'}`}><Trash2 className="size-3" /></Button>
                  </div>
                  <select aria-label={`Where ${node.label || 'this branch'} branches from`} value={node.parentId || 'central'} onChange={(event) => updateNode(node.id, { parentId: event.target.value === 'central' ? null : event.target.value })} className="mt-1 h-7 w-full border-0 border-t border-current/15 bg-transparent px-1 font-code text-[8px] uppercase text-foreground outline-none focus-visible:ring-1">
                    <option value="central">From central idea</option>
                    {nodes.filter((candidate) => candidate.id !== node.id && !wouldCreateCycle(node.id, candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>From {candidate.label || 'untitled branch'}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="flex min-w-[620px] flex-wrap items-end gap-2 border-t border-current/15 pt-4">
            <label className="min-w-48 flex-1 text-xs font-medium">New branch grows from
              <select value={newBranchParentId} onChange={(event) => setNewBranchParentId(event.target.value)} className="mt-1 h-9 w-full border border-border/50 bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="central">Central idea</option>
                {nodes.map((node) => <option key={node.id} value={node.id}>{node.label || 'Untitled branch'}</option>)}
              </select>
            </label>
            <Button type="button" variant="outline" size="sm" onClick={addBranch} className="h-9 rounded-md"><Plus className="mr-2 size-4" /> Add branch</Button>
          </div>
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'timeline') {
    const timeline = current.timeline?.length ? current.timeline : [{ id: 'first', date: '', branch: '', title: '', detail: '' }];
    const updateEntry = (id: string, patch: Partial<WorkTimelineEntry>) => onChange({ ...current, timeline: timeline.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) });
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="overflow-x-auto p-5 sm:p-8">
          <div className="relative flex min-h-[440px] min-w-max items-center gap-6 px-8 before:absolute before:left-8 before:right-8 before:top-1/2 before:h-0.5 before:bg-accent/45">
            {timeline.map((entry, index) => <div key={entry.id} className={cn('relative z-10 w-56 shrink-0', index % 2 === 0 ? 'self-start pt-4' : 'self-end pb-4')}>
              <span className={cn('absolute left-1/2 size-4 -translate-x-1/2 rounded-full border-2 border-accent bg-background', index % 2 === 0 ? 'top-[212px]' : 'bottom-[212px]')} aria-hidden="true" />
              <div className="border border-current/20 bg-background/95 p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <Input aria-label="Timeline date or stage" value={entry.date} onChange={(event) => updateEntry(entry.id, { date: event.target.value })} placeholder="Date or stage" className="h-8 min-w-0 flex-1 border-0 border-b border-current/15 bg-transparent px-1 font-code text-[10px] font-bold uppercase shadow-none focus-visible:ring-1" />
                  {timeline.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ ...current, timeline: timeline.filter((item) => item.id !== entry.id) })} className="size-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove timeline event"><Trash2 className="size-3" /></Button>}
                </div>
                <Input aria-label="Timeline event" value={entry.title} onChange={(event) => updateEntry(entry.id, { title: event.target.value })} placeholder="What changed?" className="mt-2 h-9 border-0 bg-transparent px-1 font-headline text-base font-semibold italic shadow-none focus-visible:ring-1" />
                <Textarea aria-label="Timeline event context" value={entry.detail} onChange={(event) => updateEntry(entry.id, { detail: event.target.value })} placeholder="Why does this moment matter?" className="mt-1 min-h-20 resize-none border-0 bg-transparent px-1 text-xs leading-5 shadow-none focus-visible:ring-1" />
                <Input aria-label="Timeline branch" value={entry.branch || ''} onChange={(event) => updateEntry(entry.id, { branch: event.target.value })} placeholder="Branch or track" className="mt-2 h-7 border border-current/15 bg-current/5 text-xs shadow-none" />
              </div>
            </div>)}
            <Button type="button" variant="outline" size="icon" onClick={() => onChange({ ...current, timeline: [...timeline, { id: crypto.randomUUID(), date: '', branch: '', title: '', detail: '' }] })} className="relative z-10 size-10 shrink-0 rounded-full bg-background" aria-label="Add timeline event"><Plus className="size-4" /></Button>
          </div>
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'comparison_matrix') {
    const legacyOptions = (current.fields.options || '').split('\n').map((value) => value.trim()).filter(Boolean);
    const legacyCriteria = (current.fields.criteria || '').split('\n').map((value) => value.trim()).filter(Boolean);
    const optionCount = Math.min(4, Math.max(2, Number(current.fields.matrix_option_count) || legacyOptions.length || 2));
    const criterionCount = Math.min(6, Math.max(2, Number(current.fields.matrix_criterion_count) || legacyCriteria.length || 3));
    const options = Array.from({ length: optionCount }, (_, index) => current.fields[`matrix_option_${index}`] || legacyOptions[index] || '');
    const criteria = Array.from({ length: criterionCount }, (_, index) => current.fields[`matrix_criterion_${index}`] || legacyCriteria[index] || '');
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="space-y-5 overflow-x-auto p-5 sm:p-8">
          <div className="min-w-[680px] overflow-hidden border border-current/20">
            <div className="grid bg-current/5" style={{ gridTemplateColumns: `180px repeat(${optionCount}, minmax(150px, 1fr))` }}>
              <div className="border-b border-r border-current/15 p-3 font-code text-[9px] font-bold uppercase tracking-[0.16em] opacity-60">Criteria</div>
              {options.map((option, optionIndex) => (
                <div key={optionIndex} className="border-b border-r border-current/15 p-2 last:border-r-0">
                  <Input value={option} onChange={(event) => updateFields(`matrix_option_${optionIndex}`, event.target.value)} placeholder={`Option ${optionIndex + 1}`} aria-label={`Comparison option ${optionIndex + 1}`} className="h-9 border-0 bg-transparent text-center font-headline font-semibold italic shadow-none focus-visible:ring-1" />
                </div>
              ))}
              {criteria.map((criterion, criterionIndex) => (
                <Fragment key={criterionIndex}>
                  <div className="border-b border-r border-current/15 p-2">
                    <Input value={criterion} onChange={(event) => updateFields(`matrix_criterion_${criterionIndex}`, event.target.value)} placeholder={`Criterion ${criterionIndex + 1}`} aria-label={`Comparison criterion ${criterionIndex + 1}`} className="h-10 border-0 bg-transparent font-semibold shadow-none focus-visible:ring-1" />
                  </div>
                  {options.map((_, optionIndex) => (
                    <div key={optionIndex} className="min-h-24 border-b border-r border-current/15 p-2 last:border-r-0">
                      <Textarea value={current.fields[`matrix_${criterionIndex}_${optionIndex}`] || ''} onChange={(event) => updateFields(`matrix_${criterionIndex}_${optionIndex}`, event.target.value)} placeholder="Compare here" aria-label={`${criterion || `Criterion ${criterionIndex + 1}`} for ${options[optionIndex] || `option ${optionIndex + 1}`}`} className="min-h-20 resize-none border-0 bg-transparent text-xs leading-5 shadow-none focus-visible:ring-1" />
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {optionCount < 4 && <Button type="button" variant="outline" size="sm" onClick={() => updateFields('matrix_option_count', String(optionCount + 1))}><Plus className="mr-2 size-4" /> Add option</Button>}
              {criterionCount < 6 && <Button type="button" variant="outline" size="sm" onClick={() => updateFields('matrix_criterion_count', String(criterionCount + 1))}><Plus className="mr-2 size-4" /> Add criterion</Button>}
            </div>
            <Input value={current.fields.conclusion || ''} onChange={(event) => updateFields('conclusion', event.target.value)} placeholder="What survives the comparison?" aria-label="Comparison conclusion" className="h-9 max-w-md border-accent/30 bg-accent/5" />
          </div>
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'two_column_debate') {
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="p-5 sm:p-8">
          <div className="grid overflow-hidden border border-current/20 md:grid-cols-2">
            <section className="relative min-h-64 border-b border-current/20 bg-accent/8 p-5 md:border-b-0 md:border-r">
              <span className="font-code text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Case for</span>
              <Textarea value={current.fields.for || ''} onChange={(event) => updateFields('for', event.target.value)} placeholder="Build the strongest case in favor." aria-label="Case for" className="mt-4 min-h-48 resize-none border-0 bg-transparent px-0 font-body text-sm leading-7 shadow-none focus-visible:ring-1" />
            </section>
            <section className="relative min-h-64 bg-foreground/5 p-5">
              <span className="font-code text-[10px] font-bold uppercase tracking-[0.2em] opacity-65">Case against</span>
              <Textarea value={current.fields.against || ''} onChange={(event) => updateFields('against', event.target.value)} placeholder="Give the objection equal force." aria-label="Case against" className="mt-4 min-h-48 resize-none border-0 bg-transparent px-0 font-body text-sm leading-7 shadow-none focus-visible:ring-1" />
            </section>
          </div>
          <section className="mx-auto -mt-px max-w-xl border border-accent/35 bg-background/95 p-4 text-center shadow-sm">
            <span className="font-code text-[9px] font-bold uppercase tracking-[0.18em] text-accent">What survives</span>
            <Textarea value={current.fields.judgement || ''} onChange={(event) => updateFields('judgement', event.target.value)} placeholder="State the judgment that remains after both sides are heard." aria-label="Working judgment" className="mt-2 min-h-24 resize-none border-0 bg-transparent text-center text-sm leading-6 shadow-none focus-visible:ring-1" />
          </section>
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'dialectic') {
    const stages = [
      { key: 'thesis', label: 'Initial claim', prompt: 'What do you initially think is true?' },
      { key: 'antithesis', label: 'Pressure', prompt: 'What is the strongest challenge?' },
      { key: 'synthesis', label: 'Revised view', prompt: 'What more precise view emerges?' },
    ];
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="grid gap-3 p-5 sm:p-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {stages.map((stage, index) => <Fragment key={stage.key}>
            <section className={cn('min-h-56 border p-4', index === 1 ? 'border-destructive/35 bg-destructive/5' : index === 2 ? 'border-accent/40 bg-accent/8' : 'border-current/20 bg-background/45')}>
              <span className="font-code text-[9px] font-bold uppercase tracking-[0.16em] opacity-65">{stage.label}</span>
              <Textarea value={current.fields[stage.key] || ''} onChange={(event) => updateFields(stage.key, event.target.value)} placeholder={stage.prompt} aria-label={stage.label} className="mt-3 min-h-40 resize-none border-0 bg-transparent px-0 text-sm leading-6 shadow-none focus-visible:ring-1" />
            </section>
            {index < stages.length - 1 && <ArrowRight className="hidden size-5 self-center text-accent md:block" aria-hidden="true" />}
          </Fragment>)}
        </div>
      </TemplateFrame>
    );
  }

  if (style === 'causal_chain') {
    const legacySteps = (current.fields.steps || '').split('\n').map((step) => step.trim()).filter(Boolean);
    const stepCount = Math.min(5, Math.max(1, Number(current.fields.step_count) || legacySteps.length || 2));
    const steps = Array.from({ length: stepCount }, (_, index) => current.fields[`step_${index}`] || legacySteps[index] || '');
    const updateStep = (index: number, value: string) => {
      const nextSteps = steps.map((step, cursor) => cursor === index ? value : step);
      onChange({ ...current, fields: { ...current.fields, [`step_${index}`]: value, steps: nextSteps.join('\n') } });
    };
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="overflow-x-auto p-5 sm:p-8">
          <div className="flex min-w-max items-center gap-3 py-6">
            <ChainNode label="Starting condition" value={current.fields.starting_condition || ''} onChange={(value) => updateFields('starting_condition', value)} placeholder="Where does it begin?" tone="accent" />
            {steps.map((step, index) => <Fragment key={index}><ArrowRight className="size-5 shrink-0 text-accent" aria-hidden="true" /><ChainNode label={`Link ${index + 1}`} value={step} onChange={(value) => updateStep(index, value)} placeholder="What follows, and why?" /></Fragment>)}
            <ArrowRight className="size-5 shrink-0 text-accent" aria-hidden="true" />
            <ChainNode label="Outcome" value={current.fields.outcome || ''} onChange={(value) => updateFields('outcome', value)} placeholder="What result appears?" tone="accent" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-4">
            <Input value={current.fields.weak_link || ''} onChange={(event) => updateFields('weak_link', event.target.value)} placeholder="Mark the weakest link in this chain" aria-label="Weakest causal link" className="h-9 max-w-lg border-destructive/25 bg-destructive/5" />
            <div className="flex gap-2">{stepCount > 1 && <Button type="button" variant="outline" size="sm" onClick={() => updateFields('step_count', String(stepCount - 1))}>Remove link</Button>}{stepCount < 5 && <Button type="button" variant="outline" size="sm" onClick={() => updateFields('step_count', String(stepCount + 1))}><Plus className="mr-2 size-4" /> Add link</Button>}</div>
          </div>
        </div>
      </TemplateFrame>
    );
  }

  const format = FORMAT_COPY[style];
  return (
    <TemplateFrame title={format.title} purpose={format.purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
      <div className="grid gap-4 p-5 sm:p-8">
        {format.fields.map((field) => <WorkField key={field.key} field={field} value={current.fields[field.key] || ''} onChange={(value) => updateFields(field.key, value)} />)}
      </div>
    </TemplateFrame>
  );
}

function TemplateFrame({ title, purpose, tone, patternStyle, widthClass, children, embedded }: { title: string; purpose: string; tone: string; patternStyle: CSSProperties; widthClass: string; children: ReactNode; embedded: boolean }) {
  return <div className={cn(!embedded && 'h-full min-h-0 overflow-y-auto bg-muted/10 p-4 sm:p-8')}><section className={cn('mx-auto w-full border border-current/20', !embedded && 'min-h-full shadow-sm', widthClass, tone)} style={patternStyle}><header className="border-b border-current/15 px-5 py-4 sm:px-8"><h2 className="font-headline text-2xl font-bold italic">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 opacity-70">{purpose}</p></header>{children}</section></div>;
}

function WorkField({ field, value, onChange }: { field: FieldDefinition; value: string; onChange: (value: string) => void }) {
  return <section className="border border-current/15 bg-background/35 p-4"><label className="font-code text-[9px] font-bold uppercase tracking-[0.16em] opacity-65">{field.label}</label>{field.multiline ? <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.prompt} className="mt-3 min-h-28 border-0 bg-transparent px-0 text-sm leading-6 shadow-none focus-visible:ring-0" /> : <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.prompt} className="mt-3 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />}</section>;
}

function ChainNode({ label, value, onChange, placeholder, tone }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; tone?: 'accent' }) {
  return <section className={cn('w-44 shrink-0 border border-current/20 bg-background/70 p-3 shadow-sm', tone === 'accent' && 'border-accent/45 bg-accent/8')}><label className="font-code text-[8px] font-bold uppercase tracking-[0.15em] opacity-60">{label}</label><Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-24 resize-none border-0 bg-transparent px-0 text-sm leading-5 shadow-none focus-visible:ring-1" /></section>;
}
