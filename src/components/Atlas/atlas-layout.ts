export const ATLAS_NODE_BOUNDS = { minX: 8, maxX: 92, minY: 10, maxY: 90 } as const;

export function atlasCanDrag(pointer: { button: number; pointerType: string; isPrimary: boolean }, fullScreen: boolean) {
  return pointer.isPrimary && pointer.button === 0 && (pointer.pointerType !== 'touch' || fullScreen);
}

export function atlasMapScope(mode: 'auto' | 'custom', mapId?: string, regionId?: string) {
  return JSON.stringify(mode === 'custom' ? [mode, mapId] : [mode, regionId]);
}

export function atlasMapTerms({ terms, customTerms, regionTerms, focusedTerm }: {
  terms: string[];
  customTerms?: string[];
  regionTerms?: ReadonlySet<string>;
  focusedTerm?: string;
}) {
  if (customTerms) return [...new Set(customTerms)];
  return regionTerms ? terms.filter((term) => regionTerms.has(term) || term === focusedTerm) : terms;
}

export function atlasCompactNodes<T extends { key: string; count: number }>(nodes: T[], focusedKey?: string) {
  if (nodes.length <= 8) return nodes;
  const visible = [...nodes].sort((left, right) => right.count - left.count).slice(0, 8);
  const focused = focusedKey && !visible.some((node) => node.key === focusedKey)
    ? nodes.find((node) => node.key === focusedKey) : undefined;
  if (focused) visible[visible.length - 1] = focused;
  return visible;
}

export function atlasStoredZoom(value: string | null, base: number, min: number, max: number) {
  const parsed = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : base;
}

export function atlasAutoNodePosition(index: number, total: number, compact = false) {
  if (compact) {
    if (total <= 1) return { x: 50, y: 50 };
    const columns = 2;
    const rows = Math.ceil(total / columns);
    const row = Math.floor(index / columns);
    const isUnpairedLastNode = total % columns === 1 && index === total - 1;
    return {
      x: isUnpairedLastNode ? 50 : index % columns === 0 ? 24 : 76,
      y: rows === 1 ? 50 : 18 + (row / (rows - 1)) * 68,
    };
  }

  if (total <= 1) return { x: 50, y: 50 };
  if (total === 2) return { x: index === 0 ? 20 : 80, y: 50 };
  if (total === 3) {
    return [
      { x: 16, y: 20 },
      { x: 84, y: 20 },
      { x: 50, y: 82 },
    ][index];
  }
  if (total === 4) {
    return [
      { x: 16, y: 20 },
      { x: 84, y: 20 },
      { x: 16, y: 82 },
      { x: 84, y: 82 },
    ][index];
  }

  const columns = Math.max(2, Math.round(Math.sqrt(total * 1.35)));
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const column = index % columns;
  const itemsInRow = Math.min(columns, total - row * columns);
  const rowOffset = (columns - itemsInRow) / 2;
  const xRange = ATLAS_NODE_BOUNDS.maxX - ATLAS_NODE_BOUNDS.minX;
  const yRange = ATLAS_NODE_BOUNDS.maxY - ATLAS_NODE_BOUNDS.minY;

  return {
    x: ATLAS_NODE_BOUNDS.minX + ((column + rowOffset) / (columns - 1)) * xRange,
    y: rows === 1
      ? 50
      : ATLAS_NODE_BOUNDS.minY + (row / (rows - 1)) * yRange,
  };
}

export function atlasZoomPlane(zoom: number, baseZoom: number) {
  const scale = baseZoom > 0 ? Math.max(0.01, zoom / baseZoom) : 1;
  return {
    scale,
    extentPercent: 100 / scale,
  };
}

export function atlasVisibleNodePosition(
  position: { x: number; y: number },
  viewport: { width: number; height: number },
  node: { width: number; height: number },
  scale: number,
  toolbarHeight = 72,
) {
  const fit = (value: number, extent: number, before: number, after: number) => {
    if (extent <= 0) return value;
    const min = before / extent * 100;
    const max = 100 - after / extent * 100;
    return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value));
  };
  const halfWidth = node.width * scale / 2;
  const halfHeight = node.height * scale / 2;
  const gutter = 8;
  return {
    x: fit(position.x, viewport.width, halfWidth + gutter, halfWidth + gutter),
    y: fit(position.y, viewport.height, halfHeight + toolbarHeight, halfHeight + gutter),
  };
}
