'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LinkTypeSchema = z.enum(['supports', 'challenges', 'coheres', 'defines', 'refines', 'contradicts', 'exemplifies', 'inspired_by', 'tested_by', 'expressed_in', 'changed_by', 'depends_on', 'explains', 'explained_by', 'derived_from', 'references', 'replaces', 'questions', 'expands', 'weakens', 'strengthens']);

const AiMemoryContextSchema = z.object({
  scope: z.enum(['current_object', 'linked_objects', 'whole_workspace']),
  itemMemory: z.array(z.string()).optional(),
  linkedMemory: z.array(z.string()).optional(),
  workspaceMemory: z.array(z.string()).optional(),
  instruction: z.string().optional(),
}).optional();

const SuggestAnnotationConsequencesInputSchema = z.object({
  annotationText: z.string(),
  annotationType: z.string().optional(),
  sourceTitle: z.string().optional(),
  existingConcepts: z.array(z.string()).optional(),
  existingInquiries: z.array(z.string()).optional(),
  existingPositions: z.array(z.string()).optional(),
  memoryContext: AiMemoryContextSchema,
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
{{#if memoryContext}}

Memory scope: {{memoryContext.scope}}
{{#if memoryContext.instruction}}Memory instruction: {{{memoryContext.instruction}}}{{/if}}
{{#if memoryContext.itemMemory}}
Item memory:
{{#each memoryContext.itemMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.linkedMemory}}
Linked memory:
{{#each memoryContext.linkedMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.workspaceMemory}}
Workspace memory:
{{#each memoryContext.workspaceMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{/if}}

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
  memoryContext: AiMemoryContextSchema,
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
{{#if memoryContext}}
Memory scope: {{memoryContext.scope}}
{{#if memoryContext.instruction}}Memory instruction: {{{memoryContext.instruction}}}{{/if}}
{{#if memoryContext.itemMemory}}
Item memory:
{{#each memoryContext.itemMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.linkedMemory}}
Linked memory:
{{#each memoryContext.linkedMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{/if}}
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

Be humble. Prefer coheres, supports, challenges, defines, refines, exemplifies, tested_by, expressed_in, or inspired_by unless contradiction is explicit.`,
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

const SocratesReflectInputSchema = z.object({
  question: z.string(),
  initialAnswer: z.string(),
  exchanges: z.array(z.object({
    probe: z.string(),
    response: z.string(),
  })).optional(),
});

const SocratesReflectOutputSchema = z.object({
  ready: z.boolean(),
  probe: z.string().optional(),
  focus: z.string().optional(),
  positionTitle: z.string().optional(),
  statement: z.string().optional(),
  description: z.string().optional(),
  confidence: z.number().min(1).max(5).int().optional(),
});

export async function socratesReflect(input: z.infer<typeof SocratesReflectInputSchema>) {
  return socratesReflectFlow(input);
}

const socratesReflectPrompt = ai.definePrompt({
  name: 'socratesReflectPrompt',
  input: { schema: SocratesReflectInputSchema },
  output: { schema: SocratesReflectOutputSchema },
  prompt: `You are Socrates in a philosophical dialogue. The user is working toward a clear position on a question.

Question: {{{question}}}

User's initial answer: {{{initialAnswer}}}

{{#if exchanges}}
Previous exchanges:
{{#each exchanges}}
Your probe: {{{probe}}}
User's response: {{{response}}}
{{/each}}
{{/if}}

Number of exchanges so far: {{exchanges.length}}

Rules:
- If exchanges < 2 and clarity is LOW: ask one more probing question (ready: false). Pick a dimension not yet explored: scope of claim, personal evidence, key exception, what this rules out, commitment level.
- If exchanges >= 2 OR the user's answers are already clear enough to crystallize: set ready: true and synthesize the position.
- Each probe must be specific to what the user actually said — do not ask generic philosophy questions.
- When ready: distill a precise, ownable claim from all their answers. Keep positionTitle under 12 words. Statement is one sentence. Description is 2-3 sentences of their own reasoning reflected back sharply.
- Confidence 1-5: read their certainty from the text (hedging = lower, conviction = higher; default 3).
- When not ready: set probe and a short focus label (2-4 words), leave position fields absent.`,
});

const socratesReflectFlow = ai.defineFlow({
  name: 'socratesReflectFlow',
  inputSchema: SocratesReflectInputSchema,
  outputSchema: SocratesReflectOutputSchema,
}, async (input) => {
  const { output } = await socratesReflectPrompt(input);
  return output!;
});

const GenerateIdeaQuestionsInputSchema = z.object({
  ideaTitle: z.string(),
  ideaBody: z.string().optional(),
});

const GenerateIdeaQuestionsOutputSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    focus: z.string(),
  })).length(3),
});

export async function generateIdeaQuestions(input: z.infer<typeof GenerateIdeaQuestionsInputSchema>) {
  return generateIdeaQuestionsFlow(input);
}

const generateIdeaQuestionsPrompt = ai.definePrompt({
  name: 'generateIdeaQuestionsPrompt',
  input: { schema: GenerateIdeaQuestionsInputSchema },
  output: { schema: GenerateIdeaQuestionsOutputSchema },
  prompt: `You are a Socratic assistant. The user has written an idea and needs to turn it into a clear philosophical position.

Idea title: {{{ideaTitle}}}
Idea body: {{{ideaBody}}}

Generate exactly 3 questions that will help the user clarify and commit to a specific position. Each question should surface a different dimension: scope of the claim, the evidence or experience behind it, and a key objection or limit. Be specific to THIS idea. Return a short "focus" label (2-4 words) for each.`,
});

const generateIdeaQuestionsFlow = ai.defineFlow({
  name: 'generateIdeaQuestionsFlow',
  inputSchema: GenerateIdeaQuestionsInputSchema,
  outputSchema: GenerateIdeaQuestionsOutputSchema,
}, async (input) => {
  const { output } = await generateIdeaQuestionsPrompt(input);
  return output!;
});

const FormPositionFromIdeaInputSchema = z.object({
  ideaTitle: z.string(),
  ideaBody: z.string().optional(),
  qa: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
});

const FormPositionFromIdeaOutputSchema = z.object({
  positionTitle: z.string(),
  statement: z.string(),
  description: z.string(),
  confidence: z.number().min(1).max(5).int(),
});

export async function formPositionFromIdea(input: z.infer<typeof FormPositionFromIdeaInputSchema>) {
  return formPositionFromIdeaFlow(input);
}

const formPositionFromIdeaPrompt = ai.definePrompt({
  name: 'formPositionFromIdeaPrompt',
  input: { schema: FormPositionFromIdeaInputSchema },
  output: { schema: FormPositionFromIdeaOutputSchema },
  prompt: `Synthesize a philosophical position from this idea and the user's answers to Socratic questions.

Original idea: {{{ideaTitle}}}
{{ideaBody}}

User's answers:
{{#each qa}}
Q: {{{question}}}
A: {{{answer}}}
{{/each}}

Write:
- positionTitle: a short bold claim the user can own (under 12 words)
- statement: the core claim in one precise sentence
- description: 2-3 sentences of reasoning drawn from their answers
- confidence: 1–5 integer reflecting how certain they seem (default 3)

Reflect the user's actual views. Do not add claims beyond what they expressed.`,
});

const formPositionFromIdeaFlow = ai.defineFlow({
  name: 'formPositionFromIdeaFlow',
  inputSchema: FormPositionFromIdeaInputSchema,
  outputSchema: FormPositionFromIdeaOutputSchema,
}, async (input) => {
  const { output } = await formPositionFromIdeaPrompt(input);
  return output!;
});

const GenerateClarityCheckInputSchema = z.object({
  conceptName: z.string(),
  conceptDefinition: z.string().optional(),
  positionStatements: z.array(z.string()).max(4),
  annotationTexts: z.array(z.string()).max(5),
  relatedConcepts: z.array(z.string()).max(6),
  memoryContext: AiMemoryContextSchema,
});

const ClarityCheckOptionSchema = z.object({
  id: z.enum(['a', 'b', 'c', 'd']),
  text: z.string(),
  isClosest: z.boolean(),
});

const ClarityCheckQuestionSchema = z.object({
  text: z.string(),
  dimension: z.enum(['definition', 'distinction', 'application', 'tension', 'connection']),
  options: z.array(ClarityCheckOptionSchema).min(4).max(4),
  feedback: z.string(),
});

const GenerateClarityCheckOutputSchema = z.object({
  questions: z.array(ClarityCheckQuestionSchema).min(3).max(5),
});

export type ClarityCheckQuestion = z.infer<typeof ClarityCheckQuestionSchema>;
export type ClarityCheckOption = z.infer<typeof ClarityCheckOptionSchema>;

export async function generateClarityCheck(input: z.infer<typeof GenerateClarityCheckInputSchema>) {
  return generateClarityCheckFlow(input);
}

const generateClarityCheckPrompt = ai.definePrompt({
  name: 'generateClarityCheckPrompt',
  input: { schema: GenerateClarityCheckInputSchema },
  output: { schema: GenerateClarityCheckOutputSchema },
  prompt: `Generate a Clarity Check for a philosophical concept. This is NOT a quiz testing memory — it reveals what the user believes and where their thinking is unclear.

Concept: {{{conceptName}}}
Definition: {{{conceptDefinition}}}

Current positions:
{{#each positionStatements}}
- {{{this}}}
{{/each}}

Key annotations:
{{#each annotationTexts}}
- {{{this}}}
{{/each}}

Related concepts: {{relatedConcepts}}
{{#if memoryContext}}

Memory scope: {{memoryContext.scope}}
{{#if memoryContext.instruction}}Memory instruction: {{{memoryContext.instruction}}}{{/if}}
{{#if memoryContext.itemMemory}}
Item memory:
{{#each memoryContext.itemMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.linkedMemory}}
Linked memory:
{{#each memoryContext.linkedMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{/if}}

Generate 3-5 questions. Each tests ONE dimension:
- definition: what this concept means
- distinction: how it differs from a closely related concept
- application: when or how this applies in real life
- tension: where the concept creates difficulty or conflict
- connection: how it relates to another idea

Rules:
- Questions must be specific to THIS user's notes — not generic philosophy
- Each question has exactly 4 options (id: a/b/c/d), ONE marked isClosest: true
- isClosest should match what the user's notes suggest they believe
- Do NOT make isClosest obvious — require genuine self-reflection
- feedback: one sentence explaining what the closest option reveals
- Option text under 20 words each`,
});

const generateClarityCheckFlow = ai.defineFlow({
  name: 'generateClarityCheckFlow',
  inputSchema: GenerateClarityCheckInputSchema,
  outputSchema: GenerateClarityCheckOutputSchema,
}, async (input) => {
  const { output } = await generateClarityCheckPrompt(input);
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

const DetectMissingPerspectivesInputSchema = z.object({
  targetType: z.string(),
  targetTitle: z.string(),
  content: z.string(),
  sourceTitles: z.array(z.string()).optional(),
  conceptTags: z.array(z.string()).optional(),
  existingPerspectiveCoverage: z.array(z.string()).optional(),
  memoryContext: AiMemoryContextSchema,
});

const DetectMissingPerspectivesOutputSchema = z.object({
  suggestions: z.array(z.object({
    perspective: z.string(),
    whyItMatters: z.string(),
    evidence: z.array(z.string()).max(4),
    question: z.string(),
    confidence: z.number().min(0).max(1),
  })).max(4),
});

export async function detectMissingPerspectives(input: z.infer<typeof DetectMissingPerspectivesInputSchema>) {
  return detectMissingPerspectivesFlow(input);
}

const detectMissingPerspectivesPrompt = ai.definePrompt({
  name: 'detectMissingPerspectivesPrompt',
  input: { schema: DetectMissingPerspectivesInputSchema },
  output: { schema: DetectMissingPerspectivesOutputSchema },
  prompt: `You are a philosophical review assistant for Noesis. Suggest missing perspectives only when the user’s actual material makes the omission plausible.

Target type: {{targetType}}
Target title: {{{targetTitle}}}
Content: {{{content}}}
Sources: {{sourceTitles}}
Concepts: {{conceptTags}}
Already covered: {{existingPerspectiveCoverage}}
{{#if memoryContext}}

Memory scope: {{memoryContext.scope}}
{{#if memoryContext.instruction}}Memory instruction: {{{memoryContext.instruction}}}{{/if}}
{{#if memoryContext.itemMemory}}
Item memory:
{{#each memoryContext.itemMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.linkedMemory}}
Linked memory:
{{#each memoryContext.linkedMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.workspaceMemory}}
Workspace memory:
{{#each memoryContext.workspaceMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{/if}}

Rules:
- Do not spray generic ideology lists
- Ground each suggestion in the target content
- Explain why the perspective matters here
- Include short evidence points taken from the target content or source framing
- Return at most 4 suggestions`,
});

const detectMissingPerspectivesFlow = ai.defineFlow({
  name: 'detectMissingPerspectivesFlow',
  inputSchema: DetectMissingPerspectivesInputSchema,
  outputSchema: DetectMissingPerspectivesOutputSchema,
}, async (input) => {
  const { output } = await detectMissingPerspectivesPrompt(input);
  return output!;
});

const DetectMissingQuestionsInputSchema = z.object({
  concepts: z.array(z.string()),
  positions: z.array(z.string()),
  unknowns: z.array(z.string()),
  inquiries: z.array(z.string()),
  contradictions: z.array(z.string()),
  memoryContext: AiMemoryContextSchema,
});

const DetectMissingQuestionsOutputSchema = z.object({
  suggestions: z.array(z.object({
    question: z.string(),
    reasoning: z.string(),
    evidence: z.array(z.string()).max(4),
    confidence: z.number().min(0).max(1),
  })).max(5),
});

export async function detectMissingQuestions(input: z.infer<typeof DetectMissingQuestionsInputSchema>) {
  return detectMissingQuestionsFlow(input);
}

const detectMissingQuestionsPrompt = ai.definePrompt({
  name: 'detectMissingQuestionsPrompt',
  input: { schema: DetectMissingQuestionsInputSchema },
  output: { schema: DetectMissingQuestionsOutputSchema },
  prompt: `You are identifying important questions the user may not yet have explored in Noesis.

Concepts: {{concepts}}
Positions: {{positions}}
Unknowns: {{unknowns}}
Open inquiries: {{inquiries}}
Contradictions/tensions: {{contradictions}}
{{#if memoryContext}}

Memory scope: {{memoryContext.scope}}
{{#if memoryContext.instruction}}Memory instruction: {{{memoryContext.instruction}}}{{/if}}
{{#if memoryContext.itemMemory}}
Item memory:
{{#each memoryContext.itemMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.linkedMemory}}
Linked memory:
{{#each memoryContext.linkedMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.workspaceMemory}}
Workspace memory:
{{#each memoryContext.workspaceMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{/if}}

Return only high-value missing questions. Each suggestion must include reasoning and evidence from the existing map. Avoid generic philosophy trivia.`,
});

const detectMissingQuestionsFlow = ai.defineFlow({
  name: 'detectMissingQuestionsFlow',
  inputSchema: DetectMissingQuestionsInputSchema,
  outputSchema: DetectMissingQuestionsOutputSchema,
}, async (input) => {
  const { output } = await detectMissingQuestionsPrompt(input);
  return output!;
});

const GenerateStressTestInputSchema = z.object({
  targetType: z.string(),
  title: z.string(),
  content: z.string(),
  memoryContext: AiMemoryContextSchema,
});

const GenerateStressTestOutputSchema = z.object({
  prompts: z.array(z.object({
    kind: z.enum(['change_mind', 'hidden_assumption', 'falsification', 'prediction', 'opposite_case', 'weakening_evidence']),
    question: z.string(),
  })).length(6),
});

export async function generateStressTest(input: z.infer<typeof GenerateStressTestInputSchema>) {
  return generateStressTestFlow(input);
}

const generateStressTestPrompt = ai.definePrompt({
  name: 'generateStressTestPrompt',
  input: { schema: GenerateStressTestInputSchema },
  output: { schema: GenerateStressTestOutputSchema },
  prompt: `Generate a philosophical stress test for this Noesis object.

Type: {{targetType}}
Title: {{{title}}}
Content: {{{content}}}
{{#if memoryContext}}

Memory scope: {{memoryContext.scope}}
{{#if memoryContext.instruction}}Memory instruction: {{{memoryContext.instruction}}}{{/if}}
{{#if memoryContext.itemMemory}}
Item memory:
{{#each memoryContext.itemMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{#if memoryContext.linkedMemory}}
Linked memory:
{{#each memoryContext.linkedMemory}}
- {{{this}}}
{{/each}}
{{/if}}
{{/if}}

Write exactly six prompts, one for each kind:
- change_mind
- hidden_assumption
- falsification
- prediction
- opposite_case
- weakening_evidence

Make them specific to the content, not generic.`,
});

const generateStressTestFlow = ai.defineFlow({
  name: 'generateStressTestFlow',
  inputSchema: GenerateStressTestInputSchema,
  outputSchema: GenerateStressTestOutputSchema,
}, async (input) => {
  const { output } = await generateStressTestPrompt(input);
  return output!;
});

const InferThinkingPatternsInputSchema = z.object({
  positions: z.array(z.object({
    title: z.string(),
    statement: z.string(),
    confidence: z.number().optional(),
  })),
  inquiries: z.array(z.string()),
  works: z.array(z.string()),
  sources: z.array(z.object({
    title: z.string(),
    type: z.string(),
  })),
  links: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.string(),
  })),
  thinkingEvents: z.array(z.object({
    eventType: z.string(),
    summary: z.string(),
  })),
});

const InferThinkingPatternsOutputSchema = z.object({
  patterns: z.array(z.object({
    patternType: z.enum(['evidence_style', 'reasoning_style', 'questioning_style', 'source_bias', 'conceptual_gap', 'revision_pattern', 'contradiction_pattern', 'certainty_pattern']),
    label: z.string(),
    description: z.string(),
    evidence: z.array(z.string()).max(5),
    confidence: z.number().min(0).max(1),
    timespan: z.string(),
    trendDirection: z.enum(['increasing', 'decreasing', 'stable', 'unclear']),
  })).max(6),
});

export async function inferThinkingPatterns(input: z.infer<typeof InferThinkingPatternsInputSchema>) {
  return inferThinkingPatternsFlow(input);
}

const inferThinkingPatternsPrompt = ai.definePrompt({
  name: 'inferThinkingPatternsPrompt',
  input: { schema: InferThinkingPatternsInputSchema },
  output: { schema: InferThinkingPatternsOutputSchema },
  prompt: `Infer provisional thinking patterns from this Noesis workspace.

Positions:
{{#each positions}}
- {{{title}}}: {{{statement}}} (confidence: {{confidence}})
{{/each}}

Inquiries: {{inquiries}}
Works: {{works}}
Sources: {{sources}}
Links: {{links}}
Thinking events: {{thinkingEvents}}

Rules:
- Do not produce fixed identity labels
- Every pattern must cite concrete evidence from the provided material
- Prefer observations about evidence use, revision style, certainty, contradictions, and questioning behavior
- Keep the language provisional`,
});

const inferThinkingPatternsFlow = ai.defineFlow({
  name: 'inferThinkingPatternsFlow',
  inputSchema: InferThinkingPatternsInputSchema,
  outputSchema: InferThinkingPatternsOutputSchema,
}, async (input) => {
  const { output } = await inferThinkingPatternsPrompt(input);
  return output!;
});

const DetectBlindSpotPatternsInputSchema = InferThinkingPatternsInputSchema;
const DetectBlindSpotPatternsOutputSchema = z.object({
  observations: z.array(z.object({
    label: z.string(),
    description: z.string(),
    evidence: z.array(z.string()).max(5),
    confidence: z.number().min(0).max(1),
    timespan: z.string(),
  })).max(4),
});

export async function detectBlindSpotPatterns(input: z.infer<typeof DetectBlindSpotPatternsInputSchema>) {
  return detectBlindSpotPatternsFlow(input);
}

const detectBlindSpotPatternsPrompt = ai.definePrompt({
  name: 'detectBlindSpotPatternsPrompt',
  input: { schema: DetectBlindSpotPatternsInputSchema },
  output: { schema: DetectBlindSpotPatternsOutputSchema },
  prompt: `Review this Noesis workspace for recurring blind spots or neglected dimensions.

Positions: {{positions}}
Inquiries: {{inquiries}}
Works: {{works}}
Sources: {{sources}}
Links: {{links}}
Thinking events: {{thinkingEvents}}

Rules:
- Be careful and provisional
- No accusation without evidence
- Prefer observations about neglected evidence types, domains, or repeated explanation habits
- Return at most 4 observations`,
});

const detectBlindSpotPatternsFlow = ai.defineFlow({
  name: 'detectBlindSpotPatternsFlow',
  inputSchema: DetectBlindSpotPatternsInputSchema,
  outputSchema: DetectBlindSpotPatternsOutputSchema,
}, async (input) => {
  const { output } = await detectBlindSpotPatternsPrompt(input);
  return output!;
});
