"use client";

import { Info } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const guides = {
  source: ['Source sounding line', 'The line sinks as you do more with a source. The four depths track your purpose and understanding, sessions and reflection, developed annotations, and links to other records.', 'Start in Reflection: save what brought you here, log a session, or write the central idea in your own words. Provider descriptions do not count.'],
  markup: ['Markup', 'A mark captures the exact words you select. Its type determines where you can send it; a Reference stays in the annotation.', 'Select words in the passage or pick a sentence, then choose a mark type. Use the Marks list to review or send it.'],
  boundary: ['Boundary map', 'The map sorts examples into Fits, Not sure, and Doesn’t fit. Numbers show the order you added them, not how well they fit.', 'Describe a situation and choose whether your definition fits it. Select any numbered example to inspect or move it.'],
  inquiryScale: ['Evidence scale', 'Support adds weight, challenges subtract it, and context does not tilt the scale. Weak, moderate, and strong evidence count as one, two, and three. The scale compares your recorded evidence, not the truth of an answer.', 'Add at least two possible answers. In Weigh evidence, attach each piece to the answer it supports or challenges and choose its strength.'],
  inquirySounding: ['Inquiry sounding line', 'The marks show what you recorded: framing, possible answers, weighed evidence, and a saved answer. The line reaches the deepest completed mark; a gap can still remain above it.', 'Open an unfilled mark to go to its section. Evidence counts here when it supports or challenges a particular answer.'],
  arch: ['Position arch', 'Each stone is an assumption your claim rests on. The load above it represents recorded challenges. Pulling a stone previews what happens without that assumption; it does not delete it.', 'Name an assumption to add a stone. Record a challenge to see it represented as pressure on the claim.'],
  calibration: ['Confidence calibration', 'The glow shows your stated confidence. Grounds shows the share of your recorded support and challenges that is on the supporting side. It is not a probability, and it never moves your confidence for you.', 'Add support and challenges in Grounds. Move the confidence slider to preview a change, then write a reason and save it if you agree.'],
  confidenceHistory: ['Confidence over time', 'The line shows your recorded confidence readings in order. The slider lets you browse them without changing your current confidence.', 'Save a confidence change or record a revision to add a reading. Dates filters both this graph and Position History.'],
  rhythm: ['Practice Path', 'Each kept day adds one step. The flag marks the practice target when there is one. Missed or unlogged days do not move you forward.', 'Select a day to see its check-in and any note. Use the arrows to browse weeks.'],
  experiment: ['Test Bench', 'The diamond shows your prediction. The circle points to an observation. Moving it browses observations in order; farther right means later, not better.', 'Write a hypothesis or expected outcome. In Run, log what happened or what surprised you. A bare Kept or Missed check-in does not count as an observation.'],
  commitment: ['Say / Do gauge', 'Say is the planned count. Do is what was recorded in the same units. For a check-in commitment, the plan is paced by date; other commitments compare their current progress with the saved target.', 'Use the history slider when check-ins span more than one day.'],
  river: ['Belief River', 'A wider river means higher recorded confidence. It shows the order of readings, not how much time passed between them.', 'Save a confidence change or position revision to add a reading. The river needs an earlier reading to compare with the current one.'],
} as const;

export function InstrumentHelp({ instrument }: { instrument: keyof typeof guides }) {
  const [title, reading, next] = guides[instrument];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton type="button" size="sm" label={`How the ${title} works`}><Info aria-hidden="true" /></IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={title} className="w-[min(21rem,calc(100vw-2rem))] max-h-[70dvh] space-y-2 overflow-y-auto text-sm leading-5">
        <h3 className="font-semibold">{title}</h3>
        <p>{reading}</p>
        <p className="text-muted-foreground"><strong className="text-foreground">What to record:</strong> {next}</p>
      </PopoverContent>
    </Popover>
  );
}
