import { NoesisRouteSurface } from '../../noesis-route-surface';
import { metadataForNoesisDetail } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  return metadataForNoesisDetail('writing', 'work', workId);
}

export default async function WorkDetailPage({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  return <NoesisRouteSurface routeState={{ view: 'writing', focusedWorkId: workId }} />;
}
