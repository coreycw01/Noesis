'use server';
/**
 * @fileOverview An AI agent that analyzes captured notes and annotations
 * from a media item to suggest a declarative core claim.
 *
 * - distillInsightsFromMedia - A function that handles the insight distillation process.
 * - DistillInsightsFromMediaInput - The input type for the distillInsightsFromMedia function.
 * - DistillInsightsFromMediaOutput - The return type for the distillInsightsFromMedia function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DistillInsightsFromMediaInputSchema = z.object({
  mediaTitle: z.string().describe('The title of the media item.'),
  mediaCreator: z.string().optional().describe('The creator (author, channel, etc.) of the media item.'),
  capturedNotes: z.object({
    before: z.object({
      priorBeliefs: z.string().optional().describe('User\'s prior beliefs before consuming the media.'),
      expectation: z.string().optional().describe('User\'s expectation from the media.'),
      openQuestion: z.string().optional().describe('User\'s open question before consuming the media.'),
    }).optional(),
    after: z.object({
      coreArgument: z.string().optional().describe('The core argument identified after consuming the media.'),
      heldUp: z.string().optional().describe('Ideas that held up after consuming the media.'),
      didntHold: z.string().optional().describe('Ideas that did not hold up after consuming the media.'),
      lasting: z.string().optional().describe('A lasting idea from the media.'),
      beliefChange: z.string().optional().describe('How consuming the media changed a belief.'),
      crossRefs: z.string().optional().describe('Cross-references to other sources.'),
    }).optional(),
    sessions: z.array(z.object({
      date: z.string().optional().describe('Date of the session.'),
      startedAt: z.string().optional().describe('Session start timestamp.'),
      endedAt: z.string().optional().describe('Session end timestamp.'),
      durationSeconds: z.number().optional().describe('Active reading duration in seconds.'),
      notes: z.string().optional().describe('Notes from the session.'),
      status: z.string().optional().describe('Session status.'),
    })).optional(),
  }).optional(),
  annotations: z.array(z.object({
    text: z.string().describe('The text of the annotation.'),
    type: z.enum(['highlight', 'thought', 'question', 'connection']).describe('Type of annotation.'),
    context: z.string().optional().describe('Additional context for the annotation.'),
  })).optional(),
});

export type DistillInsightsFromMediaInput = z.infer<typeof DistillInsightsFromMediaInputSchema>;

const DistillInsightsFromMediaOutputSchema = z.object({
  coreClaim: z.string().describe('A single, declarative core claim distilled from the media\'s notes and annotations.'),
});

export type DistillInsightsFromMediaOutput = z.infer<typeof DistillInsightsFromMediaOutputSchema>;

export async function distillInsightsFromMedia(input: DistillInsightsFromMediaInput): Promise<DistillInsightsFromMediaOutput> {
  return distillInsightsFromMediaFlow(input);
}

const distillInsightsFromMediaPrompt = ai.definePrompt({
  name: 'distillInsightsFromMediaPrompt',
  input: {schema: DistillInsightsFromMediaInputSchema},
  output: {schema: DistillInsightsFromMediaOutputSchema},
  prompt: `You are an Insight Distillation AI. Your task is to analyze the provided notes and annotations for a media item and suggest a single, concise, declarative core claim.
This core claim should capture the most significant takeaway or central argument derived from the material.

Media Item: {{{mediaTitle}}} {{#if mediaCreator}}by {{{mediaCreator}}}{{/if}}

--- Captured Notes ---

{{#if capturedNotes.before}}
Before Consumption:
{{#if capturedNotes.before.priorBeliefs}}  - Prior Beliefs: {{{capturedNotes.before.priorBeliefs}}}{{/if}}
{{#if capturedNotes.before.expectation}}  - Expectation: {{{capturedNotes.before.expectation}}}{{/if}}
{{#if capturedNotes.before.openQuestion}}  - Open Question: {{{capturedNotes.before.openQuestion}}}{{/if}}
{{/if}}

{{#if capturedNotes.after}}
After Consumption:
{{#if capturedNotes.after.coreArgument}}  - Core Argument: {{{capturedNotes.after.coreArgument}}}{{/if}}
{{#if capturedNotes.after.heldUp}}  - Held Up: {{{capturedNotes.after.heldUp}}}{{/if}}
{{#if capturedNotes.after.didntHold}}  - Didn't Hold: {{{capturedNotes.after.didntHold}}}{{/if}}
{{#if capturedNotes.after.lasting}}  - Lasting Idea: {{{capturedNotes.after.lasting}}}{{/if}}
{{#if capturedNotes.after.beliefChange}}  - Belief Change: {{{capturedNotes.after.beliefChange}}}{{/if}}
{{#if capturedNotes.after.crossRefs}}  - Cross-References: {{{capturedNotes.after.crossRefs}}}{{/if}}
{{/if}}

{{#if capturedNotes.sessions}}
Session Notes:
{{#each capturedNotes.sessions}}
  - Date: {{{date}}}; Notes: {{{notes}}}
{{/each}}
{{/if}}

--- Annotations ---
{{#if annotations}}
{{#each annotations}}
  - Type: {{{type}}}; Text: {{{text}}}{{#if context}} (Context: {{{context}}}){{/if}}
{{/each}}
{{else}}
No annotations provided.
{{/if}}

Based on the above, what is the single, most important declarative core claim you can distill from this media item? Ensure it is a direct statement, not a question or an instruction.
`,
});

const distillInsightsFromMediaFlow = ai.defineFlow(
  {
    name: 'distillInsightsFromMediaFlow',
    inputSchema: DistillInsightsFromMediaInputSchema,
    outputSchema: DistillInsightsFromMediaOutputSchema,
  },
  async (input) => {
    const {output} = await distillInsightsFromMediaPrompt(input);
    return output!;
  }
);
