import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('home', 'Demo Workspace');

export default function DemoPage() {
  return <NoesisRouteSurface routeState={{ view: 'home' }} />;
}
