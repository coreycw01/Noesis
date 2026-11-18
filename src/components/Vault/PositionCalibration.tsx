"use client";

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Concept, Media, Question, VaultEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const ZONES = [
  { upTo: 20, label: 'Tentative' },
  { upTo: 40, label: 'Low' },
  { upTo: 60, label: 'Moderate' },
  { upTo: 80, label: 'Strong' },
  { upTo: 100, label: 'Very strong' },
];

export function zoneLabel(percent: number) {
  return (ZONES.find((zone) => percent <= zone.upTo) || ZONES[ZONES.length - 1]).label;
}

/**
 * Where the recorded evidence would put this position, from 0 to 100: the
 * share of recorded items that support it. Challenges pull it down, so an
 * unanswered objection visibly lightens the scale. Null when nothing is recorded.
 */
export function evidenceBalance(supportCount: number, challengeCount: number) {
  const total = supportCount + challengeCount;
  if (!total) return null;
  return Math.round((supportCount / total) * 100);
}

/**
 * The calibration gauge: stated confidence against what the record supports.
 * Five labeled zones, a solid marker for what you say, a hollow marker for
 * what the evidence balance suggests, and the gap between them in words.
 */
export function PositionCalibrationGauge({ confidence, supportCount, challengeCount }: { confidence: number; supportCount: number; challengeCount: number }) {
  const earned = evidenceBalance(supportCount, challengeCount);
  const gap = earned === null ? null : confidence - earned;
  const verdict = earned === null
    ? 'Nothing recorded yet. Add support and a serious challenge to calibrate.'
    : Math.abs(gap!) <= 10
      ? 'Calibrated: your confidence matches the recorded evidence.'
      : gap! > 0
        ? `Running ${gap} points ahead of the evidence. Add support or lower confidence.`
        : `Running ${-gap!} points behind the evidence. You may be underclaiming.`;
  return (
    <div className="noesis-calibration" data-stage-tone="claim">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-code text-[8px] uppercase tracking-widest text-muted-foreground">Calibration</span>
        <span className="font-headline text-lg font-semibold italic">{confidence}% <span className="text-xs not-italic text-muted-foreground">{zoneLabel(confidence).toLowerCase()}</span></span>
      </div>
      <div className="noesis-calibration__track" role="img" aria-label={`Stated confidence ${confidence} percent${earned === null ? '' : `; evidence balance ${earned} percent`}`}>
        {ZONES.map((zone, index) => <span key={zone.label} className="noesis-calibration__zone" style={{ opacity: 0.14 + index * 0.09 }} />)}
        {earned !== null && (
          <span className="noesis-calibration__gap" style={{ left: `${Math.min(confidence, earned)}%`, width: `${Math.abs(confidence - earned)}%` }} />
        )}
        {earned !== null && <span className="noesis-calibration__earned" style={{ left: `${earned}%` }} title={`Evidence balance ${earned}%`} />}
        <span className="noesis-calibration__stated" style={{ left: `${confidence}%` }} title={`Stated ${confidence}%`} />
      </div>
      <div className="noesis-calibration__labels" aria-hidden="true">
        {ZONES.map((zone) => <span key={zone.label}>{zone.label}</span>)}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 font-code text-[8px] uppercase tracking-widest text-muted-foreground">
        <span><span className="noesis-calibration__key noesis-calibration__key--stated" />Stated</span>
        <span><span className="noesis-calibration__key noesis-calibration__key--earned" />Evidence {earned === null ? '—' : `${earned}%`}</span>
        <span>{supportCount} for · {challengeCount} against</span>
      </div>
      <p className={cn('mt-2 text-xs leading-5', earned !== null && Math.abs(gap!) > 10 ? 'text-foreground' : 'text-muted-foreground')}>{verdict}</p>
    </div>
  );
}

