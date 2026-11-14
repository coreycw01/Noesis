import { redirect } from 'next/navigation';
import { metadataForNoesisView } from '@/lib/noesis-page-definitions';

export const metadata = metadataForNoesisView('source-index');

export default function SourcesPage() {
  redirect('/library');
}
