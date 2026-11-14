import { limit, orderBy, query, Timestamp, where, type CollectionReference } from 'firebase/firestore';

const earliestTimestamp = new Timestamp(-62_135_596_800, 0);

export function thinkingHistoryQuery(ref: CollectionReference, size: number, format: 'timestamp' | 'legacy') {
  const firstDate = format === 'legacy' ? '' : earliestTimestamp;
  return query(ref, where('createdAt', '>=', firstDate), orderBy('createdAt', 'desc'), limit(size + 1));
}
