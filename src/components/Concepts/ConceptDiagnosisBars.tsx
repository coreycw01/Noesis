import type { ConceptDiagnosis } from '@/lib/clarity';
import { cn } from '@/lib/utils';

/** Each diagnosis dimension as a fill from 0 to 1, with the move that would raise it. */
export function conceptDiagnosisBars(diagnosis: ConceptDiagnosis) {
  const level = { beginning: 0.15, developing: 0.45, strong: 0.75, integrated: 1 } as const;
  return [
    { key: 'clarity', label: 'Clarity', value: level[diagnosis.clarity], word: diagnosis.clarity, tone: 'examine', move: diagnosis.clarity === 'integrated' ? 'Clear and in use' : 'Sharpen the definition or add annotations' },
    { key: 'evidence', label: 'Evidence', value: level[diagnosis.evidence], word: diagnosis.evidence, tone: 'encounter', move: diagnosis.evidence === 'integrated' ? 'Well sourced' : 'Tag more sources with it' },
    { key: 'tension', label: 'Tension', value: { low: 0.15, medium: 0.55, high: 0.95 }[diagnosis.tension], word: diagnosis.tension, tone: 'claim', move: diagnosis.tension === 'low' ? 'No contradictions recorded' : 'Resolve the positions that pull against it' },
    { key: 'embodiment', label: 'Embodiment', value: { untested: 0.08, planned: 0.5, active: 1 }[diagnosis.embodiment], word: diagnosis.embodiment, tone: 'act', move: diagnosis.embodiment === 'active' ? 'Lived in a practice' : 'Test a position that uses it in Praxis' },
    { key: 'expression', label: 'Expression', value: { none: 0.08, draft: 0.5, published: 1 }[diagnosis.expression], word: diagnosis.expression, tone: 'more', move: diagnosis.expression === 'published' ? 'Expressed in a finished work' : 'Write about it in Works' },
  ];
}

export function ConceptDiagnosisBars({ diagnosis, compact = false }: { diagnosis: ConceptDiagnosis; compact?: boolean }) {
  const bars = conceptDiagnosisBars(diagnosis);
  if (compact) {
    return (
      <div className="noesis-diag-mini" role="img" aria-label={bars.map((bar) => `${bar.label} ${bar.word}`).join(', ')}>
        {bars.map((bar) => (
          <span key={bar.key} data-stage-tone={bar.tone} title={`${bar.label}: ${bar.word}`}>
            <i style={{ width: `${Math.round(bar.value * 100)}%` }} />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="noesis-diag">
      {bars.map((bar) => (
        <div key={bar.key} className="noesis-diag__row" data-stage-tone={bar.tone}>
          <span className="text-sm">{bar.label}</span>
          <span className="noesis-diag__track"><i style={{ width: `${Math.round(bar.value * 100)}%` }} /></span>
          <span className="font-code text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{bar.word}</span>
          <span className={cn('col-start-2 col-span-2 text-xs', bar.value >= 0.99 || (bar.key === 'tension' && bar.value < 0.2) ? 'text-muted-foreground' : 'text-foreground/80')}>→ {bar.move}</span>
        </div>
      ))}
    </div>
  );
}
