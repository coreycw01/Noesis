export function localDateKey(value = new Date()) {
  if (!Number.isFinite(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function previousCalendarDay(key: string) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

export function recordDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return localDateKey(new Date(`${value}T12:00:00`)) === value ? value : '';
  }
  return localDateKey(new Date(value));
}
