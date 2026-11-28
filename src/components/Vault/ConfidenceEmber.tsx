"use client";

import { useId } from 'react';
import { zoneLabel } from '@/components/Vault/PositionCalibration';

export function ConfidenceEmber({ confidence, size = 84, decorative = false }: { confidence: number; size?: number; decorative?: boolean }) {
  const c = Math.max(0, Math.min(100, Math.round(confidence)));
  const strength = c / 100;
  const radius = 9 + 31 * strength;
  const opacity = .06 + .94 * Math.pow(strength, 1.65);
  const zone = zoneLabel(c).toLowerCase();
  const id = useId();
  return (
    <svg className="shrink-0" width={size} height={size} viewBox="0 0 84 84" aria-hidden={decorative || undefined} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `Confidence ${c}%, ${zone}`}>
      <defs>
        <radialGradient id={`${id}-ember`} cx="50%" cy="50%" r="50%">
          <stop stopColor="hsl(var(--kind-position))" />
          <stop offset=".62" stopColor="hsl(var(--kind-position))" stopOpacity=".72" />
          <stop offset="1" stopColor="hsl(var(--kind-position))" stopOpacity=".12" />
        </radialGradient>
      </defs>
      {/* The ring a full 100 would reach. Without it the ember is a size with
          nothing to read it against, and a 40 looks much like a 70. */}
      <circle cx="42" cy="42" r={40} fill="none" stroke="hsl(var(--kind-position))"
        strokeOpacity=".22" strokeWidth="1" strokeDasharray="3 4" />
      <circle cx="42" cy="42" r={radius} fill={`url(#${id}-ember)`} opacity={opacity} />
    </svg>
  );
}
