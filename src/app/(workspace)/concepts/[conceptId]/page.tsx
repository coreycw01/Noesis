import { NoesisRouteSurface } from '../../noesis-route-surface';
import { metadataForNoesisDetail } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ conceptId: string }> }) {
  const { conceptId } = await params;
  return metadataForNoesisDetail('concepts', 'concept', conceptId);
}

export default async function ConceptDetailPage({ params }: { params: Promise<{ conceptId: string }> }) {
  const { conceptId } = await params;
  return <NoesisRouteSurface routeState={{ view: 'concepts', focusedConceptId: conceptId }} />;
}
