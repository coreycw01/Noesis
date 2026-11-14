import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('library');

export default function LibraryPage() {
  return <NoesisRouteSurface routeState={{ view: 'library' }} />;
}
