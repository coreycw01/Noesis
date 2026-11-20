"use client";

import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Pill } from '@/components/ui/pill';
import { DetailLabel } from '@/components/shared/PageHeader';
import type { BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export { RecordFooter, FooterSection } from '@/components/shared/RecordDetail';

type StageTone = 'encounter' | 'outline' | 'examine' | 'claim' | 'act' | 'integrate' | 'more';

/**
 * The one page every record uses. Sets the stage tone for everything inside,
 * so buttons, pills, the path and the sections all take the record's colour.
 */
export function RecordPage({ tone, identity, className, children }: { tone: StageTone; identity?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('noesis-record noesis-gutter flex-1 w-full overflow-y-auto pb-8 pt-[var(--page-top)] font-body', className)} data-noesis-scroll-region data-noesis-identity={identity} data-stage-tone={tone}>
      {children}
    </div>
  );
}

/** Back link, label (kind · status), title, optional subtitle and tags, and the trailing tools (AI, menu). */
export function RecordHeader({ backLabel, onBack, view, kind, status, extra, title, subtitle, tags, onTag, trailing, children }: {
  backLabel: string;
  onBack: () => void;
  view: string;
  kind: string;
  status?: React.ReactNode;
  extra?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tags?: string[];
  onTag?: (tag: string) => void;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="noesis-record__header">
      <div className="noesis-record__top">
        <Button variant="link" onClick={onBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden="true" /> {backLabel}</Button>
        {trailing && <div className="noesis-record__top-actions">{trailing}</div>}
      </div>
      <DetailLabel view={view} kind={kind} status={status} extra={extra} />
      <h1 className="noesis-record__title noesis-page-title">{title}</h1>
      {subtitle && <p className="noesis-record__subtitle">{subtitle}</p>}
      {tags && tags.length > 0 && (
        <div className="noesis-record__tags">
          {tags.map((tag) => onTag
            ? <Pill key={tag} look="mono" tone="concept" onClick={() => onTag(tag)}>{tag}</Pill>
            : <Eyebrow key={tag} tone="concept">{tag}</Eyebrow>)}
        </div>
      )}
      {children}
    </header>
  );
}

export interface PathStop { id: string; label: string }

/**
 * The sticky path: named stops, no numbers, no percentages. `hereId` is
 * derived from the record's state by the page; the guide says what to do
 * there. Pressing a stop scrolls to its section.
 */
export function RecordPath({ stops, hereId, guide, label }: { stops: PathStop[]; hereId: string; guide: React.ReactNode; label: string }) {
  const hereIndex = Math.max(0, stops.findIndex((stop) => stop.id === hereId));
  return (
    <nav className="noesis-path" aria-label={label}>
      <ol>
        {stops.map((stop, index) => {
          const state = index < hereIndex ? 'seen' : index === hereIndex ? 'here' : 'ahead';
          return (
            <li key={stop.id} data-state={state}>
              <button type="button" className="noesis-path__stop" aria-current={state === 'here' ? 'step' : undefined} onClick={() => document.getElementById(stop.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
                <span className="noesis-path__dot" aria-hidden="true" />
                <span className="noesis-path__name">{stop.label}</span>
                <span className="noesis-path__tag" aria-hidden="true">{state === 'here' ? 'here' : state === 'seen' ? 'done' : ''}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="noesis-path__guide"><Eyebrow>You are here</Eyebrow><span>{guide}</span></p>
    </nav>
  );
}

/** One stop's section: a sheet with a title, a line of description, and tools that belong to it. */
export function RecordSection({ id, title, description, aside, here, className, children, headingLevel: Heading = 'h2' }: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  here?: boolean;
  className?: string;
  children: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
}) {
  return (
    <section id={id} className={cn('noesis-step', className)} data-here={here ? 'true' : undefined} aria-labelledby={`${id}-title`}>
      <div className="noesis-step__head">
        <Heading id={`${id}-title`} className="noesis-step__title">{title}</Heading>
        {aside && <div className="noesis-step__aside">{aside}</div>}
        {description && <p className="noesis-step__desc">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export interface Suggestion {
  id: string;
  tone: BadgeTone;
  title: string;
  /** The specific proposal, quoted. */
  quote?: string;
  /** Where it comes from, in a sentence. */
  because: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}

/**
 * Optional next steps, shown only when the page has a specific proposal
 * built from the record (a question from a challenge, a practice from the
 * strongest support). Never a generic "open an inquiry" button.
 */
export function SuggestionCards({ suggestions }: { suggestions: Suggestion[] }) {
  if (!suggestions.length) return null;
  return (
    <div className="noesis-suggest" aria-label="Suggested next steps">
      <Eyebrow size="sm">Suggested from what you&apos;ve recorded · optional</Eyebrow>
      <div className="noesis-suggest__grid">
        {suggestions.map((item) => (
          <div key={item.id} className="noesis-suggest__card" data-tone={item.tone}>
            <h3>{item.title}</h3>
            {item.quote && <p className="noesis-suggest__quote">“{item.quote}”</p>}
            <p>{item.because}</p>
            <div><Button variant="secondary" tone={item.tone} size="sm" disabled={item.disabled} onClick={item.onAction}>{item.actionLabel}</Button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A row: text (with optional meta line), then its tools, then an optional remove ×. */
export function Row({ lead, meta, children, tools, onRemove, removeLabel = 'Remove', disabled, top, className }: {
  lead?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  tools?: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  top?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('noesis-row', top && 'noesis-row--top', className)}>
      {lead}
      <span className="noesis-row__text">{children}{meta && <small className="noesis-row__meta">{meta}</small>}</span>
      {tools}
      {onRemove && <button type="button" className="noesis-row__x" disabled={disabled} onClick={onRemove} aria-label={removeLabel} title={removeLabel}>×</button>}
    </div>
  );
}

/** Scrolls to a section once when `when` becomes true (used for route-driven focus). */
export function useScrollOnce(id: string | null | undefined, when: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || !id || done.current) return;
    done.current = true;
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [id, when]);
}
