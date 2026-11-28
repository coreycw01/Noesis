'use client';

import { RecordLinkPicker } from '@/components/shared/record/RecordLinkPicker';
import { isCompleteManualInquiryLink, type InquiryLinkType } from '@/lib/inquiry-state';
import type { Draft, Practice, Question } from '@/lib/types';

export function InquiryRecordLinkPicker({ question, drafts, practices, saving, onLink }: {
  question: Question;
  drafts: Draft[];
  practices: Practice[];
  saving: boolean;
  onLink: (type: InquiryLinkType, id: string) => Promise<boolean>;
}) {
  const records = ([
    { type: 'work', label: 'Work', items: drafts },
    { type: 'practice', label: 'Praxis', items: practices },
  ] as const).flatMap(({ type, label, items }) => items
    .filter(item => !isCompleteManualInquiryLink(question, type, item))
    .map(item => ({ type, label, id: item.id, title: item.title || 'Untitled' })));
  return <RecordLinkPicker records={records} disabled={saving} description="Choose a Work or Praxis record to connect to this inquiry." onLink={record => onLink(record.type, record.id)} />;
}
