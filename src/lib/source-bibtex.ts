import type { Media } from './types';

export function sourceBibtex(sources: readonly Media[]) {
  const used = new Set<string>();
  const escape = (value: string) => value.replace(/[{}]/g, '').replace(/([#%&_])/g, '\\$1');
  return sources.map((source) => {
    const creators = source.creators?.filter((name) => name.trim()) ?? [];
    const author = creators.length ? creators.join(' and ') : source.creator;
    const surname = (creators[0] || source.creator || '').trim().split(/\s+/).at(-1)?.replace(/[^a-z0-9]/gi, '') || 'source';
    const year = source.year?.trim();
    const base = surname + (year?.startsWith('-') ? `BCE${year.replace(/\D/g, '')}` : year?.replace(/\D/g, '') || '');
    let key = base;
    for (let suffix = 2; used.has(key.toLowerCase()); suffix++) key = `${base}-${suffix}`;
    used.add(key.toLowerCase());
    const type = source.type === 'book' ? 'book' : source.type === 'paper' ? 'article' : 'misc';
    const fields = [
      ['title', source.title], ['author', author], ['year', year],
      ['publisher', source.publisher], ['url', source.url], ['doi', source.doi],
    ].filter(([, value]) => Boolean(value)).map(([name, value]) => `  ${name} = {${escape(String(value))}}`).join(',\n');
    return `@${type}{${key},\n${fields}\n}`;
  }).join('\n\n');
}
