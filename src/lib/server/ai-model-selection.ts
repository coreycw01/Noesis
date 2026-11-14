type ModelAttempt<T> = { available: true; value: T } | { available: false };

export async function tryAiModels<T>(
  preferredModels: readonly string[],
  discover: () => Promise<string[] | null>,
  attempt: (model: string) => Promise<ModelAttempt<T>>,
): Promise<T | null> {
  const [primary, ...fallbacks] = [...new Set(preferredModels.filter(Boolean))];
  if (!primary) return null;
  const first = await attempt(primary);
  if (first.available) return first.value;

  const catalog = await discover();
  const available = catalog && new Set(catalog.filter((model) => model !== primary));
  const preferred = available ? fallbacks.filter((model) => available.has(model)) : fallbacks;
  const candidates = available && !preferred.length
    ? [...available].filter((model) => /flash/i.test(model)).slice(0, 4)
    : preferred;
  for (const model of candidates) {
    const result = await attempt(model);
    if (result.available) return result.value;
  }
  return null;
}
