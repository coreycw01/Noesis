import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('annotations');

export default function AnnotationsPage() {
  return <NoesisRouteSurface routeState={{ view: 'annotations' }} />;
}
