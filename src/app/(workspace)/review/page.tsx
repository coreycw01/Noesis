import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('home', 'Review Workspace');

export default function ReviewPage() {
  return <NoesisRouteSurface routeState={{ view: 'home' }} />;
}
