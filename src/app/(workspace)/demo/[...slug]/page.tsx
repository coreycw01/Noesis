import { NoesisRouteSurface } from '../../noesis-route-surface';
import { parseNoesisRoute } from '@/lib/noesis-routes';
import { metadataForNoesisRouteState } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const routeState = parseNoesisRoute(`/demo/${slug.join('/')}`);
  return metadataForNoesisRouteState(routeState, 'Demo Workspace');
}

export default async function DemoRoutePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  return <NoesisRouteSurface routeState={parseNoesisRoute(`/demo/${slug.join('/')}`)} />;
}
