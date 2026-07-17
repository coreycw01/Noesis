import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('atlas');

export default function AtlasPage() {
  return <NoesisRouteSurface routeState={{ view: 'atlas' }} />;
}
