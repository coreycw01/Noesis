'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LinkTypeSchema = z.enum(['supports', 'challenges', 'defines', 'refines', 'contradicts', 'exemplifies', 'inspired_by', 'tested_by', 'expressed_in', 'changed_by']);

const SuggestAnnotationConsequencesInputSchema = z.object({
  annotationText: z.string(),
  annotationType: z.string().optional(),
  sourceTitle: z.string().optional(),
  existingConcepts: z.array(z.string()).optional(),
  existingInquiries: z.array(z.string()).optional(),
  existingPositions: z.array(z.string()).optional(),
});

const SuggestAnnotationConsequencesOutputSchema = z.object({
  thoughtKind: z.enum(['claim_agree', 'claim_reject', 'question', 'definition', 'example', 'contradiction', 'personal_reaction']),
  suggestedConcepts: z.array(z.string()).max(5),
  suggestedInquiry: z.string().optional(),
  suggestedPosition: z.string().optional(),
  suggestedLinkType: LinkTypeSchema.optional(),
  rationale: z.string(),
});

export async function suggestAnnotationConsequences(input: z.infer<typeof SuggestAnnotationConsequencesInputSchema>) {
  return suggestAnnotationConsequencesFlow(input);
}

const suggestAnnotationConsequencesPrompt = ai.definePrompt({
  name: 'suggestAnnotationConsequencesPrompt',
  input: {schema: SuggestAnnotationConsequencesInputSchema},
  output: {schema: SuggestAnnotationConsequencesOutputSchema},
  prompt: `You are a Socratic assistant for Noesis. Suggest what this annotation might do next, but do not claim certainty.

Annotation: {{{annotationText}}}
Type: {{annotationType}}
Source: {{sourceTitle}}
Existing concepts: {{existingConcepts}}
Existing inquiries: {{existingInquiries}}
Existing positions: {{existingPositions}}

Return concise suggestions. Use "challenges" only when the note clearly creates pressure against a position.`,
});

const suggestAnnotationConsequencesFlow = ai.defineFlow({
  name: 'suggestAnnotationConsequencesFlow',
  inputSchema: SuggestAnnotationConsequencesInputSchema,
  outputSchema: SuggestAnnotationConsequencesOutputSchema,
}, async (input) => {
  const {output} = await suggestAnnotationConsequencesPrompt(input);
  return output!;
});

const SuggestPositionDraftsInputSchema = z.object({
  conceptName: z.string().optional(),
  annotations: z.array(z.string()),
  sourceTitles: z.array(z.string()).optional(),
});

const SuggestPositionDraftsOutputSchema = z.object({
  drafts: z.array(z.object({
    claim: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    supportSummary: z.string(),
    challengeToConsider: z.string(),
  })).min(1).max(4),
});

export async function suggestPositionDrafts(input: z.infer<typeof SuggestPositionDraftsInputSchema>) {
  return suggestPositionDraftsFlow(input);
}

const suggestPositionDraftsPrompt = ai.definePrompt({
  name: 'suggestPositionDraftsPrompt',
  input: {schema: SuggestPositionDraftsInputSchema},
  output: {schema: SuggestPositionDraftsOutputSchema},
  prompt: `Draft editable philosophical positions from these notes. Do not overstate what the user believes.

Concept: {{conceptName}}
Sources: {{sourceTitles}}
Annotations:
{{#each annotations}}
- {{{this}}}
{{/each}}

Return 2 to 4 clear claim drafts with a support summary and one challenge to consider.`,
});

const suggestPositionDraftsFlow = ai.defineFlow({
  name: 'suggestPositionDraftsFlow',
  inputSchema: SuggestPositionDraftsInputSchema,
  outputSchema: SuggestPositionDraftsOutputSchema,
}, async (input) => {
  const {output} = await suggestPositionDraftsPrompt(input);
  return output!;
});

const SuggestTypedLinksInputSchema = z.object({
  fromLabel: z.string(),
  fromType: z.string(),
  toLabel: z.string(),
  toType: z.string(),
  context: z.string().optional(),
});

const SuggestTypedLinksOutputSchema = z.object({
  linkType: LinkTypeSchema,
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
});

export async function suggestTypedLinks(input: z.infer<typeof SuggestTypedLinksInputSchema>) {
  return suggestTypedLinksFlow(input);
}

const suggestTypedLinksPrompt = ai.definePrompt({
  name: 'suggestTypedLinksPrompt',
  input: {schema: SuggestTypedLinksInputSchema},
  output: {schema: SuggestTypedLinksOutputSchema},
  prompt: `Choose the most likely philosophical link type between two Noesis objects.

From: {{fromType}} - {{{fromLabel}}}
To: {{toType}} - {{{toLabel}}}
Context: {{{context}}}

Be humble. Prefer supports, challenges, defines, refines, exemplifies, tested_by, expressed_in, or inspired_by unless contradiction is explicit.`,
});

