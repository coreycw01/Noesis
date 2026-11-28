export function pageAtReadingLine<T extends { top: number; bottom: number }>(pages: T[], line: number): T | undefined {
  const containing = pages.find((page) => page.top <= line && page.bottom > line);
  if (containing) return containing;
  return pages.reduce<T | undefined>((nearest, page) => {
    const distance = Math.min(Math.abs(page.top - line), Math.abs(page.bottom - line));
    const nearestDistance = nearest ? Math.min(Math.abs(nearest.top - line), Math.abs(nearest.bottom - line)) : Infinity;
    return distance < nearestDistance ? page : nearest;
  }, undefined);
}

export function workDragScrollStep(pointer: number, top: number, bottom: number) {
  const edge = Math.min(64, (bottom - top) / 3);
  if (edge <= 0) return 0;
  const pressure = pointer < top + edge ? (pointer - top - edge) / edge
    : pointer > bottom - edge ? (pointer - bottom + edge) / edge : 0;
  return Math.round(Math.max(-1, Math.min(1, pressure)) * 18);
}
