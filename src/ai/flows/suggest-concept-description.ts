'use server';
/**
 * @fileOverview A Genkit flow for suggesting a concise description for a concept
 * based on its linked sources, ideas, and beliefs.
 *
 * - suggestConceptDescription - The main function to call the AI flow.
 * - SuggestConceptDescriptionInput - The input type for the flow.
 * - SuggestConceptDescriptionOutput - The output type from the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestConceptDescriptionInputSchema = z.object({
  conceptName: z.string().describe('The name of the concept.'),
  currentDescription: z.string().optional().describe('The current description of the concept, if any.'),
  linkedSources: z.array(
    z.object({
      title: z.string().describe('The title of the source.'),
      creator: z.string().optional().describe('The creator/author of the source.'),
      description: z.string().optional().describe('A brief description of the source content.'),
      notes: z.string().optional().describe('Personal notes about the source.'),
    })
  ).optional().describe('A list of sources linked to the concept.'),
  linkedIdeas: z.array(
    z.object({
      title: z.string().describe('The title of the idea.'),
      body: z.string().describe('The body content of the idea.'),
    })
  ).optional().describe('A list of ideas linked to the concept.'),
  linkedBeliefs: z.array(
    z.object({
      title: z.string().describe('The title of the belief.'),
      description: z.string().optional().describe('A description of the belief.'),
      statement: z.string().describe('The core statement of the belief.'),
    })
  ).optional().describe('A list of beliefs linked to the concept.'),
});
export type SuggestConceptDescriptionInput = z.infer<typeof SuggestConceptDescriptionInputSchema>;

const SuggestConceptDescriptionOutputSchema = z.object({
  suggestedDescription: z.string().describe('A concise AI-suggested description for the concept.'),
});
export type SuggestConceptDescriptionOutput = z.infer<typeof SuggestConceptDescriptionOutputSchema>;

const suggestConceptDescriptionPrompt = ai.definePrompt({
  name: 'suggestConceptDescriptionPrompt',
  input: {schema: SuggestConceptDescriptionInputSchema},
  output: {schema: SuggestConceptDescriptionOutputSchema},
  prompt: `You are an AI assistant specialized in personal philosophy and knowledge management. Your task is to provide a concise, 1-2 sentence description for a concept within a personal philosophy system, based on provided linked information.

The concept name is: {{{conceptName}}}

{{#if currentDescription}}
Here is its current description: {{{currentDescription}}}
Please refine this description or use it as a starting point.
{{/if}}

Consider the following related information:

{{#if linkedSources}}
--- Linked Sources ---
{{#each linkedSources}}
- Title: {{{this.title}}}
  {{#if this.creator}}Creator: {{{this.creator}}}{{/if}}
  {{#if this.description}}Description: {{{this.description}}}{{/if}}
  {{#if this.notes}}Notes: {{{this.notes}}}{{/if}}
{{/each}}
{{/if}}

{{#if linkedIdeas}}
--- Linked Ideas ---
{{#each linkedIdeas}}
- Title: {{{this.title}}}
  Body: {{{this.body}}}
{{/each}}
{{/if}}

{{#if linkedBeliefs}}
--- Linked Beliefs ---
{{#each linkedBeliefs}}
- Title: {{{this.title}}}
  Statement: {{{this.statement}}}
  {{#if this.description}}Description: {{{this.description}}}{{/if}}
{{/each}}
{{/if}}

Based on the concept name and all the linked information above, provide a concise, 1-2 sentence description for the concept. The description should capture the essence of the concept as understood through the linked items. Do not use phrases like "Based on the provided information" or similar.`
});

const suggestConceptDescriptionFlow = ai.defineFlow(
  {
    name: 'suggestConceptDescriptionFlow',
    inputSchema: SuggestConceptDescriptionInputSchema,
    outputSchema: SuggestConceptDescriptionOutputSchema,
  },
  async (input) => {
    const {output} = await suggestConceptDescriptionPrompt(input);
    return output!;
  }
);

export async function suggestConceptDescription(input: SuggestConceptDescriptionInput): Promise<SuggestConceptDescriptionOutput> {
  return suggestConceptDescriptionFlow(input);
}
