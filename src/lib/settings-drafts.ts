export function reconcileSettingsDrafts<T extends object>(current: T, previous: T, incoming: T): T {
  let next = current;
  for (const key of Object.keys(incoming) as Array<keyof T>) {
    const draft = JSON.stringify(current[key]);
    if (draft === JSON.stringify(previous[key]) && draft !== JSON.stringify(incoming[key])) {
      next = { ...next, [key]: incoming[key] };
    }
  }
  return next;
}
