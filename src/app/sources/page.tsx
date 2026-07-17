import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('source-index');

export default function SourcesPage() {
  return <NoesisRouteSurface routeState={{ view: 'source-index' }} />;
}
