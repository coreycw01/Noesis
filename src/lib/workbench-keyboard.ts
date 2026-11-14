export function workbenchFocusIndex(key: string, current: number, count: number, rtl = false) {
  if (current < 0 || current >= count) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    const forward = (key === 'ArrowRight') !== rtl;
    return (current + (forward ? 1 : -1) + count) % count;
  }
  return null;
}
