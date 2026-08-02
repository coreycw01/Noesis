import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const projectFlagIndex = process.argv.indexOf('--project');
const projectId = projectFlagIndex >= 0 ? process.argv[projectFlagIndex + 1] : process.env.GCLOUD_PROJECT;

if (!projectId) {
  throw new Error('Pass --project <firebase-project-id>. Dry-run is the default.');
}

if (execute && !args.has('--confirm-production-cleanup')) {
  throw new Error('Execution requires --execute --confirm-production-cleanup. Run without these flags first.');
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const AI_ONLY_EVENT_TYPES = new Set([
  'ai_suggestion_generated',
  'ai_suggestion_accepted',
  'ai_suggestion_rejected',
  'suggestion_created',
  'suggestion_accepted',
  'suggestion_dismissed',
  'thinking_pattern_inferred',
  'thinking_pattern_acknowledged',
  'thinking_pattern_dismissed',
  'stress_test_generated',
]);

const stats = {
  users: 0,
  suggestions: 0,
  thinkingEvents: 0,
  thinkingPatterns: 0,
  summaryDocuments: 0,
};

async function deleteRefs(refs) {
  if (!execute || refs.length === 0) return;
  for (let index = 0; index < refs.length; index += 400) {
    const batch = db.batch();
    refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function cleanUser(userDoc) {
  const userRef = userDoc.ref;
  const [suggestions, events, patterns] = await Promise.all([
    userRef.collection('suggestions').get(),
    userRef.collection('thinkingEvents').get(),
    userRef.collection('thinkingPatterns').get(),
  ]);

  const eventRefs = events.docs
    .filter((doc) => {
      const value = doc.data();
      const origin = value.origin || value.sourceType || value.createdFrom;
      return origin === 'ai' || AI_ONLY_EVENT_TYPES.has(value.eventType) || AI_ONLY_EVENT_TYPES.has(value.actionType);
    })
    .map((doc) => doc.ref);

  const patternRefs = patterns.docs
    .filter((doc) => {
      const value = doc.data();
      return value.createdFrom === 'ai' && value.status !== 'acknowledged';
    })
    .map((doc) => doc.ref);

  stats.suggestions += suggestions.size;
  stats.thinkingEvents += eventRefs.length;
  stats.thinkingPatterns += patternRefs.length;

  await deleteRefs(suggestions.docs.map((doc) => doc.ref));
  await deleteRefs(eventRefs);
  await deleteRefs(patternRefs);

  const summaryRefs = [
    userRef.collection('profile').doc('metacognitionSummary'),
    userRef.collection('settings').doc('workspaceSummary'),
    userRef.collection('settings').doc('workspace'),
  ];

  for (const ref of summaryRefs) {
    const snapshot = await ref.get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() || {};
    const hasAiFields = [
      'suggestionIds',
      'aiSuggestionIds',
      'aiSuggestions',
      'pendingAiSuggestions',
      'lastAiSummary',
    ].some((field) => Object.prototype.hasOwnProperty.call(data, field));
    if (!hasAiFields && !data.featureFlags?.aiSuggestions) continue;

    stats.summaryDocuments += 1;
    if (execute) {
      await ref.set({
        suggestionIds: FieldValue.delete(),
        aiSuggestionIds: FieldValue.delete(),
        aiSuggestions: FieldValue.delete(),
        pendingAiSuggestions: FieldValue.delete(),
        lastAiSummary: FieldValue.delete(),
        featureFlags: data.featureFlags ? {
          ...data.featureFlags,
          aiSuggestions: FieldValue.delete(),
        } : FieldValue.delete(),
      }, { merge: true });
    }
  }
}

const users = await db.collection('users').get();
stats.users = users.size;

for (const userDoc of users.docs) {
  await cleanUser(userDoc);
}

console.log(JSON.stringify({
  mode: execute ? 'execute' : 'dry-run',
  projectId,
  ...stats,
}, null, 2));
