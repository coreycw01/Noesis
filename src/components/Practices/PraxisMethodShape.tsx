import type { PracticeType } from '@/lib/types';
import { cn } from '@/lib/utils';

export type PraxisShape = 'circle' | 'triangle' | 'square';

/**
 * Each way of acting has one shape, used everywhere a Praxis record appears:
 * a circle for upholding a principle (commitments and rules), a triangle for
 * testing an idea (experiments), and a square for building consistency
 * (practices and habits).
 */
export function praxisShapeFor(type: PracticeType | string): { shape: PraxisShape; tone: string; intent: string } {
  if (type === 'experiment' || type === 'observation' || type === 'challenge' || type === 'exposure') return { shape: 'triangle', tone: 'examine', intent: 'Test an idea' };
  if (type === 'commitment' || type === 'rule' || type === 'decision_rule' || type === 'restraint') return { shape: 'circle', tone: 'act', intent: 'Uphold a principle' };
  return { shape: 'square', tone: 'encounter', intent: 'Build consistency' };
}

export function PraxisMethodShape({ shape, state = 'kept', size = 18, className, title }: {
  shape: PraxisShape;
  state?: 'kept' | 'missed' | 'empty';
  size?: number;
  className?: string;
  title?: string;
}) {
  const fill = state === 'kept' ? 'hsl(var(--stage))' : 'none';
  const stroke = state === 'empty' ? 'hsl(var(--border))' : 'hsl(var(--stage))';
  const dash = state === 'missed' ? '3 2' : undefined;
  const common = { fill, stroke, strokeWidth: 1.6, strokeDasharray: dash, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={cn('shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {shape === 'circle' && <circle cx="10" cy="10" r="7.5" {...common} />}
      {shape === 'triangle' && <path d="M10 2.5 17.5 16.5h-15Z" {...common} />}
      {shape === 'square' && <rect x="3" y="3" width="14" height="14" rx="2" {...common} />}
    </svg>
  );
}

/**
 * The practice's run as a row of shapes, filled on logged days. It starts at
 * the start date (or the first log) (or covers the last fortnight when nothing is logged yet) and
 * spans the planned duration, so the strip and "n of m days" always agree.
 */
export function PraxisDayStrip({ shape, logDates, days, startDate, today = new Date() }: { shape: PraxisShape; logDates: string[]; days?: number; startDate?: string; today?: Date }) {
  const logged = new Set(logDates.map((date) => date.slice(0, 10)));
  const sorted = [...logged].sort();
  const span = Math.max(1, Math.min(days || 14, 30));
  const startDay = startDate?.slice(0, 10);
  const start = startDay && /^\d{4}-\d{2}-\d{2}$/.test(startDay) && (!sorted.length || startDay <= sorted[0]) ? new Date(`${startDay}T00:00:00Z`) : sorted.length ? new Date(`${sorted[0]}T00:00:00Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (span - 1)));
  const cells = Array.from({ length: span }, (_, index) => new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10));
  const count = cells.filter((date) => logged.has(date)).length;
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`Logged ${count} of ${span} days`}>
      {cells.map((date) => <PraxisMethodShape key={date} shape={shape} state={logged.has(date) ? 'kept' : 'empty'} size={10} />)}
    </span>
  );
}
