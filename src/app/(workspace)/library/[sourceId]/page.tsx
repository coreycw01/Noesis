import { NoesisRouteSurface } from '../../noesis-route-surface';
import { metadataForNoesisDetail } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  return metadataForNoesisDetail('library', 'source', sourceId);
}

export default async function SourceDetailPage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  return <NoesisRouteSurface routeState={{ view: 'library', focusedSourceId: sourceId }} />;
}
