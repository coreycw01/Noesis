import { NoesisRouteSurface } from '../../noesis-route-surface';
import { metadataForNoesisDetail } from '@/lib/noesis-page-definitions';

export async function generateMetadata({ params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params;
  return metadataForNoesisDetail('questions', 'inquiry', inquiryId);
}

export default async function InquiryDetailPage({ params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params;
  return <NoesisRouteSurface routeState={{ view: 'questions', focusedQuestionId: inquiryId }} />;
}
