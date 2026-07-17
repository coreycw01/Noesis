import { NoesisRouteSurface } from '../../noesis-route-surface';
import { parseNoesisRoute } from '@/lib/noesis-routes';
import { metadataForNoesisRouteState } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const routeState = parseNoesisRoute(`/review/${slug.join('/')}`);
  return metadataForNoesisRouteState(routeState, 'Review Workspace');
}

export default async function ReviewRoutePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  return <NoesisRouteSurface routeState={parseNoesisRoute(`/review/${slug.join('/')}`)} />;
}
