'use client';

import { ContextualAiDocument } from './ContextualAiPanel';
import { AiProvenanceBadge } from './AiProvenanceBadge';
import type { DeskFinding, DeskFindingType } from '@/lib/context-desk-handoff';

export function DeskFindings({ type, id, findings }: { type: DeskFindingType; id: string; findings?: DeskFinding[] }) {
  if (!findings?.length) return null;
  return <details className="mb-3 border-l border-border pl-3 text-sm">
    <summary className="min-h-9 cursor-pointer py-2 font-medium">From Context Desk ({findings.length})</summary>
    <ul className="space-y-3 pb-2">
      {[...findings].reverse().map(finding => <li key={finding.id} className="break-words border-t border-border pt-2">
        <AiProvenanceBadge provenance={{ kind: 'ai-assisted', provenanceId: finding.id }} target={{ type, id, fieldPath: 'contextDeskFindings.content', subrecordId: finding.id }} title="Context Desk finding" />
        <ContextualAiDocument content={finding.content} />
      </li>)}
    </ul>
  </details>;
}
