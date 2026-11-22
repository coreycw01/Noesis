'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import { aiUsageMeter, type AiUsageCounts } from '@/lib/ai-usage';
import { cn } from '@/lib/utils';

/**
 * How much of today's AI allowance is left.
 *
 * The counters are server-side and unreadable from the browser by rule, so
 * this asks `/api/usage` rather than listening to Firestore. It shows nothing
 * at all until it has a real number: a meter that guesses is worse than none,
 * because the whole point is to be able to trust it before spending.
 */
export function AiUsageMeter({ className, owner, refreshKey }: { className?: string; owner?: string; refreshKey?: number }) {
  const [counts, setCounts] = useState<AiUsageCounts | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    // No signed-in owner means no counters to read — the demo workspace has no
    // Firebase at all, and asking anyway only logs a failure nobody can act on.
    if (!owner) return;
    try {
      const user = getAuth(initializeFirebase().firebaseApp).currentUser;
      if (!user) return;
      const response = await fetch('/api/usage', {
        headers: { authorization: `Bearer ${await user.getIdToken()}` },
        cache: 'no-store',
      });
      if (!response.ok) { setFailed(true); return; }
      setCounts(await response.json() as AiUsageCounts);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [owner]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  // Say nothing rather than something untrue.
  if (!owner || failed || !counts) return null;
  const meter = aiUsageMeter(counts);

  return (
    <div className={cn('grid gap-1.5', className)} data-tone={meter.tone === 'ok' ? undefined : meter.tone}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="noesis-eyebrow noesis-eyebrow--sm">Reviews today</span>
        <span className="noesis-figure noesis-figure--sm">{meter.used}/{meter.limit}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-muted"
        role="meter"
        aria-valuenow={meter.used}
        aria-valuemin={0}
        aria-valuemax={meter.limit}
        aria-label={`${meter.used} of ${meter.limit} reviews used today`}
      >
        <div
          className={cn(
            'h-full rounded-[var(--radius-pill)] transition-[width] duration-300',
            meter.tone === 'problem' ? 'bg-[hsl(var(--problem))]'
              : meter.tone === 'caution' ? 'bg-[hsl(var(--caution))]'
                : 'bg-[hsl(var(--revise))]',
          )}
          style={{ width: `${Math.round(meter.fraction * 100)}%` }}
        />
      </div>
      <p className={cn('text-xs leading-5', meter.tone === 'ok' ? 'text-muted-foreground' : 'text-foreground')}>
        {meter.message}
      </p>
    </div>
  );
}
