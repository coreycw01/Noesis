"use client";

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The shared anatomy of every item detail (Concept, Inquiry, Position, Praxis):
 * Overview → Tools → Workbench → Footer. These pieces keep the landmarks in
 * the same place and the same style; each item keeps its own instrument.
 */

export interface RecordTool {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

/** One slim row of what you can do here. The first tool is the main action. */
export function RecordTools({ tools, trailing, label = 'Tools' }: { tools: RecordTool[]; trailing?: React.ReactNode; label?: string }) {
  if (!tools.length && !trailing) return null;
  return (
    <div className="noesis-record-tools" role="toolbar" aria-label={label}>
      <div className="noesis-record-tools__actions">
        {tools.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <Button key={tool.label} variant={index === 0 ? 'secondary' : 'outline'} disabled={tool.disabled} onClick={tool.onClick}>
              {Icon && <Icon className="size-3.5" aria-hidden="true" />}
              {tool.label}
            </Button>
          );
        })}
      </div>
      {trailing && <div className="noesis-record-tools__trailing">{trailing}</div>}
    </div>
  );
}

/** One quiet next move: a short text link, never a required step. */
export function NextMove({ text, actionLabel, onClick }: { text: string; actionLabel?: string; onClick?: () => void }) {
  if (!text.trim()) return null;
  return (
    <p className="noesis-next-move">
      <span className="noesis-next-move__label">Next</span>
      {onClick
        ? <button type="button" onClick={onClick}>{text}{actionLabel ? ` · ${actionLabel}` : ''}<ArrowRight className="size-3.5" aria-hidden="true" /></button>
        : <span>{text}</span>}
    </p>
  );
}

/** Footer: dates, provenance, related records and history, folded away. */
export function RecordFooter({ children, label = 'Record details' }: { children: React.ReactNode; label?: string }) {
  return (
    <footer className="noesis-record-footer" aria-label={label}>
      {children}
    </footer>
  );
}

/** A footer disclosure. Long lists stay out of the working area until opened. */
export function FooterSection({ title, count, children, defaultOpen = false }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="noesis-footer-section" open={defaultOpen}>
      <summary>{title}{typeof count === 'number' && <span className="noesis-footer-section__count">{count}</span>}</summary>
      <div className="noesis-footer-section__body">{children}</div>
    </details>
  );
}
