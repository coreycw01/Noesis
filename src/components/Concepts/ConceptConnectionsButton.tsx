"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { NOESIS_ICONS } from '@/lib/noesis-icons';
import { viewToPath } from '@/lib/noesis-routes';
import type { conceptRelated } from '@/lib/readex';
import { conceptConnectionCounts } from './ConceptConnectionStrip';

type Related = ReturnType<typeof conceptRelated>;

function RecordGroups({ related, onNavigate }: { related: Related; onNavigate: () => void }) {
  const reviewMode = /^\/(demo|review)(\/|$)/.test(usePathname() || '');
  const groups = {
    sources: related.sources.map(s => [s.title, viewToPath('library', { reviewMode, sourceId: s.id })]),
    annotations: related.annotations.map(a => [a.text || 'Untitled annotation', viewToPath('annotations', { reviewMode, annotationSourceId: a.source.id, annotationId: a.id }), a.source.title]),
    questions: related.questions.map(q => [q.text, viewToPath('questions', { reviewMode, questionId: q.id })]),
    beliefs: related.beliefs.map(p => [p.title || p.statement, viewToPath('vault', { reviewMode, positionId: p.id })]),
    drafts: related.drafts.map(w => [w.title || 'Untitled work', viewToPath('writing', { reviewMode, workId: w.id })]),
    practices: related.practices.map(p => [p.title, viewToPath('labs', { reviewMode, practiceId: p.id })]),
  };
  const visible = conceptConnectionCounts(related).filter(group => group.count > 0);
  return (
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      {!visible.length && <p className="text-sm text-muted-foreground">No related records yet.</p>}
      {visible.map(({ key, label, icon, count }, index) => {
        const Icon = NOESIS_ICONS[icon];
        return <details key={key} open={index === 0} data-tone={icon} className="border-t border-border">
          <summary className="min-h-11 cursor-pointer content-center text-sm text-tone">
            <Icon aria-hidden="true" className="mx-1 inline size-4" /> {label} <span className="tabular-nums">{count}</span>
          </summary>
          <ul className="mb-2 pl-5">
            {groups[key].map(([title, href, source]) => <li key={href}>
              <Link href={href} prefetch={false} onNavigate={onNavigate} className="flex min-h-11 flex-col justify-center break-words py-1 text-sm underline decoration-border underline-offset-4 hover:decoration-current">
                {title}{source && <small className="text-muted-foreground">{source}</small>}
              </Link>
            </li>)}
          </ul>
        </details>;
      })}
    </div>
  );
}

export function ConceptConnectionsButton({ name, related, count }: { name: string; related: Related; count: number }) {
  const [open, setOpen] = useState(false);
  const label = `${count} related ${count === 1 ? 'record' : 'records'}`;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button type="button" aria-label={`View ${label} for ${name}`} className="relative z-10 inline-flex min-h-8 items-center gap-1 rounded-sm text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <NOESIS_ICONS.connection aria-hidden="true" className="size-3.5" />{label}
      </button>
    </DialogTrigger>
    <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)]">
      <DialogHeader>
        <DialogTitle className="break-words">{name}: related records</DialogTitle>
        <DialogDescription>{label}, including direct matches and connections through shared sources, positions or works.</DialogDescription>
      </DialogHeader>
      {open && <RecordGroups related={related} onNavigate={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>;
}
