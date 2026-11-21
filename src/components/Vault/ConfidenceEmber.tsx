"use client";

import { zoneLabel } from '@/components/Vault/PositionCalibration';

export function ConfidenceEmber({ confidence, size = 84 }: { confidence: number; size?: number }) {
  const c = Math.max(0, Math.min(100, Math.round(confidence)));
  const zone = zoneLabel(c).toLowerCase();
  return (
    <svg className="shrink-0" width={size} height={size} viewBox="0 0 84 84" role="img" aria-label={`Confidence ${c}%, ${zone}`} fill="none" strokeWidth="7">
      <circle cx="42" cy="42" r="34" stroke="hsl(var(--kind-position) / .18)" />
      {c > 0 && <circle cx="42" cy="42" r="34" pathLength="100" stroke="hsl(var(--kind-position))" strokeDasharray={`${c} 100`} transform="rotate(-90 42 42)" />}
    </svg>
  );
}
