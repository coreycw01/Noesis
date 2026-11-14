import type { PhilosophicalLink, PhilosophicalObjectType } from '@/lib/types';

type RegionMembers = Partial<Record<PhilosophicalObjectType, readonly string[]>>;

export function filterAtlasConnections<T extends Pick<PhilosophicalLink, 'fromId' | 'fromType' | 'toId' | 'toType' | 'type'>>(
  links: readonly T[],
  { members, conceptId, direction, relationship }: { members?: RegionMembers; conceptId: string; direction: string; relationship: string },
) {
  const keys = members && new Set(Object.entries(members).flatMap(([type, ids]) => ids.map((id) => `${type}:${id}`)));
  return links.filter((link) => {
    if (keys && !keys.has(`${link.fromType}:${link.fromId}`) && !keys.has(`${link.toType}:${link.toId}`)) return false;
    if (relationship !== 'all' && link.type !== relationship) return false;
    if (conceptId === 'all') return true;
    const fromConcept = link.fromType === 'concept' && link.fromId === conceptId;
    const toConcept = link.toType === 'concept' && link.toId === conceptId;
    return direction === 'outgoing' ? fromConcept : direction === 'incoming' ? toConcept : fromConcept || toConcept;
  });
}
