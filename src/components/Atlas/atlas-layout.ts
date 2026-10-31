export const ATLAS_NODE_BOUNDS = { minX: 8, maxX: 92, minY: 10, maxY: 90 } as const;

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

export function atlasViewportOffset(width: number, height: number, zoom: number, baseZoom: number) {
  const scale = baseZoom > 0 ? zoom / baseZoom : 1;
  return {
    x: (width - width * scale) / 2,
    y: (height - height * scale) / 2,
  };
}