const suggestTypedLinksFlow = ai.defineFlow({
  name: 'suggestTypedLinksFlow',
  inputSchema: SuggestTypedLinksInputSchema,
  outputSchema: SuggestTypedLinksOutputSchema,
}, async (input) => {
  const {output} = await suggestTypedLinksPrompt(input);
  return output!;
});

const DetectPossibleTensionsInputSchema = z.object({
  positions: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    statement: z.string(),
  })),
  concepts: z.array(z.string()).optional(),
});

const DetectPossibleTensionsOutputSchema = z.object({
  tensions: z.array(z.object({
    firstTitle: z.string(),
    secondTitle: z.string(),
    tension: z.string(),
    suggestedQuestion: z.string(),
  })).max(5),
});

export async function detectPossibleTensions(input: z.infer<typeof DetectPossibleTensionsInputSchema>) {
  return detectPossibleTensionsFlow(input);
}

const detectPossibleTensionsPrompt = ai.definePrompt({
  name: 'detectPossibleTensionsPrompt',
  input: {schema: DetectPossibleTensionsInputSchema},
  output: {schema: DetectPossibleTensionsOutputSchema},
  prompt: `Look for possible tensions among these positions. Do not declare contradictions as fact.

Concepts: {{concepts}}
Positions:
{{#each positions}}
- {{{title}}}: {{{statement}}}
{{/each}}

Return possible tensions only when they would help the user think more clearly.`,
});

const detectPossibleTensionsFlow = ai.defineFlow({
  name: 'detectPossibleTensionsFlow',
  inputSchema: DetectPossibleTensionsInputSchema,
  outputSchema: DetectPossibleTensionsOutputSchema,
}, async (input) => {
  const {output} = await detectPossibleTensionsPrompt(input);
  return output!;
});

const SummarizeEvolutionEventInputSchema = z.object({
  entityType: z.string(),
  entityTitle: z.string(),
  oldState: z.string().optional(),
  newState: z.string(),
  evidence: z.array(z.string()).optional(),
});

const SummarizeEvolutionEventOutputSchema = z.object({
  summary: z.string(),
  cause: z.string(),
});

export async function summarizeEvolutionEvent(input: z.infer<typeof SummarizeEvolutionEventInputSchema>) {
  return summarizeEvolutionEventFlow(input);
}

const summarizeEvolutionEventPrompt = ai.definePrompt({
  name: 'summarizeEvolutionEventPrompt',
  input: {schema: SummarizeEvolutionEventInputSchema},
  output: {schema: SummarizeEvolutionEventOutputSchema},
  prompt: `Summarize a meaningful change for the Noesis Evolution timeline.

Object: {{entityType}} - {{{entityTitle}}}
Old state: {{{oldState}}}
New state: {{{newState}}}
Evidence:
{{#each evidence}}
- {{{this}}}
{{/each}}

Write this as a short record of changed thinking, not routine activity.`,
});

const summarizeEvolutionEventFlow = ai.defineFlow({
  name: 'summarizeEvolutionEventFlow',
  inputSchema: SummarizeEvolutionEventInputSchema,
  outputSchema: SummarizeEvolutionEventOutputSchema,
}, async (input) => {
  const {output} = await summarizeEvolutionEventPrompt(input);
  return output!;
});

const SuggestDailyPhilosophyPromptInputSchema = z.object({
  rawAnnotationCount: z.number(),
  openInquiryCount: z.number(),
  unsupportedPositionCount: z.number(),
  untestedPositionCount: z.number(),
  recentChanges: z.array(z.string()).optional(),
});

const SuggestDailyPhilosophyPromptOutputSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  actionLabel: z.string(),
  targetArea: z.enum(['annotations', 'inquiries', 'positions', 'works', 'practices', 'evolution']),
});

export async function suggestDailyPhilosophyPrompt(input: z.infer<typeof SuggestDailyPhilosophyPromptInputSchema>) {
  return suggestDailyPhilosophyPromptFlow(input);
}

const suggestDailyPhilosophyPromptPrompt = ai.definePrompt({
  name: 'suggestDailyPhilosophyPromptPrompt',
  input: {schema: SuggestDailyPhilosophyPromptInputSchema},
  output: {schema: SuggestDailyPhilosophyPromptOutputSchema},
  prompt: `Choose one useful next philosophical action for today. Do not overwhelm the user.

Raw annotations: {{rawAnnotationCount}}
Open inquiries: {{openInquiryCount}}
Unsupported positions: {{unsupportedPositionCount}}
Untested positions: {{untestedPositionCount}}
Recent changes: {{recentChanges}}

Return one calm, specific prompt.`,
});

const suggestDailyPhilosophyPromptFlow = ai.defineFlow({
  name: 'suggestDailyPhilosophyPromptFlow',
  inputSchema: SuggestDailyPhilosophyPromptInputSchema,
  outputSchema: SuggestDailyPhilosophyPromptOutputSchema,
}, async (input) => {
  const {output} = await suggestDailyPhilosophyPromptPrompt(input);
  return output!;
});
