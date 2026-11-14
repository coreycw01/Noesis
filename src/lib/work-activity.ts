export function workTimestamp(value?: string) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

export function compareLatestWorkTimestamp(left?: string, right?: string) {
  const a = workTimestamp(left);
  const b = workTimestamp(right);
  if (a === null) return b === null ? 0 : 1;
  return b === null ? -1 : b - a;
}
