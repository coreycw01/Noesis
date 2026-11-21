import type { Concept } from '@/lib/types';

/**
 * The boundary caliper, from the prototype: the concept is a region, its
 * examples sit inside the line, its counterexamples outside, and the
 * neighbours it must not collapse into sit on the edge.
 */
export function ConceptCaliper({ concept }: { concept: Concept }) {
  const inside = (concept.examples || []).filter((item) => item.trim()).slice(0, 8);
  const outside = (concept.counterexamples || []).filter((item) => item.trim()).slice(0, 8);
  const edge = (concept.notSameAs || []).filter((item) => item.trim()).slice(0, 6);
  if (!inside.length && !outside.length && !edge.length) {
    return <p className="text-sm text-muted-foreground">Add examples and counterexamples below to draw where {concept.name} begins and ends.</p>;
  }
  const W = 720; const H = 320; const cx = W / 2; const cy = H / 2;
  const rx = 150 + inside.length * 6; const ry = 92 + inside.length * 4;
  const place = (items: string[], radiusX: number, radiusY: number, offset: number) => items.map((text, index) => {
    const angle = (index / Math.max(1, items.length)) * Math.PI * 2 + offset;
    return { text, x: cx + Math.cos(angle) * radiusX, y: cy + Math.sin(angle) * radiusY };
  });
  const label = (text: string) => text.length > 26 ? `${text.slice(0, 25)}…` : text;
  return (
    <figure className="noesis-caliper">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Boundary of ${concept.name}: ${inside.length} inside, ${outside.length} outside, ${edge.length} on the edge`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="hsl(var(--stage-examine) / .12)" stroke="hsl(var(--stage-examine))" strokeWidth="1.6" strokeDasharray={concept.philosophyStatus === 'contested' ? '7 5' : undefined} />
        <text x={cx} y={cy + 6} textAnchor="middle" className="fill-foreground font-headline text-2xl italic">{concept.name}</text>
        {place(inside, rx * 0.55, ry * 0.55, -Math.PI / 2).map((item) => (
          <g key={`in-${item.text}`}><circle cx={item.x} cy={item.y - 14} r="4" fill="hsl(var(--stage-act))" /><text x={item.x} y={item.y + 4} textAnchor="middle" className="fill-foreground text-xs">{label(item.text)}</text></g>
        ))}
        {place(edge, rx, ry, -Math.PI / 3).map((item) => (
          <g key={`edge-${item.text}`}><rect x={item.x - 4} y={item.y - 4} width="8" height="8" transform={`rotate(45 ${item.x} ${item.y})`} fill="hsl(var(--stage-encounter))" /><text x={item.x} y={item.y - 10} textAnchor="middle" className="fill-[hsl(var(--stage-encounter))] text-xs">≠ {label(item.text)}</text></g>
        ))}
        {place(outside, rx + 120, ry + 50, Math.PI / 5).map((item) => (
          <g key={`out-${item.text}`}><circle cx={item.x} cy={item.y - 14} r="4" fill="none" stroke="hsl(var(--stage-claim))" strokeWidth="1.5" /><text x={item.x} y={item.y + 4} textAnchor="middle" className="fill-muted-foreground text-xs">{label(item.text)}</text></g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span><b className="text-[hsl(var(--stage-act))]">●</b> inside: examples</span>
        <span><b className="text-[hsl(var(--stage-claim))]">○</b> outside: counterexamples</span>
        <span><b className="text-[hsl(var(--stage-encounter))]">◆</b> on the edge: not the same as</span>
      </figcaption>
    </figure>
  );
}