type PullKind = 'annotation' | 'source' | 'concept' | 'inquiry' | 'position';
interface PullRecord { key: string; kind: PullKind; title: string; detail: string; text: string }

const KIND_LABELS: Record<PullKind, string> = {
  annotation: 'Annotations',
  source: 'Sources',
  concept: 'Concepts',
  inquiry: 'Inquiries',
  position: 'Other positions',
};

/** Search the workspace and pull an existing record in as evidence. */
export function PullEvidenceDialog({ open, onOpenChange, side, media, concepts, questions, positions, excludePositionId, onPick }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'for' | 'against';
  media: Media[];
  concepts: Concept[];
  questions: Question[];
  positions: VaultEntry[];
  excludePositionId?: string;
  onPick: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<PullKind | 'all'>('all');
  const records = useMemo<PullRecord[]>(() => [
    ...media.flatMap((source) => (source.annotations || []).map((annotation) => ({
      key: `annotation:${annotation.id}`,
      kind: 'annotation' as const,
      title: annotation.text,
      detail: source.title,
      text: `“${annotation.text}” (${source.title})`,
    }))),
    ...media.map((source) => ({
      key: `source:${source.id}`,
      kind: 'source' as const,
      title: source.title,
      detail: source.creator || source.type,
      text: `${source.title}${source.creator ? `, ${source.creator}` : ''}${source.capture?.after?.coreArgument ? `: ${source.capture.after.coreArgument}` : ''}`,
    })),
    ...concepts.map((concept) => ({
      key: `concept:${concept.id}`,
      kind: 'concept' as const,
      title: concept.name,
      detail: concept.description || '',
      text: `${concept.name}${concept.description ? `: ${concept.description}` : ''}`,
    })),
    ...questions.map((question) => ({
      key: `inquiry:${question.id}`,
      kind: 'inquiry' as const,
      title: question.text,
      detail: question.answer || question.status.replace(/_/g, ' '),
      text: question.answer ? `${question.text} Working answer: ${question.answer}` : question.text,
    })),
    ...positions.filter((position) => position.id !== excludePositionId).map((position) => ({
      key: `position:${position.id}`,
      kind: 'position' as const,
      title: position.title,
      detail: position.statement || '',
      text: `${position.title}${position.statement && position.statement !== position.title ? `: ${position.statement}` : ''}`,
    })),
  ].filter((record) => record.title?.trim()), [media, concepts, questions, positions, excludePositionId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => (kind === 'all' || record.kind === kind) && (!needle || `${record.title} ${record.detail}`.toLowerCase().includes(needle))).slice(0, 40);
  }, [records, query, kind]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(86dvh,44rem)] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Pull evidence {side === 'for' ? 'for' : 'against'} this position</DialogTitle>
          <DialogDescription>Search your own records. The one you choose is quoted with its origin; you can edit it afterward.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search annotations, sources, concepts, inquiries" aria-label="Search records" className="pl-9" />
          </div>
          <Select value={kind} onValueChange={(value) => setKind(value as PullKind | 'all')}>
            <SelectTrigger className="w-[11rem]" aria-label="Record type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All records</SelectItem>
              {(Object.keys(KIND_LABELS) as PullKind[]).map((key) => <SelectItem key={key} value={key}>{KIND_LABELS[key]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ul className="-mx-1 max-h-[24rem] space-y-1 overflow-y-auto px-1">
          {visible.map((record) => (
            <li key={record.key}>
              <button
                type="button"
                onClick={() => { onPick(record.text); onOpenChange(false); setQuery(''); }}
                className="grid w-full gap-0.5 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-code text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{KIND_LABELS[record.kind]}{record.detail ? ` · ${record.detail.slice(0, 70)}` : ''}</span>
                <span className="line-clamp-2 text-sm">{record.title}</span>
              </button>
            </li>
          ))}
          {!visible.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No records match that search.</li>}
        </ul>
        <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button></div>
      </DialogContent>
    </Dialog>
  );
}
