import { redirect } from 'next/navigation';

export default async function LegacyPracticeDetailPage({ params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  redirect(`/labs/${encodeURIComponent(practiceId)}`);
}
