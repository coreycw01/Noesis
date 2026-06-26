export type ClarityLevel = 'beginning' | 'developing' | 'strong' | 'integrated';

export interface ConceptDiagnosis {
  level: ClarityLevel;
  clarity: ClarityLevel;
  evidence: ClarityLevel;
  tension: 'low' | 'medium' | 'high';
  embodiment: 'untested' | 'planned' | 'active';
  expression: 'none' | 'draft' | 'published';
  evolving: boolean;
  growthAreas: string[];
  areasToReview: string[];
  suggestedNextAction: string;
  why: string;
}

interface RelatedData {
  sources: { id: string }[];
  annotations: { text?: string; conceptTags?: string[]; tags?: string[] }[];
  questions: { answer?: string; status?: string }[];
  beliefs: { title: string; statement?: string; description?: string; tags?: string[]; evidenceAgainst?: unknown[] }[];
  drafts: { status?: string }[];
  practices: { status?: string }[];
  events: { date: string }[];
}

export function computeConceptDiagnosis(conceptName: string, related: RelatedData, definition?: string): ConceptDiagnosis {
  const { sources, annotations, questions, beliefs, drafts, practices, events } = related;

  const hasDefinition = !!(definition && definition.trim().length > 20);
  const hasOpposition = beliefs.some(b => (b.evidenceAgainst || []).length > 0);
  const now = Date.now();
  const evolving = events.some(e => {
    try { return now - new Date(e.date).getTime() < 30 * 24 * 60 * 60 * 1000; } catch { return false; }
  });

  let clarityPts = 0;
  if (hasDefinition) clarityPts += 2;
  if (annotations.length > 0) clarityPts += 1;
  if (annotations.length > 3) clarityPts += 1;
  if (beliefs.length > 0) clarityPts += 1;
  if (beliefs.some(b => (b.description || '').length > 80)) clarityPts += 1;
  const clarity: ClarityLevel = clarityPts < 2 ? 'beginning' : clarityPts < 4 ? 'developing' : clarityPts < 5 ? 'strong' : 'integrated';

  let evidencePts = 0;
  if (sources.length > 0) evidencePts += 1;
  if (sources.length > 2) evidencePts += 1;
  if (annotations.length > 2) evidencePts += 1;
  if (annotations.length > 5) evidencePts += 1;
  if (hasOpposition) evidencePts += 2;
  const evidence: ClarityLevel = evidencePts < 2 ? 'beginning' : evidencePts < 4 ? 'developing' : evidencePts < 5 ? 'strong' : 'integrated';

  const openQs = questions.filter(q => !q.answer && q.status !== 'answered');
  const tensionPts = (openQs.length > 0 ? 1 : 0) + (hasOpposition ? 1 : 0) + (beliefs.length > 1 ? 1 : 0);
  const tension: 'low' | 'medium' | 'high' = tensionPts < 1 ? 'low' : tensionPts < 2 ? 'medium' : 'high';

  const embodiment: 'untested' | 'planned' | 'active' =
    practices.some(p => p.status === 'active' || p.status === 'completed') ? 'active' :
    practices.some(p => p.status === 'planned') ? 'planned' : 'untested';

  const expression: 'none' | 'draft' | 'published' =
    drafts.some(d => d.status === 'published') ? 'published' :
    drafts.length > 0 ? 'draft' : 'none';

  let total = 0;
  if (hasDefinition) total += 2;
  if (annotations.length > 0) total += 1;
  if (annotations.length > 3) total += 1;
  if (sources.length > 0) total += 1;
  if (beliefs.length > 0) total += 2;
  if (hasOpposition) total += 2;
  if (practices.length > 0) total += 2;
  if (drafts.length > 0) total += 1;
  if (questions.length > 0) total += 1;
  const level: ClarityLevel = total < 3 ? 'beginning' : total < 6 ? 'developing' : total < 10 ? 'strong' : 'integrated';

  const growthAreas: string[] = [];
  if (!hasDefinition) growthAreas.push('Write a clear definition in your own words.');
  if (beliefs.length === 0) growthAreas.push(`Form a position on ${conceptName}.`);
  if (!hasOpposition && beliefs.length > 0) growthAreas.push('Add at least one counterargument to your current position.');
  if (practices.length === 0 && beliefs.length > 0) growthAreas.push('Create a practice that tests your belief.');
  if (sources.length < 2) growthAreas.push('Add a second source — ideally one that challenges your view.');
  if (questions.length === 0) growthAreas.push(`Open an inquiry connected to ${conceptName}.`);
  if (drafts.length === 0 && beliefs.length > 0) growthAreas.push('Express your understanding in a written work.');

  const reviewSet = new Set<string>();
  beliefs.forEach(b => (b.tags || []).forEach(t => { if (t.toLowerCase() !== conceptName.toLowerCase()) reviewSet.add(t); }));
  annotations.forEach(a => ((a.conceptTags || a.tags) || []).forEach(t => { if (t.toLowerCase() !== conceptName.toLowerCase()) reviewSet.add(t); }));
  const areasToReview = Array.from(reviewSet).slice(0, 6);

  const suggestedNextAction = growthAreas[0] || `Review the evolution of ${conceptName} over time.`;

  const whyParts: string[] = [];
  if (!hasDefinition) whyParts.push('definition is still forming');
  if (beliefs.length === 0) whyParts.push('no formal position has been crystallized');
  if (!hasOpposition && beliefs.length > 0) whyParts.push('the position has not yet been challenged');
  if (practices.length === 0 && beliefs.length > 0) whyParts.push('the idea remains untested through practice');

  const why = whyParts.length > 0
    ? `At the ${level} stage because the ${whyParts.join(', ')}.`
    : `Developing well — focus on deepening evidence and expression.`;

  return { level, clarity, evidence, tension, embodiment, expression, evolving, growthAreas: growthAreas.slice(0, 4), areasToReview, suggestedNextAction, why };
}

export const CLARITY_BG: Record<ClarityLevel, string> = {
  beginning: 'bg-slate-100 text-slate-600 border-slate-200',
  developing: 'bg-amber-50 text-amber-700 border-amber-200',
  strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  integrated: 'bg-accent/10 text-accent border-accent/20',
};
