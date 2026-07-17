import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('home');

export default function HomePage() {
  return <NoesisRouteSurface routeState={{ view: 'home' }} />;
}
