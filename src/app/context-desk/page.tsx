import NoesisHomePage from '@/app/noesis-home-page';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('context-desk');

export default function ContextDeskPage() {
  return <NoesisHomePage />;
}
