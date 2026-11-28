import type { conceptRelated } from '@/lib/readex';
import { NOESIS_ICONS } from '@/lib/noesis-icons';

const collections = [
  ['sources', 'Sources', 'source'], ['annotations', 'Annotations', 'annotation'],
  ['questions', 'Inquiries', 'inquiry'], ['beliefs', 'Positions', 'position'],
  ['drafts', 'Works', 'work'], ['practices', 'Praxis', 'practice'],
] as const;

type Related = ReturnType<typeof conceptRelated>;

export function conceptConnectionCounts(related: Related) {
  return collections.map(([key, label, icon]) => ({ key, label, icon, count: related[key].length }));
}

export function ConceptConnectionStrip({ related }: { related: Related }) {
  const counts = conceptConnectionCounts(related);
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  return (
    <ul aria-label="Related records by collection" className="grid grid-cols-6 gap-2">
      {counts.map(({ key, label, icon, count }) => {
        const Icon = NOESIS_ICONS[icon];
        return (
          <li key={key} data-tone={icon} title={`${label}: ${count} of ${total} related records`} className="min-w-0 text-tone">
            <span className="sr-only">{label}: {count}</span>
            <span aria-hidden="true" className="flex items-center justify-center gap-1 text-xs tabular-nums"><Icon className="size-3.5 shrink-0" />{count}</span>
            <span aria-hidden="true" className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-current" style={{ width: `${total ? count / total * 100 : 0}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
