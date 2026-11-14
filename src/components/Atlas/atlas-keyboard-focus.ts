type Bounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>;

export function atlasFocusPan(viewport: Bounds, node: Bounds, inset = 12) {
  const fit = (start: number, end: number, min: number, max: number) => {
    if (end - start > max - min) return (min + max - start - end) / 2;
    if (start < min) return min - start;
    if (end > max) return max - end;
    return 0;
  };
  return {
    x: fit(node.left, node.right, viewport.left + inset, viewport.right - inset),
    y: fit(node.top, node.bottom, viewport.top + inset, viewport.bottom - inset),
  };
}
