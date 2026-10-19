"use client";

import { Plus, Trash2 } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { DocumentPaperPattern, WorkMindMapNode, WorkTemplateData, WorkTimelineEntry, WorkToolKind, WritingStyle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type StructuredWorkStyle = WorkToolKind;

type FieldDefinition = { key: string; label: string; prompt: string; multiline?: boolean };

const FORMAT_COPY: Record<StructuredWorkStyle, { title: string; purpose: string; fields: FieldDefinition[] }> = {
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

  if (style === 'venn_diagram') {
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input aria-label="First idea" value={current.fields.left_label || ''} onChange={(event) => updateFields('left_label', event.target.value)} placeholder="First idea" className="bg-background/55" />
            <Input aria-label="Second idea" value={current.fields.right_label || ''} onChange={(event) => updateFields('right_label', event.target.value)} placeholder="Second idea" className="bg-background/55" />
          </div>
          <div className="relative mx-auto mt-6 grid min-h-[460px] max-w-3xl place-items-center overflow-hidden">
            <div className="absolute left-[5%] top-8 flex size-[68%] max-h-[390px] max-w-[390px] flex-col rounded-full border-2 border-accent/45 bg-accent/5 p-10 pr-20 sm:p-14 sm:pr-24">
              <label className="font-code text-[9px] font-bold uppercase tracking-[0.16em] opacity-60">Only {current.fields.left_label || 'the first'}</label>
              <Textarea value={current.fields.left_only || ''} onChange={(event) => updateFields('left_only', event.target.value)} placeholder="Distinct qualities, evidence, or implications" className="mt-3 min-h-44 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" />
            </div>
            <div className="absolute right-[5%] top-8 flex size-[68%] max-h-[390px] max-w-[390px] flex-col rounded-full border-2 border-foreground/25 bg-background/45 p-10 pl-20 sm:p-14 sm:pl-24">
              <label className="text-right font-code text-[9px] font-bold uppercase tracking-[0.16em] opacity-60">Only {current.fields.right_label || 'the second'}</label>
              <Textarea value={current.fields.right_only || ''} onChange={(event) => updateFields('right_only', event.target.value)} placeholder="Distinct qualities, evidence, or implications" className="mt-3 min-h-44 resize-none border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0" />
            </div>
            <div className="relative z-10 w-[32%] min-w-36 text-center">
              <label className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-accent">Shared ground</label>
              <Textarea value={current.fields.shared || ''} onChange={(event) => updateFields('shared', event.target.value)} placeholder="What genuinely overlaps?" className="mt-3 min-h-36 resize-none border border-accent/25 bg-background/80 text-center text-sm shadow-sm" />
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
    return (
      <TemplateFrame title={FORMAT_COPY[style].title} purpose={FORMAT_COPY[style].purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
        <div className="space-y-5 p-5 sm:p-8">
          <div className="border-2 border-accent bg-background/70 p-4 text-center">
            <label className="font-code text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Central idea</label>
            <Input value={current.fields.central || ''} onChange={(event) => updateFields('central', event.target.value)} placeholder="Name the idea" className="mt-2 h-auto border-0 bg-transparent px-0 text-center font-headline text-2xl font-bold italic shadow-none focus-visible:ring-0" />
          </div>

          <div className="space-y-2" aria-label="Mind map branches">
            {nodes.length === 0 && <p className="border border-dashed border-current/20 p-4 text-center text-sm opacity-60">Add a branch, then choose whether it grows from the central idea or another branch.</p>}
            {nodes.map((node) => {
              const depth = depthFor(node);
              return (
                <div key={node.id} className="grid gap-2 border border-current/15 bg-background/55 p-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]" style={{ marginLeft: `${Math.min(depth, 3) * 20}px` }}>
                  <Input value={node.label} onChange={(event) => updateNode(node.id, { label: event.target.value })} placeholder="Related idea" className="h-9 border-border/50 bg-background/70 text-sm" aria-label="Branch idea" />
                  <select
                    aria-label={`Where ${node.label || 'this branch'} branches from`}
                    value={node.parentId || 'central'}
                    onChange={(event) => updateNode(node.id, { parentId: event.target.value === 'central' ? null : event.target.value })}
                    className="h-9 w-full border border-border/50 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="central">From central idea</option>
                    {nodes.filter((candidate) => candidate.id !== node.id && !wouldCreateCycle(node.id, candidate.id)).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>From {candidate.label || 'untitled branch'}</option>
                    ))}
                  </select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeNode(node.id)} className="size-9 text-muted-foreground hover:text-destructive" aria-label={`Remove ${node.label || 'branch'}`}><Trash2 className="size-4" /></Button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-current/15 pt-4">
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
        <div className="relative space-y-5 p-5 sm:p-8 before:absolute before:bottom-8 before:left-[2.05rem] before:top-8 before:w-px before:bg-accent/45 sm:before:left-[3.55rem]">
          {timeline.map((entry) => <div key={entry.id} className="relative grid gap-3 pl-8 sm:grid-cols-[120px_120px_1fr_auto] sm:pl-16">
            <span className="absolute left-0 top-3 size-3 border-2 border-accent bg-background" aria-hidden="true" />
            <Input aria-label="Timeline date or stage" value={entry.date} onChange={(event) => updateEntry(entry.id, { date: event.target.value })} placeholder="Date or stage" className="h-9 border-border/60 bg-background/50 text-sm" />
            <Input aria-label="Timeline branch" value={entry.branch || ''} onChange={(event) => updateEntry(entry.id, { branch: event.target.value })} placeholder="Branch or track" className="h-9 border-border/60 bg-background/50 text-sm" />
            <div className="space-y-2"><Input aria-label="Timeline event" value={entry.title} onChange={(event) => updateEntry(entry.id, { title: event.target.value })} placeholder="What changed?" className="h-9 border-border/60 bg-background/50 font-medium" /><Textarea aria-label="Timeline event context" value={entry.detail} onChange={(event) => updateEntry(entry.id, { detail: event.target.value })} placeholder="Why does this moment matter?" className="min-h-20 border-border/60 bg-background/50 text-sm leading-6" /></div>
            {timeline.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ ...current, timeline: timeline.filter((item) => item.id !== entry.id) })} className="size-9 rounded-md text-muted-foreground hover:text-destructive" aria-label="Remove timeline event"><Trash2 className="size-4" /></Button>}
          </div>)}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...current, timeline: [...timeline, { id: crypto.randomUUID(), date: '', branch: '', title: '', detail: '' }] })} className="ml-8 rounded-md sm:ml-16"><Plus className="mr-2 size-4" /> Add event</Button>
        </div>
      </TemplateFrame>
    );
  }

  const format = FORMAT_COPY[style];
  const mainFields = style === 'two_column_debate' ? format.fields.slice(0, 2) : format.fields;
  const closingField = style === 'two_column_debate' ? format.fields[2] : undefined;
  return (
    <TemplateFrame title={format.title} purpose={format.purpose} tone={paperTone[paperColor]} patternStyle={paperPatternStyle(paperColor, paperPattern)} widthClass={widthClass} embedded={embedded}>
      <div className={cn('grid gap-4 p-5 sm:p-8', style === 'two_column_debate' && 'md:grid-cols-2')}>
        {mainFields.map((field) => <WorkField key={field.key} field={field} value={current.fields[field.key] || ''} onChange={(value) => updateFields(field.key, value)} />)}
        {closingField && <div className="md:col-span-2"><WorkField field={closingField} value={current.fields[closingField.key] || ''} onChange={(value) => updateFields(closingField.key, value)} /></div>}
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
