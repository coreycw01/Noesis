'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type IntellectualRole = 'question' | 'claim' | 'assumption' | 'evidence' | 'definition' | 'note';
export type EvidenceDirection = 'supports' | 'contradicts' | 'qualifies' | 'uncertain';

export function EditorialSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('noesis-editorial-section', className)}>
      <header className="noesis-editorial-section__header">
        <div className="min-w-0">
          {eyebrow && <div className="readex-kicker">{eyebrow}</div>}
          <h2 className="noesis-editorial-section__title">{title}</h2>
          {description && <p className="noesis-editorial-section__description">{description}</p>}
        </div>
        {actions && <div className="noesis-editorial-section__actions">{actions}</div>}
      </header>
      <div className="noesis-editorial-section__body">{children}</div>
    </section>
  );
}

export function IntellectualRoleLabel({ role, children, className }: { role: IntellectualRole; children?: ReactNode; className?: string }) {
  return <span className={cn('noesis-intellectual-role', `noesis-intellectual-role--${role}`, className)}>{children || role}</span>;
}

export function EntityMeta({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn('noesis-entity-meta', className)}>
      {items.filter((item) => item.value !== undefined && item.value !== null && item.value !== '').map((item) => (
        <div key={item.label} className="noesis-entity-meta__row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContextRail({ title = 'Context', children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <aside className={cn('noesis-context-rail', className)}>
      <div className="readex-kicker">{title}</div>
      <div className="noesis-context-rail__body">{children}</div>
    </aside>
  );
}

export function EvidenceRow({
  direction,
  source,
  excerpt,
  meta,
  className,
}: {
  direction: EvidenceDirection;
  source?: ReactNode;
  excerpt: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn('noesis-evidence-row', `noesis-evidence-row--${direction}`, className)}>
      <div className="noesis-evidence-row__direction">{direction}</div>
      <div className="min-w-0">
        {source && <div className="noesis-evidence-row__source">{source}</div>}
        <div className="noesis-evidence-row__excerpt">{excerpt}</div>
        {meta && <div className="noesis-evidence-row__meta">{meta}</div>}
      </div>
    </article>
  );
}

export function RelationshipList({
  items,
  empty,
  className,
}: {
  items: Array<{ id: string; relation: string; title: ReactNode; meta?: ReactNode; onClick?: () => void }>;
  empty: string;
  className?: string;
}) {
  if (!items.length) return <p className={cn('noesis-inline-empty', className)}>{empty}</p>;

  return (
    <div className={cn('noesis-relationship-list', className)}>
      {items.map((item) => {
        const content = (
          <>
            <span className="noesis-relationship-list__relation">{item.relation}</span>
            <span className="min-w-0">
              <span className="noesis-relationship-list__title">{item.title}</span>
              {item.meta && <span className="noesis-relationship-list__meta">{item.meta}</span>}
            </span>
          </>
        );
        return item.onClick ? (
          <button key={item.id} type="button" onClick={item.onClick} className="noesis-relationship-list__row">{content}</button>
        ) : (
          <div key={item.id} className="noesis-relationship-list__row">{content}</div>
        );
      })}
    </div>
  );
}

export function RevisionEvent({
  date,
  action,
  description,
  current,
  className,
}: {
  date: ReactNode;
  action: ReactNode;
  description?: ReactNode;
  current?: boolean;
  className?: string;
}) {
  return (
    <article className={cn('noesis-revision-event', current && 'is-current', className)}>
      <div className="noesis-revision-event__marker" aria-hidden="true" />
      <time className="noesis-revision-event__date">{date}</time>
      <div className="min-w-0">
        <div className="noesis-revision-event__action">{action}</div>
        {description && <div className="noesis-revision-event__description">{description}</div>}
      </div>
    </article>
  );
}

