"use client";

import { zoneLabel } from '@/components/Vault/PositionCalibration';

/**
 * Stated confidence as an ember: a solid core sized by confidence that dims
 * toward the edge. High confidence is a bright, wide core; low confidence a
 * small, faint one. Decorative beside the number, which carries the value.
 */
export function ConfidenceEmber({ confidence, size = 84 }: { confidence: number; size?: number }) {
  const c = Math.max(0, Math.min(100, Math.round(confidence)));
  const core = 18 + c * 0.62;
  const dim = 0.35 + c / 155;
  const zone = zoneLabel(c).toLowerCase();
  return (
    <span
      className="noesis-ember-lg"
      role="img"
      aria-label={`Confidence ${c}%, ${zone}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, hsl(var(--kind-position) / ${dim}) 0 ${core}%, hsl(var(--kind-position) / ${dim * 0.34}) ${core + 12}%, hsl(var(--kind-position) / .1) 100%)`,
        boxShadow: `0 0 0 1.5px hsl(var(--kind-position) / ${(25 + c * 0.5) / 100})`,
      }}
    />
  );
}
