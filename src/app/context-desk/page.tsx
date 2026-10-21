import { NoesisRouteSurface } from '../noesis-route-surface';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('context-desk');

export default function ContextDeskPage() {
  return <NoesisRouteSurface routeState={{ view: 'context-desk' }} />;
}
