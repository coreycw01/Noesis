import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { collection, connectFirestoreEmulator, deleteDoc, disableNetwork, doc, enableNetwork, getDoc, getDocFromCache, getDocFromServer, getDocs, getDocsFromServer, initializeFirestore, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, terminate, Timestamp, updateDoc, where, writeBatch, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, deleteObject, getBytes, getStorage, ref, uploadBytes } from 'firebase/storage';
import { commitWorkspaceMutation } from '../../src/lib/workspace-mutations';
import { contextDeskWorkDraft, contextDeskWorkProvenance, isContextDeskReviewRetry } from '../../src/lib/context-desk-work';
import { thinkingHistoryQuery } from '../../src/lib/thinkingEvents/history-query';
import { mergeThinkingHistory } from '../../src/lib/evolution-history';
import { appearanceSettingsWrites, type AppearanceSnapshot } from '../../src/lib/appearance';
import { workDefaultPreferencePatch } from '../../src/lib/settings-drafts';
import type { WorksSettings } from '../../src/lib/types';
import { annotationRecord, inquiryAnnotationUpdates } from '../../src/lib/collection-integrity';
import { exportSavedWorkspace } from '../../src/lib/workspace-export';
import { loadWorkspaceFindData } from '../../src/lib/workspace-find-data';
import { writeInquiryAiReview, type InquiryAiReview } from '../../src/lib/inquiry-ai-review';
import { applyGoalCheckIn, applyGoalPlan, writeGoalSettings } from '../../src/lib/goal-persistence';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { publishProfileSelection } from '../../src/lib/public-profile-publication';
import { recordProfileActivity } from '../../src/lib/profile-activity';
import { writeProfileReview, type ProfileReviewApproval } from '../../src/lib/profile-edit';
import { writeConceptReview, type ConceptReviewApproval } from '../../src/lib/concept-ai-review';
import { writeSourceReview, type SourceReviewApproval } from '../../src/lib/source-ai-review';
import { writeAnnotationReview, type AnnotationReviewApproval } from '../../src/lib/annotation-ai-review';
import { writePracticeReview, type PracticeReviewApproval } from '../../src/lib/practice-ai-review';
import { writePositionReview, type PositionReviewApproval } from '../../src/lib/position-ai-review';
import { acceptedTextHash, type AiProvenanceRecord } from '../../src/lib/ai-provenance';
import { writeAtlasNodePosition } from '../../src/lib/atlas-node-position';
import { DEFAULT_PROFILE_PRIVACY } from '../../src/lib/firestore-schema';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { removeWorkspaceUploads } from '../../src/lib/server/remove-workspace-uploads';
import { reserveAiSlot } from '../../src/lib/server/ai-concurrency';
import { removeOwnedPublicProfiles } from '../../src/lib/server/remove-public-profiles';
import { makeThinkingEventPayload, writePeriodSynthesis, type WriteThinkingEventInput } from '../../src/lib/thinkingEvents/writeThinkingEvent';
import { RECOVERY_EVENT_TYPES, RECOVERY_RETENTION_MS, recentRecoverableDeletions, sourceRecoveryAnnotations } from '../../src/lib/deleted-items';
import type { Annotation, ThinkingEvent } from '../../src/lib/types';

const projectId = 'demo-noesis-rules';
const apps: FirebaseApp[] = [];
const databases: Firestore[] = [];
const localAddress = (value: string | undefined) => {
  const match = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(value || '');
  if (!match) throw new Error('Run npm run test:rules with the local Firebase emulators.');
  return { host: match[1], port: Number(match[2]) };
};

function context(uid?: string) {
  const firestoreAddress = localAddress(process.env.FIRESTORE_EMULATOR_HOST);
  const storageAddress = localAddress(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, `noesis-rules-${apps.length}`);
  apps.push(app);
  const options = uid ? { mockUserToken: { sub: uid } } : {};
  return {
    firestore() {
      const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
      connectFirestoreEmulator(db, firestoreAddress.host, firestoreAddress.port, options);
      databases.push(db);
      return db;
    },
    storage() {
      const storage = getStorage(app);
      connectStorageEmulator(storage, storageAddress.host, storageAddress.port, options);
      return storage;
    },
  };
}
const env = { authenticatedContext: context, unauthenticatedContext: () => context() };
const assertSucceeds = <T>(operation: Promise<T>) => operation;
const assertFails = (operation: Promise<unknown>) => assert.rejects(operation, { code: /^(permission-denied|storage\/(unauthorized|unauthenticated))$/ });

test('AI concurrency is shared across server clients and recovers expired slots', async () => {
  localAddress(process.env.FIRESTORE_EMULATOR_HOST);
  const apps = ['a', 'b'].map((name) => initializeAdminApp({ projectId }, `ai-slot-${name}`));
  try {
    const [a, b] = apps.map((app) => getAdminFirestore(app));
    let now = Date.now();
    const clock = () => now;
    const uid = 'ai-concurrency-test';
    const slots = await Promise.all([reserveAiSlot(a, uid, clock), reserveAiSlot(b, uid, clock), reserveAiSlot(a, uid, clock)]);
    const accepted = slots.filter((slot) => slot !== null);
    assert.equal(accepted.length, 2);
    await accepted[0]();
    const replacement = await reserveAiSlot(b, uid, clock);
    assert.ok(replacement);
    assert.equal(await reserveAiSlot(a, uid, clock), null);
    now += 120_001;
    const recovered = await reserveAiSlot(a, uid, clock);
    const other = await reserveAiSlot(b, uid, clock);
    assert.ok(recovered && other);
    await replacement();
    assert.equal(await reserveAiSlot(a, uid, clock), null);
    await recovered();
    await other();
  } finally {
    await Promise.all(apps.map((app) => deleteAdminApp(app)));
  }
});

test('profile activity merges two recorded days, preserves identity, and remains owner-only', async () => {
  const uid = 'profile-activity-owner';
  const first = doc(context(uid).firestore(), `users/${uid}/profile/main`);
  const second = doc(context(uid).firestore(), first.path);
  await setDoc(first, { displayName: 'Existing identity' });
  const legacyPath = `users/${uid}/settings/profile`;
  await setDoc(doc(first.firestore, legacyPath), { dailyActivityDates: ['2026-11-11'] });
  const record = (target: typeof first, day: string) => recordProfileActivity(target, doc(target.firestore, legacyPath), day);
  await Promise.all([record(first, '2026-11-13'), record(second, '2026-11-12')]);
  await record(first, '2026-11-12');
  assert.deepEqual((await getDocFromServer(first)).data(), {
    displayName: 'Existing identity',
    dailyActivityDates: ['2026-11-11', '2026-11-12', '2026-11-13'],
    lastActiveDate: '2026-11-13',
  });
  await assertFails(record(doc(context('other-activity-user').firestore(), first.path), '2026-11-14'));
});

test('two first-time activity writes converge on one profile without dropping either date', async () => {
  const uid = 'new-profile-activity-owner';
  const first = context(uid).firestore();
  const second = context(uid).firestore();
  const main = `users/${uid}/profile/main`;
  const legacy = `users/${uid}/settings/profile`;
  assert.equal((await getDocFromServer(doc(first, main))).exists(), false);
  await Promise.all([
    recordProfileActivity(doc(first, main), doc(first, legacy), '2026-11-13'),
    recordProfileActivity(doc(second, main), doc(second, legacy), '2026-11-14'),
  ]);
  assert.deepEqual((await getDocFromServer(doc(first, main))).data(), {
    dailyActivityDates: ['2026-11-13', '2026-11-14'],
    lastActiveDate: '2026-11-14',
  });
});

test('profile review saves private field provenance once and rejects stale or altered approvals', async () => {
  const uid = 'profile-review-owner';
  const db = context(uid).firestore();
  const other = context(uid).firestore();
  const root = `users/${uid}`;
  const date = '2026-11-13T12:00:00Z';
  const baseline = { displayName: 'Existing identity', email: 'profile-review@example.test', philosophyStatement: 'Earlier statement', aiReviewHistory: [] };
  await setDoc(doc(db, root, 'profile', 'main'), baseline);
  const approval: ProfileReviewApproval = {
    baseline, text: '## Working statement\nRevised statement',
    result: { action: 'synthesize_profile_philosophy', targetType: 'profile', targetId: uid,
      reviewId: 'profile-test', generatedAt: date, title: 'Review', content: 'Private original', contextSummary: '' },
  };
  const save = (client: Firestore, input = approval) => writeProfileReview(doc(client, root, 'profile', 'main'), input, date, {
    collection: collection(client, root, 'thinkingEvents'), userId: uid, entityId: 'main', entityType: 'profile',
    eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Philosophy review',
  });
  await Promise.all([save(db), save(other)]);
  await assert.rejects(save(db, { ...approval, text: 'An altered review' }), /different content/);
  await assert.rejects(save(db, { ...approval, result: { ...approval.result, reviewId: 'stale' } }), /changed before/);
  const saved = (await getDocFromServer(doc(db, root, 'profile', 'main'))).data();
  assert.equal(saved?.displayName, baseline.displayName);
  assert.equal(saved?.philosophyStatement, 'Revised statement');
  assert.equal(saved?.philosophyStatementProvenance.provenanceId, 'ai-review-profile-test');
  const origins = await getDocs(collection(db, root, 'aiProvenance'));
  assert.equal(origins.size, 1);
  assert.equal(origins.docs[0].data().targets.length, 2);
  const events = await getDocs(collection(db, root, 'thinkingEvents'));
  assert.equal(events.size, 1);
  assert.doesNotMatch(JSON.stringify(events.docs[0].data()), /Private original/);
});

test('concept AI review saves only its field with private provenance and a single history event', async () => {
  const uid = 'concept-review-owner';
  const db = context(uid).firestore();
  const other = context(uid).firestore();
  const root = `users/${uid}`;
  const baseline = buildDemoWorkspace(uid).concepts[0];
  const ref = doc(db, root, 'concepts', baseline.id);
  await setDoc(ref, baseline);
  await updateDoc(ref, { examples: ['New example from another tab'] });
  const date = '2026-11-13T12:00:00Z';
  const approval: ConceptReviewApproval = {
    baseline, text: 'New boundary',
    result: { action: 'clarify_concept_boundaries', targetType: 'concept', targetId: baseline.id,
      reviewId: 'concept-test', generatedAt: date, title: 'Review', content: 'Private precursor', contextSummary: '' },
  };
  const save = (client: Firestore, input = approval) => writeConceptReview(doc(client, ref.path), input, date, {
    collection: collection(client, root, 'thinkingEvents'), userId: uid, entityId: baseline.id, entityType: 'concept',
    eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Concept review',
  });
  await Promise.all([save(db), save(other)]);
  await assert.rejects(save(db, { ...approval, text: 'Altered retry' }), /different content/);
  await assert.rejects(save(db, { ...approval, result: { ...approval.result, reviewId: 'stale' } }), /changed before/);
  const saved = (await getDocFromServer(ref)).data();
  assert.equal(saved?.description, baseline.description);
  assert.deepEqual(saved?.examples, ['New example from another tab']);
  assert.equal(saved?.boundaryReview, 'New boundary');
  assert.equal(saved?.boundaryProvenance.provenanceId, 'ai-review-concept-test');
  const origins = await getDocs(collection(db, root, 'aiProvenance'));
  const events = await getDocs(collection(db, root, 'thinkingEvents'));
  assert.equal(origins.size, 1);
  assert.equal(origins.docs[0].data().targets[0].fieldPath, 'boundaryReview');
  assert.equal(events.size, 1);
  assert.doesNotMatch(JSON.stringify(events.docs[0].data()), /Private precursor|New boundary/);
});

test('source reflection approval preserves newer authored capture and commits private provenance once', async () => {
  const uid = 'source-review-owner';
  const db = context(uid).firestore();
  const other = context(uid).firestore();
  const root = `users/${uid}`;
  const baseline = { ...buildDemoWorkspace(uid).media[0], capture: { sessions: [], after: { lasting: 'Old note', aiSummary: 'Separate summary' } } };
  const ref = doc(db, root, 'media', baseline.id);
  await setDoc(ref, baseline);
  await updateDoc(ref, { 'capture.after.lasting': 'New authored note' });
  const date = '2026-11-13T12:00:00Z';
  const approval: SourceReviewApproval = {
    baseline, text: 'Approved reflection',
    result: { action: 'reflect_on_source', targetType: 'source', targetId: baseline.id,
      reviewId: 'source-test', generatedAt: date, title: 'Reflection', content: 'Private precursor', contextSummary: '' },
  };
  const save = (client: Firestore, input = approval) => writeSourceReview(doc(client, ref.path), input, date, {
    collection: collection(client, root, 'thinkingEvents'), userId: uid, entityId: baseline.id, entityType: 'source',
    eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Source reflection',
  });
  await Promise.all([save(db), save(other)]);
  await assert.rejects(save(db, { ...approval, text: 'Altered retry' }), /different content/);
  await assert.rejects(save(db, { ...approval, result: { ...approval.result, reviewId: 'stale' } }), /review changed/);
  const saved = (await getDocFromServer(ref)).data();
  assert.deepEqual(saved?.capture.after, { lasting: 'New authored note', aiSummary: 'Separate summary', aiReflection: 'Approved reflection' });
  assert.equal(saved?.reflectionProvenance.provenanceId, 'ai-review-source-test');
  const origins = await getDocs(collection(db, root, 'aiProvenance'));
  const events = await getDocs(collection(db, root, 'thinkingEvents'));
  assert.equal(origins.size, 1);
  assert.equal(origins.docs[0].data().targets[0].fieldPath, 'capture.after.aiReflection');
  assert.equal(events.size, 1);
  assert.doesNotMatch(JSON.stringify(events.docs[0].data()), /Private precursor|Approved reflection/);
});

test('source claim approval creates one referenced annotation and preserves matching user notes', async () => {
  const uid = 'source-claim-review-owner';
  const db = context(uid).firestore();
  const other = context(uid).firestore();
  const root = `users/${uid}`;
  const date = '2026-11-13T12:00:00Z';
  const baseline = { ...buildDemoWorkspace(uid).media[0], annotations: [] };
  const ref = doc(db, root, 'media', baseline.id);
  await setDoc(ref, baseline);
  const existing = { id: 'user-claim', text: 'Already noted.', type: 'claim', date };
  await updateDoc(ref, { annotations: [existing] });
  const approval: SourceReviewApproval = {
    baseline, text: '- Already noted.\n- A new approved claim.',
    result: { action: 'extract_source_claims', targetType: 'source', targetId: baseline.id,
      reviewId: 'claims-test', generatedAt: date, title: 'Claims', content: 'Private precursor', contextSummary: '' },
  };
  const save = (client: Firestore) => writeSourceReview(doc(client, ref.path), approval, date, {
    collection: collection(client, root, 'thinkingEvents'), userId: uid, entityId: baseline.id, entityType: 'source',
    eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Accepted source claims',
  });
  await Promise.all([save(db), save(other)]);
  const items = await getDocs(collection(db, root, 'annotations'));
  assert.equal(items.size, 1);
  const added = items.docs[0].data();
  assert.equal(added.text, 'A new approved claim.');
  assert.equal(added.sourceId, baseline.id);
  assert.equal(added.textProvenance.provenanceId, 'ai-review-claims-test');
  const source = (await getDocFromServer(ref)).data();
  assert.equal(source?.annotations.length, 2);
  assert.deepEqual(source?.annotations.find((item: { id: string }) => item.id === existing.id), existing);
  const origin = (await getDocFromServer(doc(db, root, 'aiProvenance', 'ai-review-claims-test'))).data();
  assert.deepEqual(origin?.targets, [{ type: 'annotation', id: added.id, fieldPath: 'text', subrecordId: added.id }]);
  assert.equal((await getDocs(collection(db, root, 'thinkingEvents'))).size, 1);
});

test('annotation effect approval preserves canonical links and records one private origin and event', async () => {
  const uid = 'annotation-effect-owner';
  const db = context(uid).firestore();
  const other = context(uid).firestore();
  const root = `users/${uid}`;
  const date = '2026-11-13T12:00:00Z';
  const baseline: Annotation = { id: 'note', type: 'thought', text: 'User text', date, conceptTags: [] };
  const source = doc(db, root, 'media', 'source');
  const note = doc(db, root, 'annotations', baseline.id);
  await setDoc(source, { id: 'source', annotations: [baseline] });
  await setDoc(note, { ...baseline, sourceId: source.id, linkedPositionIds: ['newer-link'] });
  const approval: AnnotationReviewApproval = { text: 'Reviewed effect', result: {
    action: 'suggest_annotation_effect', targetType: 'annotation', targetId: 'source:note',
    reviewId: 'effect-test', generatedAt: date, title: 'Effect', content: 'Private precursor', contextSummary: '',
  } };
  const save = (client: Firestore, input = approval) => writeAnnotationReview(doc(client, source.path), baseline, input, date, {
    collection: collection(client, root, 'thinkingEvents'), userId: uid, entityId: baseline.id, entityType: 'annotation',
    eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Approved effect',
  });
  await Promise.all([save(db), save(other)]);
  await assert.rejects(save(db, { ...approval, text: 'Altered retry' }), /different content/);
  const saved = (await getDocFromServer(note)).data();
  assert.equal(saved?.aiEffectReview, approval.text);
  assert.equal(saved?.text, baseline.text);
  assert.deepEqual(saved?.linkedPositionIds, ['newer-link']);
  const nested = (await getDocFromServer(source)).data()?.annotations[0];
  assert.deepEqual(nested.linkedPositionIds, ['newer-link']);
  assert.deepEqual(nested.effectProvenance, saved?.effectProvenance);
  const origins = await getDocs(collection(db, root, 'aiProvenance'));
  const events = await getDocs(collection(db, root, 'thinkingEvents'));
  assert.equal(origins.size, 1);
  assert.equal(events.size, 1);
  assert.doesNotMatch(JSON.stringify(events.docs[0].data()), /Private precursor|Reviewed effect/);
});

test('practice review attaches provenance without replacing authored outcome or observations', async () => {
  const uid = 'practice-review-owner';
  const first = context(uid).firestore();
  const second = context(uid).firestore();
  const root = `users/${uid}`;
  const date = '2026-11-13T18:00:00Z';
  const baseline = { ...buildDemoWorkspace(uid).practices[0], status: 'completed' as const, observedOutcome: 'First observation' };
  const path = `${root}/practices/${baseline.id}`;
  await setDoc(doc(first, path), baseline);
  await updateDoc(doc(second, path), { observedOutcome: 'Newer observation' });
  const approval: PracticeReviewApproval = { text: 'Reviewed outcome', result: {
    action: 'synthesize_practice_outcome', targetType: 'practice', targetId: baseline.id,
    reviewId: 'practice-review', generatedAt: date, title: 'Outcome', content: 'Private original', contextSummary: '',
  } };
  const save = (db: Firestore, input = approval) => writePracticeReview(doc(db, path), baseline, input, date, {
    collection: collection(db, root, 'thinkingEvents'), userId: uid, entityType: 'practice', entityId: baseline.id,
    eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Practice review',
  });
  await Promise.all([save(first), save(second)]);
  await assert.rejects(save(first, { ...approval, text: 'Changed approval' }), /different content/);
  await updateDoc(doc(second, path), { status: 'active' });
  await assert.rejects(save(first, { ...approval, result: { ...approval.result, reviewId: 'new' } }), /concluded practice/);
  const saved = (await getDocFromServer(doc(first, path))).data();
  assert.equal(saved?.observedOutcome, 'Newer observation');
  assert.equal(saved?.aiOutcomeReview, approval.text);
  assert.equal(saved?.outcomeProvenance.provenanceId, 'ai-review-practice-review');
  const origins = await getDocs(collection(first, root, 'aiProvenance'));
  const events = await getDocs(collection(first, root, 'thinkingEvents'));
  assert.equal(origins.size, 1);
  assert.equal(events.size, 1);
  assert.doesNotMatch(JSON.stringify(events.docs[0].data()), /Private original|Reviewed outcome/);
});

test('position comparison approval preserves newer confidence and rejects a different comparison retry', async () => {
  const uid = 'position-review-owner';
  const db = context(uid).firestore();
  const other = context(uid).firestore();
  const root = `users/${uid}`;
  const [position, comparison] = buildDemoWorkspace(uid).vault;
  const ref = doc(db, root, 'vault', position.id);
  await setDoc(ref, position);
  await setDoc(doc(db, root, 'vault', comparison.id), comparison);
  await updateDoc(ref, { confidence: 42 });
  const date = '2026-11-13T12:00:00Z';
  const approval: PositionReviewApproval = { comparisonId: comparison.id, text: 'Approved comparison', result: {
    action: 'compare_selected_positions', targetType: 'position', targetId: position.id,
    reviewId: 'position-review', generatedAt: date, title: 'Comparison', content: 'Private original', contextSummary: '',
  } };
  const save = (client: Firestore, input = approval) => writePositionReview(doc(client, ref.path), input, date, {
    collection: collection(client, root, 'thinkingEvents'), userId: uid, entityId: position.id, entityType: 'position',
    eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Position comparison',
  });
  await Promise.all([save(db), save(other)]);
  await assert.rejects(save(db, { ...approval, comparisonId: 'different' }), /different content/);
  const saved = (await getDocFromServer(ref)).data();
  assert.equal(saved?.confidence, 42);
  assert.equal(saved?.comparisonReviews.length, 1);
  assert.equal(saved?.comparisonReviews[0].positionId, comparison.id);
  const origins = await getDocs(collection(db, root, 'aiProvenance'));
  const events = await getDocs(collection(db, root, 'thinkingEvents'));
  assert.equal(origins.size, 1);
  assert.equal(origins.docs[0].data().targets[0].fieldPath, 'comparisonReviews');
  assert.deepEqual(origins.docs[0].data().contextRefs, [{ type: 'position', id: comparison.id }]);
  assert.equal(events.size, 1);
  assert.doesNotMatch(JSON.stringify(events.docs[0].data()), /Private original|Approved comparison/);
});

test('commitment check-ins do not overwrite goal edits and are recorded only once per day', async () => {
  const uid = 'goal-checkin-owner';
  const first = context(uid).firestore();
  const second = context(uid).firestore();
  const path = `users/${uid}/settings/goal`;
  const seed = buildDemoWorkspace(uid).goal;
  const item = { ...seed.goals![0], status: 'active' as const, commitmentCheckIns: [], commitmentReviewDate: '2026-11-13' };
  const initial = { ...seed, goals: [item] };
  const draft = { ...initial, goals: [{ ...item, title: 'Edited title' }] };
  await setDoc(doc(first, path), initial);
  const date = '2026-11-13T12:00:00';
  const log = (id: string) => writeGoalSettings(doc(second, path), initial, (current) =>
    applyGoalCheckIn(current, item.id, { id, date, status: 'completed' }));
  const outcomes = await Promise.allSettled([
    writeGoalSettings(doc(first, path), initial, (current) => applyGoalPlan(draft, initial, current)),
    log('first'), log('second'),
  ]);
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes.slice(1).filter((entry) => entry.status === 'fulfilled').length, 1);
  const [saved] = (await getDoc(doc(first, path))).data()?.goals || [];
  assert.equal(saved.title, 'Edited title');
  assert.equal(saved.currentProgress, item.currentProgress);
  assert.equal(saved.commitmentCheckIns.length, 1);
  await assert.rejects(writeGoalSettings(doc(second, path), initial, (current) =>
    applyGoalPlan({ ...initial, goals: [{ ...item, title: 'Stale title' }] }, initial, current)), /changed in another/);
  assert.equal((await getDoc(doc(first, path))).data()?.goals?.[0]?.title, 'Edited title');
});

test('Inquiry AI acceptance writes one event and preserves a newer answer and existing notes', async () => {
  const uid = 'inquiry-review-owner';
  const first = context(uid).firestore();
  const second = context(uid).firestore();
  const path = `users/${uid}`;
  const inquiry = doc(first, path, 'questions', 'inquiry');
  const date = '2026-11-13T12:00:00Z';
  await setDoc(inquiry, { status: 'open', answer: 'Earlier answer', investigationNotes: [{ id: 'manual', text: 'User note', origin: 'user', date }] });
  await updateDoc(doc(second, path, 'questions', 'inquiry'), { answer: 'Answer edited in another tab' });
  const review: InquiryAiReview = { action: 'socratic_inquiry_challenge', targetType: 'inquiry', targetId: 'inquiry', reviewId: 'review-one', generatedAt: date, content: 'Private generated precursor' };
  const save = (db: Firestore, candidate = review, content = '## Question\nWhat would make this false?\n\n## Next step\nCompare a contrary example.') => writeInquiryAiReview(doc(db, path, 'questions', 'inquiry'), candidate,
    content, date, {
      collection: collection(db, path, 'thinkingEvents'), userId: uid, entityId: 'inquiry', entityType: 'inquiry',
      eventType: 'suggestion_accepted', origin: 'ai-assisted', summary: 'Reviewed contextual assistance',
      idempotencyKey: `ai-review-${candidate.reviewId}`, metadata: { reviewEntryId: candidate.reviewId },
    });
  await Promise.all([save(first), save(second)]);
  await assert.rejects(save(second, review, 'Altered retry'), /different content/);
  const saved = (await getDoc(inquiry)).data();
  assert.equal(saved?.answer, 'Answer edited in another tab');
  assert.deepEqual(saved?.investigationNotes.map((note: { id: string }) => note.id), ['manual', 'review-one:0', 'review-one:1']);
  await updateDoc(inquiry, { status: 'archived' });
  await assert.rejects(save(second, { ...review, reviewId: 'review-two' }), /Reopen/);
  const events = await getDocs(collection(first, path, 'thinkingEvents'));
  assert.equal(events.size, 1);
  assert.equal(events.docs[0].data().after, null);
  const provenance = doc(first, path, 'aiProvenance', 'ai-review-review-one');
  const origin = (await getDocFromServer(provenance)).data();
  assert.equal(origin?.precursor, 'Private generated precursor');
  assert.equal(origin?.targets.length, 2);
  assert.equal(saved?.investigationNotes[1].provenance.provenanceId, provenance.id);
  assert.equal(events.docs[0].data().metadata.provenanceId, provenance.id);
  assert.doesNotMatch(JSON.stringify(events.docs[0].data()), /Private generated precursor/);
  await assertFails(getDocFromServer(doc(context('other-provenance-user').firestore(), provenance.path)));
  await assertFails(updateDoc(provenance, { precursor: 'Replaced' }));
});

after(async () => {
  await Promise.all(databases.map((db) => terminate(db)));
  await Promise.all(apps.map((app) => deleteApp(app)));
});

test('workspace reads and export queries are owner-only', async () => {
  const owner = env.authenticatedContext('workspace-owner').firestore();
  const outsider = env.authenticatedContext('workspace-outsider').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const path = 'users/workspace-owner/settings/ai';
  await assertSucceeds(setDoc(doc(owner, path), { aiAssistanceEnabled: true }));
  assert.equal((await assertSucceeds(getDocs(collection(owner, 'users/workspace-owner/settings')))).size, 1);
  await assertFails(getDoc(doc(guest, path)));
  await assertFails(getDocs(collection(outsider, 'users/workspace-owner/settings')));
  await assertFails(updateDoc(doc(outsider, path), { aiAssistanceEnabled: false }));
  await assertFails(setDoc(doc(owner, 'users/workspace-owner/questions/fake'), { userId: 'workspace-outsider' }));
  await assertFails(setDoc(doc(owner, 'users/workspace-owner/questions/one/private/two'), { title: 'Unexpected nested write' }));
  await assertFails(getDoc(doc(owner, 'apiUsage/owner')));
});

test('Find reads all its collections under the requested owner and rejects other sessions', async () => {
  const uid = 'find-owner';
  const owner = context(uid).firestore();
  const outsider = context('find-outsider').firestore();
  const guest = context().firestore();
  const account = doc(owner, 'users', uid);
  const oldAnnotation = { id: 'old-note', date: '2026-11-12', text: 'Earlier text', type: 'thought' };
  const seed = writeBatch(owner);
  seed.set(doc(account, 'media', 'source'), { title: 'First source', annotations: [oldAnnotation] });
  seed.set(doc(account, 'annotations', 'old-note'), { ...oldAnnotation, sourceId: 'source', userId: uid, text: 'Latest text' });
  for (let index = 0; index < 32; index++) {
    seed.set(doc(account, 'concepts', `concept-${index}`), { name: `Concept ${index}` });
  }
  await seed.commit();

  const found = await loadWorkspaceFindData(account);
  assert.equal(found.concepts.length, 32);
  assert.deepEqual(found.media[0].annotations.map((item) => [item.id, item.text]), [['old-note', 'Latest text']]);
  await assertFails(loadWorkspaceFindData(doc(outsider, 'users', uid)));
  await assertFails(loadWorkspaceFindData(doc(guest, 'users', uid)));
  await disableNetwork(owner);
  try {
    const cached = await loadWorkspaceFindData(account, undefined, 'cache');
    assert.equal(cached.concepts.length, 32);
    assert.equal(cached.media[0].annotations[0].text, 'Latest text');
    const cold = await loadWorkspaceFindData(doc(outsider, 'users', 'find-outsider'), undefined, 'cache');
    assert.deepEqual(cold.concepts, []);
    assert.deepEqual(cold.media, []);
  } finally {
    await enableNetwork(owner);
  }
});

test('independent appearance edits merge across clients and preserve legacy preferences', async () => {
  const uid = 'appearance-owner';
  const first = context(uid).firestore();
  const second = context(uid).firestore();
  const outsider = context('appearance-outsider').firestore();
  const root = `users/${uid}/settings`;
  await setDoc(doc(first, root, 'preferences'), { themeMode: 'light', accentTheme: 'sage', writingDefaults: { type: 'essay' } });
  const save = (db: Firestore, changes: Partial<AppearanceSnapshot>) => {
    const writes = appearanceSettingsWrites(changes, '2026-11-13T12:00:00Z');
    return commitWorkspaceMutation({
      db, ref: doc(db, root, 'appearance'), operation: 'set', setOptions: { merge: true }, data: writes.appearance,
      relatedWrites: writes.preferences ? [
        { ref: doc(db, root, 'preferences'), operation: 'set', data: writes.preferences, setOptions: { merge: true } },
      ] : [],
    });
  };
  await Promise.all([save(first, { themeMode: 'dark' }), save(second, { highContrastMode: true })]);
  await assertFails(save(outsider, { themeMode: 'light', highContrastMode: false }));
  const appearance = (await getDocFromServer(doc(first, root, 'appearance'))).data();
  const preferences = (await getDocFromServer(doc(second, root, 'preferences'))).data();
  assert.equal(appearance?.themeMode, 'dark');
  assert.equal(appearance?.highContrastMode, true);
  assert.equal(preferences?.themeMode, 'dark');
  assert.equal(preferences?.accentTheme, 'sage');
  assert.deepEqual(preferences?.writingDefaults, { type: 'essay' });
  assert.equal(preferences?.highContrastMode, undefined);
});

test('work default edits from different clients preserve each other and legacy writing preferences', async () => {
  const uid = 'work-defaults-owner';
  const first = context(uid).firestore();
  const second = context(uid).firestore();
  const root = `users/${uid}/settings`;
  await setDoc(doc(first, root, 'preferences'), { themeMode: 'dark', writingDefaults: { status: 'drafting' } });
  const save = (db: Firestore, changes: Partial<WorksSettings>) => commitWorkspaceMutation({
    db, ref: doc(db, root, 'works'), operation: 'set', setOptions: { merge: true }, data: changes,
    relatedWrites: [{ ref: doc(db, root, 'preferences'), operation: 'set', setOptions: { merge: true },
      data: { writingDefaults: workDefaultPreferencePatch(changes) } }],
  });
  await Promise.all([
    save(first, { defaultEditorMode: 'focused' }),
    save(second, { defaultPaperStyle: 'blank_paper' }),
  ]);
  const works = (await getDocFromServer(doc(first, root, 'works'))).data();
  const preferences = (await getDocFromServer(doc(second, root, 'preferences'))).data();
  assert.equal(works?.defaultEditorMode, 'focused');
  assert.equal(works?.defaultPaperStyle, 'blank_paper');
  assert.equal(preferences?.themeMode, 'dark');
  assert.deepEqual(preferences?.writingDefaults, { status: 'drafting', editorFeel: 'focused', writingStyle: 'blank_paper' });
});

test('Evolution history pages combine legacy dates and timestamps in chronological order', async () => {
  const uid = 'history-date-owner';
  const db = context(uid).firestore();
  const ref = collection(db, 'users', uid, 'thinkingEvents');
  const dates = [
    ['first', Timestamp.fromDate(new Date('2026-11-10'))],
    ['second', '2026-11-09'],
    ['third', Timestamp.fromDate(new Date('2026-11-08'))],
    ['fourth', '2026-11-07T00:00:00Z'],
  ] as const;
  const batch = writeBatch(db);
  for (const [id, createdAt] of dates) batch.set(doc(ref, id), { eventId: id, actorId: uid, schemaVersion: 2, createdAt, summary: id });
  await batch.commit();
  const read = async (size: number, format: 'timestamp' | 'legacy') => (await getDocs(thinkingHistoryQuery(ref, size, format)))
    .docs.map((entry) => ({ ...entry.data(), id: entry.id } as ThinkingEvent));
  const [modern, legacy] = await Promise.all([read(2, 'timestamp'), read(2, 'legacy')]);
  assert.deepEqual(modern.map(({ id }) => id), ['first', 'third']);
  assert.deepEqual(legacy.map(({ id }) => id), ['second', 'fourth']);
  const merged = mergeThinkingHistory(modern, legacy);
  assert.deepEqual(merged.slice(0, 2).map(({ id }) => id), ['first', 'second']);
  assert.deepEqual(merged.slice(2).map(({ id }) => id), ['third', 'fourth']);
});

test('Evolution expands through multiple history windows without losing events or exposing another account', async () => {
  const uid = 'large-history-owner';
  const db = context(uid).firestore();
  const outsider = context('large-history-outsider').firestore();
  const ref = collection(db, 'users', uid, 'thinkingEvents');
  const batch = writeBatch(db);
  const expected = Array.from({ length: 437 }, (_, index) => {
    const id = `event-${index}`;
    const date = new Date(Date.UTC(2026, 10, 13) - index * 86_400_000);
    const createdAt = index % 2 ? date.toISOString() : Timestamp.fromDate(date);
    batch.set(doc(ref, id), { eventId: id, actorId: uid, schemaVersion: 2, createdAt, summary: id });
    return id;
  });
  await batch.commit();

  const load = async (size: number) => {
    const [modern, legacy] = await Promise.all((['timestamp', 'legacy'] as const).map(async (format) =>
      (await getDocs(thinkingHistoryQuery(ref, size, format))).docs
        .map((entry) => ({ ...entry.data(), id: entry.id } as ThinkingEvent)),
    ));
    const merged = mergeThinkingHistory(modern, legacy);
    return { ids: merged.slice(0, size).map(({ id }) => id), hasMore: merged.length > size };
  };

  for (const size of [200, 400, 600]) {
    assert.deepEqual(await load(size), { ids: expected.slice(0, size), hasMore: expected.length > size });
  }
  const privateHistory = collection(outsider, 'users', uid, 'thinkingEvents');
  for (const format of ['timestamp', 'legacy'] as const) {
    await assertFails(getDocs(thinkingHistoryQuery(privateHistory, 200, format)));
  }
});

test('concurrent Context Desk acceptance creates one work and one history event', async () => {
  const uid = 'context-review-owner';
  const first = context(uid).firestore();
  const second = context(uid).firestore();
  const result = {
    action: 'review_selected_context', targetType: 'context_desk', targetId: 'selection',
    title: 'Review', content: 'Original', contextSummary: '', generatedAt: '2026-11-13',
    reviewId: '10c8ca1b-3117-4fc4-95ad-55e5cccb5f55',
  } as const;
  const draft = contextDeskWorkDraft(result, 'Reviewed', []);
  const root = `users/${uid}`;
  const accept = async (db: Firestore, data = draft) => {
    const originRef = doc(db, root, 'aiProvenance', draft.id!);
    const provenance = await contextDeskWorkProvenance(draft.id!, uid, { result, records: [{ type: 'source', id: 'source-one' }] }, data.aiReviewHistory![0].content, serverTimestamp());
    return commitWorkspaceMutation({
      db, ref: doc(db, root, 'drafts', draft.id!), operation: 'create',
      data: { ...data, bodyProvenance: { provenanceId: provenance.id, kind: provenance.kind } },
      acceptExistingCreate: (existing) => isContextDeskReviewRetry(existing, data),
      relatedWrites: [{ ref: originRef, operation: 'create', data: provenance }],
      thinkingEvent: {
        collection: collection(db, root, 'thinkingEvents'), userId: uid,
        eventType: 'created', entityType: 'work', entityId: draft.id!, summary: 'Reviewed context', origin: 'ai-assisted',
        idempotencyKey: provenance.id, metadata: { provenanceId: provenance.id, fieldPath: 'body' },
      },
    });
  };
  await Promise.all([accept(first), accept(second)]);
  assert.equal((await getDocs(collection(first, root, 'drafts'))).size, 1);
  assert.equal((await getDocs(collection(first, root, 'thinkingEvents'))).size, 1);
  const provenance = await getDocs(collection(first, root, 'aiProvenance'));
  assert.equal(provenance.size, 1);
  assert.equal(provenance.docs[0].data().precursor, 'Original');
  assert.deepEqual(provenance.docs[0].data().contextRefs, [{ type: 'source', id: 'source-one' }]);
  await assert.rejects(accept(second, contextDeskWorkDraft(result, 'Different edits', [])), /already exists/);
  await assert.rejects(accept(second, { ...draft, sourceIds: ['different-source'] }), /already exists/);
  const savedWork = (await getDocFromServer(doc(first, root, 'drafts', draft.id!))).data();
  assert.equal(savedWork?.body, '<p>Reviewed</p>');
  assert.equal(savedWork?.bodyProvenance.provenanceId, provenance.docs[0].id);
  const savedEvent = (await getDocFromServer(doc(first, root, 'thinkingEvents', provenance.docs[0].id))).data();
  assert.equal(savedEvent?.metadata.provenanceId, provenance.docs[0].id);
  assert.equal((await getDocs(collection(first, root, 'thinkingEvents'))).size, 1);
});

test('workspace download reads complete persisted records and denies other accounts', async () => {
  const uid = 'export-owner';
  const owner = env.authenticatedContext(uid).firestore();
  const outsider = env.authenticatedContext('export-outsider').firestore();
  const account = doc(owner, 'users', uid);
  const base = account.path;
  const batch = writeBatch(owner);
  batch.set(account, { displayName: 'Workspace owner' });
  batch.set(doc(owner, base, 'profile', 'main'), { philosophyName: 'Practical doubt' });
  batch.set(doc(owner, base, 'settings', 'appearance'), { mode: 'dark' });
  batch.set(doc(owner, base, 'media', 'source'), { id: 'source', title: 'An encounter' });
  batch.set(doc(owner, base, 'annotations', 'note'), { id: 'note', sourceId: 'source', text: 'A passage' });
  batch.set(doc(owner, base, 'drafts', 'work'), { id: 'work', title: 'An essay' });
  batch.set(doc(owner, base, 'workRevisions', 'revision'), { workId: 'work', body: 'Saved prose' });
  batch.set(doc(owner, base, 'thinkingEvents', 'review'), {
    eventId: 'review', actorId: uid, schemaVersion: 2, summary: 'Accepted a challenge',
    entityId: 'work', origin: 'ai-assisted',
  });
  await batch.commit();

  const saved = await exportSavedWorkspace(account);
  const downloaded = JSON.parse(JSON.stringify(saved)) as typeof saved;
  assert.equal(downloaded.user.account?.displayName, 'Workspace owner');
  assert.equal(downloaded.profile.main.philosophyName, 'Practical doubt');
  assert.equal(downloaded.settings.appearance.mode, 'dark');
  assert.equal(downloaded.collections.annotations[0].sourceId, downloaded.collections.media[0].id);
  assert.equal(downloaded.collections.workRevisions[0].workId, downloaded.collections.drafts[0].id);
  assert.equal(downloaded.collections.thinkingEvents[0].origin, 'ai-assisted');
  assert.equal(downloaded.includesUploadedFiles, false);
  await assertFails(exportSavedWorkspace(doc(outsider, 'users', uid)));
});

test('private mutations and history commit atomically; invalid history rolls back its item', async () => {
  const uid = 'history-owner';
  const db = env.authenticatedContext(uid).firestore();
  const item = doc(db, `users/${uid}/questions/question`);
  const concept = doc(db, `users/${uid}/concepts/tag-test`);
  const event = doc(db, `users/${uid}/thinkingEvents/accepted`);
  const payload = { id: 'accepted', eventId: 'accepted', userId: uid, actorId: uid, schemaVersion: 2, summary: 'Accepted a challenge', origin: 'ai-assisted' };
  const bad = writeBatch(db);
  bad.set(item, { id: 'question', text: 'A question' });
  bad.set(event, { ...payload, actorId: 'wrong-user' });
  await assertFails(bad.commit());
  assert.equal((await getDoc(item)).exists(), false);
  await assertSucceeds(runTransaction(db, async (transaction) => {
    const missing = !(await transaction.get(concept)).exists();
    transaction.set(item, { id: 'question', text: 'A question', conceptIds: ['tag-test'] });
    if (missing) transaction.set(concept, { id: 'tag-test', name: 'Test' });
    transaction.set(event, payload);
  }));
  assert.deepEqual((await getDoc(item)).data()?.conceptIds, ['tag-test']);
  assert.equal((await getDoc(concept)).exists(), true);
  assert.equal((await getDoc(event)).data()?.origin, 'ai-assisted');
  await assertFails(updateDoc(event, { summary: 'Rewrite history' }));
  await assertFails(deleteDoc(event));
});

test('an inquiry promotion commits the inquiry, source, annotation and history together', async () => {
  const uid = 'annotation-inquiry-owner';
  const db = env.authenticatedContext(uid).firestore();
  const otherTab = env.authenticatedContext(uid).firestore();
  const path = `users/${uid}`;
  const source = doc(db, path, 'media', 'source');
  const note = doc(db, path, 'annotations', 'note');
  const inquiry = doc(db, path, 'questions', 'inquiry');
  const annotations = [{ id: 'note', text: 'Original passage', date: '2026-11-13' }] as Annotation[];
  await setDoc(source, { annotations, dateUpdated: 'original' });
  const references = [{ sourceId: source.id, annotationId: note.id }];
  const [update] = inquiryAnnotationUpdates([{ id: source.id, annotations, dateUpdated: 'original' }], references, inquiry.id);
  const save = (owner: string, change = update) => commitWorkspaceMutation({
    db, ref: inquiry, operation: 'set', data: { text: 'What follows from this?', sourceIds: [source.id], evidenceIds: [note.id] },
    requireUnchangedRecords: [{ ref: source, field: 'dateUpdated', value: change.sourceVersion }],
    relatedUpdates: [{ ref: source, data: { annotations: change.annotations, dateUpdated: 'promoted' } }],
    relatedWrites: [{ ref: note, operation: 'set', data: annotationRecord(source.id, change.updated[0], owner), setOptions: { merge: true } }],
    thinkingEvent: { collection: collection(db, path, 'thinkingEvents'), userId: uid, entityType: 'inquiry', entityId: inquiry.id, eventType: 'question_created', summary: 'Created an inquiry from an annotation', origin: 'user' },
  });
  await assertFails(save('different-owner'));
  assert.equal((await getDocFromServer(inquiry)).exists(), false);
  assert.equal((await getDocFromServer(source)).data()?.annotations[0].createdInquiryId, undefined);
  assert.equal((await getDocs(collection(db, path, 'thinkingEvents'))).size, 0);
  const edited = [{ ...annotations[0], text: 'Edited in another tab' }];
  await updateDoc(doc(otherTab, source.path), { annotations: edited, dateUpdated: 'edited' });
  await assert.rejects(save(uid), { name: 'WorkspaceRecordChangedError' });
  assert.equal((await getDocFromServer(inquiry)).exists(), false);
  assert.equal((await getDocFromServer(note)).exists(), false);
  assert.equal((await getDocs(collection(db, path, 'thinkingEvents'))).size, 0);
  assert.equal((await getDocFromServer(source)).data()?.annotations[0].text, edited[0].text);
  const [fresh] = inquiryAnnotationUpdates([{ id: source.id, annotations: edited, dateUpdated: 'edited' }], references, inquiry.id);
  await save(uid, fresh);
  assert.deepEqual((await getDocFromServer(inquiry)).data()?.evidenceIds, [note.id]);
  assert.equal((await getDocFromServer(source)).data()?.annotations[0].createdInquiryId, inquiry.id);
  assert.equal((await getDocFromServer(note)).data()?.createdInquiryId, inquiry.id);
  assert.equal((await getDocFromServer(note)).data()?.text, edited[0].text);
  assert.equal((await getDocs(collection(db, path, 'thinkingEvents'))).size, 1);
});

test('a stale Atlas style save cannot undo a node move from another session', async () => {
  const uid = 'atlas-style-conflict-owner';
  const db = env.authenticatedContext(uid).firestore();
  const other = env.authenticatedContext(uid).firestore();
  const map = doc(db, `users/${uid}/atlasMaps/map`);
  await setDoc(map, { id: map.id, dateUpdated: 'original', nodeNames: ['Attention'],
    nodePositions: { Attention: { x: 5, y: 5 } }, style: { fontFamily: 'system' } });
  await writeAtlasNodePosition(doc(other, map.path), 'attention', { x: 45, y: 65 }, 'moved');
  await assert.rejects(commitWorkspaceMutation({
    db, ref: map, operation: 'update',
    data: { nodePositions: { Attention: { x: 5, y: 5 } }, style: { fontFamily: 'serif' } },
    requireUnchanged: { ref: map, field: 'dateUpdated', value: 'original' },
  }), /record changed/);
  const saved = (await getDocFromServer(map)).data();
  assert.deepEqual(saved?.nodePositions.Attention, { x: 45, y: 65 });
  assert.equal(saved?.style.fontFamily, 'system');
});

test('Atlas node moves preserve concurrent locations and do not restore removed nodes', async () => {
  const uid = 'atlas-drag-owner';
  const first = env.authenticatedContext(uid).firestore();
  const second = env.authenticatedContext(uid).firestore();
  const ref = (db: Firestore) => doc(db, 'users', uid, 'atlasMaps', 'map');
  await setDoc(ref(first), { id: 'map', title: 'Custom map', nodeNames: ['Identity', 'Agency'], nodePositions: {}, manualLinks: [{ id: 'kept' }] });
  await Promise.all([
    writeAtlasNodePosition(ref(first), 'identity', { x: 20, y: 30 }, '2026-11-13T10:00:00Z'),
    writeAtlasNodePosition(ref(second), 'agency', { x: 70, y: 80 }, '2026-11-13T10:00:01Z'),
  ]);
  const saved = (await getDocFromServer(ref(first))).data();
  assert.deepEqual(saved?.nodePositions, { Identity: { x: 20, y: 30 }, Agency: { x: 70, y: 80 } });
  assert.deepEqual(saved?.manualLinks, [{ id: 'kept' }]);
  await updateDoc(ref(second), { nodeNames: ['Identity'], nodePositions: { Identity: { x: 20, y: 30 } } });
  await assert.rejects(writeAtlasNodePosition(ref(first), 'agency', { x: 50, y: 50 }, '2026-11-13T10:00:02Z'), /no longer on the map/);
  assert.equal((await getDocFromServer(ref(first))).data()?.nodePositions.Agency, undefined);
  const outsider = env.authenticatedContext('atlas-drag-outsider').firestore();
  await assertFails(writeAtlasNodePosition(ref(outsider), 'identity', { x: 60, y: 60 }, '2026-11-13T10:00:03Z'));
});

test('only an owner can publish, withdraw or replace a public profile', async () => {
  const owner = env.authenticatedContext('profile-owner').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const outsider = env.authenticatedContext('profile-outsider').firestore();
  const path = 'publicProfiles/essayist';
  const profile = { id: 'essayist', ownerId: 'profile-owner', shareSlug: 'essayist', displayName: 'Essayist', enabled: false, themes: [], works: [] };
  await assertFails(setDoc(doc(owner, path), { ...profile, email: 'not-for-public@example.invalid' }));
  await assertFails(setDoc(doc(owner, path), { ...profile, enabled: 'true' }));
  await assertSucceeds(setDoc(doc(owner, path), profile));
  await assertFails(getDoc(doc(guest, path)));
  await assertSucceeds(updateDoc(doc(owner, path), { enabled: true }));
  assert.equal((await assertSucceeds(getDoc(doc(guest, path)))).data()?.displayName, 'Essayist');
  for (const client of [guest, outsider, owner]) {
    await assertFails(getDocsFromServer(query(collection(client, 'publicProfiles'), where('enabled', '==', true))));
  }
  await assertFails(updateDoc(doc(owner, path), { privateNotes: 'not part of the snapshot' }));
  await assertFails(setDoc(doc(outsider, path), { ...profile, ownerId: 'profile-outsider' }));
  await assertSucceeds(updateDoc(doc(owner, path), { enabled: false }));
  await assertFails(getDoc(doc(guest, path)));
  await assertSucceeds(deleteDoc(doc(owner, path)));
});

test('concurrent publication leaves one public URL and a conflicting rename preserves it', async () => {
  const uid = 'publishing-owner';
  const first = env.authenticatedContext(uid).firestore();
  const second = env.authenticatedContext(uid).firestore();
  const outsider = env.authenticatedContext('other-publisher').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const save = (db: Firestore, slug: string, enabled = true, ownerId = uid) => publishProfileSelection({
    ownerId, privacyRef: doc(db, 'users', ownerId, 'profile', 'privacy'),
    settingsRef: doc(db, 'users', ownerId, 'settings', 'privacy'),
    privacy: { ...DEFAULT_PROFILE_PRIVACY, shareSlug: slug, publicProfileEnabled: enabled },
    updatedAt: '2026-11-13',
    snapshot: {
      shareSlug: slug, enabled, displayName: 'Thinker', currentSeason: '', themes: [],
      concepts: [], positions: [], works: [], practices: [], sources: [], beliefHistory: [],
    },
  });
  await save(first, 'first-slug');
  await Promise.all([save(first, 'second-slug'), save(second, 'third-slug')]);
  const privacy = doc(first, 'users', uid, 'profile', 'privacy');
  const activeSlug = (await getDocFromServer(privacy)).data()?.shareSlug;
  assert.ok(['second-slug', 'third-slug'].includes(activeSlug));
  await assertFails(getDocFromServer(doc(guest, 'publicProfiles', 'first-slug')));
  for (const slug of ['second-slug', 'third-slug']) {
    const read = getDocFromServer(doc(guest, 'publicProfiles', slug));
    if (slug === activeSlug) assert.equal((await read).data()?.displayName, 'Thinker');
    else await assertFails(read);
  }
  await save(outsider, 'reserved-slug', true, 'other-publisher');
  await assertFails(deleteDoc(doc(outsider, 'publicProfiles', activeSlug)));
  await assert.rejects(save(first, 'reserved-slug'), /try a different one/);
  assert.equal((await getDocFromServer(privacy)).data()?.shareSlug, activeSlug);
  assert.equal((await getDocFromServer(doc(guest, 'publicProfiles', activeSlug))).data()?.ownerId, uid);
  await save(second, activeSlug, false);
  await assertFails(getDocFromServer(doc(guest, 'publicProfiles', activeSlug)));
  assert.equal((await getDocFromServer(doc(first, 'users', uid, 'settings', 'privacy'))).data()?.shareableProfileLink, '');

  await setDoc(privacy, { shareSlug: 'missing-old-url', publicProfileEnabled: true }, { merge: true });
  await save(first, 'recovered-url');
  assert.equal((await getDocFromServer(doc(guest, 'publicProfiles', 'recovered-url'))).data()?.ownerId, uid);
});

test('republishing at the same URL removes disabled fields and rejects a mismatched preview', async () => {
  const uid = 'public-selection-owner';
  const owner = env.authenticatedContext(uid).firestore();
  const guest = env.unauthenticatedContext().firestore();
  const shareSlug = 'selection-replacement';
  const concept = { id: 'chosen', name: 'Previously shared concept' };
  const privacy = { ...DEFAULT_PROFILE_PRIVACY, shareSlug, publicProfileEnabled: true,
    publicConceptsEnabled: true, publicConceptIds: [concept.id] };
  const snapshot = { shareSlug, enabled: true, displayName: 'Thinker', bio: 'Previously shared bio',
    currentSeason: '', themes: [], concepts: [concept], positions: [], works: [], practices: [], sources: [], beliefHistory: [] };
  const save = (choices: typeof privacy, preview: Omit<typeof snapshot, 'bio'> & { bio?: string }) => publishProfileSelection({
    ownerId: uid, privacyRef: doc(owner, 'users', uid, 'profile', 'privacy'),
    settingsRef: doc(owner, 'users', uid, 'settings', 'privacy'),
    privacy: choices, snapshot: preview, updatedAt: '2026-11-13',
  });
  const publishedRef = doc(guest, 'publicProfiles', shareSlug);
  await save(privacy, snapshot);
  assert.deepEqual((await getDocFromServer(publishedRef)).data()?.concepts, [concept]);
  const narrowed = { ...privacy, publicConceptsEnabled: false, publicBioEnabled: false };
  await assert.rejects(save(narrowed, snapshot), /no longer matches/);
  const { bio, ...withoutBio } = snapshot;
  assert.equal((await getDocFromServer(publishedRef)).data()?.bio, bio);
  await save(narrowed, { ...withoutBio, concepts: [] });
  const published = (await getDocFromServer(publishedRef)).data();
  assert.equal(published?.bio, undefined);
  assert.deepEqual(published?.concepts, []);
});

test('a stale public profile preview cannot republish a withdrawn profile', async () => {
  const uid = 'public-version-owner';
  const first = env.authenticatedContext(uid).firestore();
  const second = env.authenticatedContext(uid).firestore();
  const guest = env.unauthenticatedContext().firestore();
  const slug = 'stale-preview-test';
  const save = (db: Firestore, enabled: boolean, updatedAt: string, dateUpdated?: string) => publishProfileSelection({
    ownerId: uid,
    privacyRef: doc(db, 'users', uid, 'profile', 'privacy'),
    settingsRef: doc(db, 'users', uid, 'settings', 'privacy'),
    privacy: { ...DEFAULT_PROFILE_PRIVACY, shareSlug: slug, publicProfileEnabled: enabled },
    snapshot: { shareSlug: slug, enabled, displayName: 'Thinker', currentSeason: '', themes: [],
      concepts: [], positions: [], works: [], practices: [], sources: [], beliefHistory: [] },
    updatedAt, expectedVersion: { dateUpdated },
  });
  const reviewed = '2026-11-13T10:00:00.000Z';
  const withdrawn = '2026-11-13T11:00:00.000Z';
  await save(first, true, reviewed);
  await save(second, false, withdrawn, reviewed);
  await assert.rejects(save(first, true, '2026-11-13T12:00:00.000Z', reviewed), /Sharing choices changed/);
  await assertFails(getDocFromServer(doc(guest, 'publicProfiles', slug)));
  const privacy = (await getDocFromServer(doc(first, 'users', uid, 'profile', 'privacy'))).data();
  assert.equal(privacy?.publicProfileEnabled, false);
  assert.equal(privacy?.dateUpdated, withdrawn);
});

test('account cleanup removes older public snapshots as well as the current URL', async () => {
  localAddress(process.env.FIRESTORE_EMULATOR_HOST);
  const app = initializeAdminApp({ projectId }, 'noesis-public-profile-cleanup');
  const db = getAdminFirestore(app);
  try {
    const profiles = db.collection('publicProfiles');
    const seed = db.batch();
    for (let index = 0; index < 101; index++) {
      seed.set(profiles.doc(`deleted-owner-${index}`), { ownerId: 'deleted-owner', enabled: index !== 100 });
    }
    const unaffected = profiles.doc('unaffected-owner');
    seed.set(unaffected, { ownerId: 'someone-else', enabled: true });
    await seed.commit();
    await removeOwnedPublicProfiles(db, 'deleted-owner');
    await removeOwnedPublicProfiles(db, 'deleted-owner');
    assert.equal((await profiles.where('ownerId', '==', 'deleted-owner').get()).size, 0);
    assert.equal((await unaffected.get()).data()?.enabled, true);
  } finally {
    await db.terminate();
    await deleteAdminApp(app);
  }
});

test('simultaneous workspace saves create one tag placeholder and one creation event', async () => {
  const uid = 'concurrent-owner';
  const first = env.authenticatedContext(uid).firestore();
  const second = env.authenticatedContext(uid).firestore();
  const save = (db: Firestore, id: string) => commitWorkspaceMutation({
    db,
    ref: doc(db, `users/${uid}/media/${id}`),
    operation: 'set',
    data: { id, title: id, conceptIds: ['tag-shared'] },
    createIfMissing: [{
      ref: doc(db, `users/${uid}/concepts/tag-shared`),
      data: { id: 'tag-shared', name: 'Shared', createdFrom: 'tag' },
      thinkingEvent: {
        collection: collection(db, `users/${uid}/thinkingEvents`),
        userId: uid, eventType: 'created', entityType: 'concept', entityId: 'tag-shared',
        summary: 'Created concept from tag: Shared', origin: 'system',
      },
    }],
  });
  await Promise.all([save(first, 'one'), save(second, 'two')]);
  const concepts = await getDocs(collection(first, `users/${uid}/concepts`));
  const events = await getDocs(collection(first, `users/${uid}/thinkingEvents`));
  const sources = await getDocs(collection(first, `users/${uid}/media`));
  assert.deepEqual(concepts.docs.map((record) => record.id), ['tag-shared']);
  assert.deepEqual(events.docs.map((record) => record.data().entityId), ['tag-shared']);
  assert.deepEqual(sources.docs.map((record) => record.data().conceptIds), [['tag-shared'], ['tag-shared']]);
  await updateDoc(concepts.docs[0].ref, { description: 'A real definition.' });
  await save(second, 'three');
  assert.equal((await getDoc(concepts.docs[0].ref)).data()?.description, 'A real definition.');
  assert.equal((await getDocs(collection(first, `users/${uid}/thinkingEvents`))).size, 1);
});

test('Works uploads require the matching owner, record metadata and permitted file type', async () => {
  const owner = env.authenticatedContext('file-owner').storage();
  const outsider = env.authenticatedContext('file-outsider').storage();
  const path = 'users/file-owner/works/draft/image.png';
  const bytes = new Uint8Array([1, 2, 3]);
  const metadata = { contentType: 'image/png', customMetadata: { ownerUid: 'file-owner', entityId: 'draft' } };
  await assertFails(uploadBytes(ref(owner, path), bytes, { ...metadata, contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(owner, path), bytes, { ...metadata, customMetadata: { ownerUid: 'file-owner', entityId: 'other' } }));
  await assertFails(uploadBytes(ref(outsider, path), bytes, metadata));
  await assertSucceeds(uploadBytes(ref(owner, path), bytes, metadata));
  assert.equal((await assertSucceeds(getBytes(ref(owner, path)))).byteLength, bytes.length);
  await assertFails(getBytes(ref(outsider, path)));
  await assertFails(deleteObject(ref(outsider, path)));
  await assertSucceeds(deleteObject(ref(owner, path)));
});

test('account upload cleanup removes Works and Atlas files but not another account with a similar ID', async () => {
  localAddress(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  const uid = 'removed-file-owner';
  const otherUid = `${uid}-other`;
  const owner = env.authenticatedContext(uid).storage();
  const other = env.authenticatedContext(otherUid).storage();
  const app = initializeAdminApp({ projectId, storageBucket: `${projectId}.appspot.com` }, 'noesis-upload-cleanup');
  try {
    const owned = [ref(owner, `users/${uid}/works/work/image.png`), ref(owner, `users/${uid}/atlasMaps/map/image.png`)];
    const unrelated = ref(other, `users/${otherUid}/works/work/image.png`);
    const upload = (target: typeof unrelated, ownerUid: string, entityId: string) =>
      uploadBytes(target, new Uint8Array([1, 2, 3]), { contentType: 'image/png', customMetadata: { ownerUid, entityId } });
    await Promise.all([upload(owned[0], uid, 'work'), upload(owned[1], uid, 'map'), upload(unrelated, otherUid, 'work')]);
    const bucket = getAdminStorage(app).bucket();
    await assert.rejects(removeWorkspaceUploads(bucket, ''), /Invalid workspace owner/);
    await assert.rejects(removeWorkspaceUploads(bucket, 'nested/path'), /Invalid workspace owner/);
    await removeWorkspaceUploads(bucket, uid);
    await removeWorkspaceUploads(bucket, uid);
    for (const target of owned) await assert.rejects(getBytes(target), { code: 'storage/object-not-found' });
    assert.equal((await getBytes(unrelated)).byteLength, 3);
  } finally {
    await deleteAdminApp(app);
  }
});

test('a stale inquiry save does not overwrite a newer answer or add an edit event', async () => {
  const uid = 'inquiry-edit-conflict-owner';
  const first = env.authenticatedContext(uid).firestore();
  const second = env.authenticatedContext(uid).firestore();
  const ref = doc(first, `users/${uid}/questions/inquiry`);
  const history = collection(first, `users/${uid}/thinkingEvents`);
  const original = '2026-11-13T12:00:00.000Z';
  await setDoc(ref, { id: ref.id, answer: '', dateUpdated: original });
  await updateDoc(doc(second, ref.path), { answer: 'New answer', dateUpdated: '2026-11-13T12:01:00.000Z' });
  await assert.rejects(commitWorkspaceMutation({
    db: first, ref, operation: 'update', data: { answer: '', whyItMatters: 'Stale context' },
    requireUnchanged: { ref, field: 'dateUpdated', value: original },
    thinkingEvent: { collection: history, userId: uid, entityType: 'inquiry', entityId: ref.id,
      eventType: 'edited', origin: 'user', summary: 'Inquiry updated.' },
  }), /record changed/);
  assert.equal((await getDocFromServer(ref)).data()?.answer, 'New answer');
  assert.equal((await getDocsFromServer(history)).size, 0);
});

test('only one client can convert the same open inquiry and record its position', async () => {
  const uid = 'conversion-owner';
  const first = env.authenticatedContext(uid).firestore();
  const second = env.authenticatedContext(uid).firestore();
  const inquiryPath = `users/${uid}/questions/inquiry`;
  const originalVersion = '2026-11-13T12:00:00.000Z';
  const updatedVersion = '2026-11-13T12:01:00.000Z';
  await setDoc(doc(first, inquiryPath), { id: 'inquiry', status: 'open', dateUpdated: originalVersion });
  const convert = (db: Firestore, id: string, version: string) => commitWorkspaceMutation({
    db,
    ref: doc(db, `users/${uid}/vault/${id}`),
    operation: 'create',
    data: { id, title: 'A position', sourceInquiryId: 'inquiry' },
    requireUnchanged: { ref: doc(db, inquiryPath), field: 'status', value: 'open' },
    requireUnchangedRecords: [{ ref: doc(db, inquiryPath), field: 'dateUpdated', value: version }],
    relatedUpdates: [{ ref: doc(db, inquiryPath), data: { status: 'converted', beliefIds: [id] } }],
    thinkingEvent: {
      collection: collection(db, `users/${uid}/thinkingEvents`),
      userId: uid, eventType: 'position_formed', entityType: 'position', entityId: id,
      summary: 'Formed a position', origin: 'user',
    },
  });
  await updateDoc(doc(second, inquiryPath), { answer: 'A newer answer', dateUpdated: updatedVersion });
  await assert.rejects(convert(first, 'stale', originalVersion), /record changed/);
  const outcomes = await Promise.allSettled([convert(first, 'one', updatedVersion), convert(second, 'two', updatedVersion)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  const positions = await getDocs(collection(first, `users/${uid}/vault`));
  const events = await getDocs(collection(first, `users/${uid}/thinkingEvents`));
  assert.equal(positions.size, 1);
  assert.deepEqual((await getDoc(doc(first, inquiryPath))).data()?.beliefIds, [positions.docs[0].id]);
  assert.deepEqual(events.docs.map((event) => event.data().entityId), [positions.docs[0].id]);
});

test('a cached write remains unconfirmed until reconnect and reaches the server once', async () => {
  const uid = 'reconnect-owner';
  const db = env.authenticatedContext(uid).firestore();
  const remote = env.authenticatedContext(uid).firestore();
  const path = `users/${uid}/drafts/work`;
  const work = doc(db, path);
  await setDoc(work, { id: 'work', body: 'Original' });
  await disableNetwork(db);
  let acknowledged = false;
  let unsubscribe = () => {};
  const cachedChange = new Promise<void>((resolve, reject) => {
    unsubscribe = onSnapshot(work, { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.hasPendingWrites && snapshot.data()?.body === 'Revised') resolve();
    }, reject);
  });
  const save = commitWorkspaceMutation({ db, ref: work, operation: 'update', data: { body: 'Revised' } }).then(() => { acknowledged = true; });
  try {
    await cachedChange;
    assert.equal(acknowledged, false);
    assert.equal((await getDocFromCache(work)).data()?.body, 'Revised');
    assert.equal((await getDocFromServer(doc(remote, path))).data()?.body, 'Original');
  } finally {
    unsubscribe();
    await enableNetwork(db);
    await save;
  }
  assert.equal(acknowledged, true);
  assert.equal((await getDocFromServer(doc(remote, path))).data()?.body, 'Revised');
});

test('successive Works saves accept the acknowledged revision and reject a stale tab', async () => {
  const uid = 'recovery-owner';
  const db = env.authenticatedContext(uid).firestore();
  const work = doc(db, `users/${uid}/drafts/work`);
  const dateUpdated = '2026-11-13T12:00:00.000Z';
  await setDoc(work, { id: 'work', body: 'Original', dateUpdated });
  const save = (revision: number | undefined, body: string) => commitWorkspaceMutation({
    db, ref: work, operation: 'update', data: { body, dateUpdated, revision: (revision ?? 0) + 1 },
    requireUnchangedRecords: [
      { ref: work, field: 'dateUpdated', value: dateUpdated },
      { ref: work, field: 'revision', value: revision },
    ],
  });
  await save(undefined, 'First edit');
  const acknowledged = await getDocFromServer(work);
  await save(acknowledged.data()?.revision, 'Newer edit');
  await assert.rejects(save(acknowledged.data()?.revision, 'Stale edit'), /record changed/);
  assert.equal((await getDocFromServer(work)).data()?.body, 'Newer edit');
});

test('source restoration keeps existing annotations and rebuilds missing legacy records', async () => {
  const uid = 'source-recovery-owner';
  const db = env.authenticatedContext(uid).firestore();
  const source = doc(db, `users/${uid}/media/source`);
  const note = (id: string) => doc(db, `users/${uid}/annotations/${id}`);
  await setDoc(source, { id: 'source', title: 'Reading notes' });
  await setDoc(note('kept'), { id: 'kept', sourceId: 'source', text: 'Current text' });
  await commitWorkspaceMutation({ db, ref: source, operation: 'delete' });
  assert.equal((await getDoc(source)).exists(), false);
  assert.equal((await getDoc(note('kept'))).data()?.text, 'Current text');
  const candidates = sourceRecoveryAnnotations({ annotations: [
    { id: 'kept', text: 'Stale text' },
    { id: 'missing', text: 'Legacy note' },
  ] }, 'source', uid);
  await commitWorkspaceMutation({
    db, ref: source, operation: 'create', data: { id: 'source', title: 'Reading notes', annotations: [] },
    createIfMissing: candidates.map((data) => ({ ref: note(data.id), data })),
  });
  assert.equal((await getDoc(source)).data()?.title, 'Reading notes');
  assert.equal((await getDoc(note('kept'))).data()?.text, 'Current text');
  assert.equal((await getDoc(note('missing'))).data()?.text, 'Legacy note');
});

test('stale source edit cannot remove a newer annotation or record a save', async () => {
  const uid = 'source-editor-conflict-owner';
  const db = env.authenticatedContext(uid).firestore();
  const source = doc(db, `users/${uid}/media/source`);
  const note = doc(db, `users/${uid}/annotations/note`);
  const history = collection(db, `users/${uid}/thinkingEvents`);
  const baseVersion = '2026-11-13T12:00:00.000Z';
  const newerVersion = '2026-11-13T12:01:00.000Z';
  const annotation = { id: note.id, userId: uid, sourceId: source.id, text: 'New annotation' };
  await setDoc(source, { id: source.id, title: 'Original', dateUpdated: baseVersion, annotations: [] });
  await commitWorkspaceMutation({
    db, ref: source, operation: 'update', data: { dateUpdated: newerVersion, annotations: [annotation] },
    relatedWrites: [{ ref: note, operation: 'set', data: annotation }],
  });
  await assert.rejects(commitWorkspaceMutation({
    db, ref: source, operation: 'update', data: { title: 'Stale edit', annotations: [] },
    requireUnchanged: { ref: source, field: 'dateUpdated', value: baseVersion },
    relatedWrites: [{ ref: note, operation: 'delete' }],
    thinkingEvent: {
      collection: history, userId: uid, entityId: source.id, entityType: 'source',
      eventType: 'edited', summary: 'Updated source metadata.', origin: 'user',
    },
  }), /record changed/);
  const savedSource = (await getDocFromServer(source)).data();
  assert.equal(savedSource?.title, 'Original');
  assert.deepEqual(savedSource?.annotations, [annotation]);
  assert.equal((await getDocFromServer(note)).data()?.text, annotation.text);
  assert.equal((await getDocsFromServer(history)).size, 0);
});

test('annotation recovery creates its record and history only while the source exists and the note is absent', async () => {
  const uid = 'annotation-recovery-owner';
  const db = env.authenticatedContext(uid).firestore();
  const source = doc(db, `users/${uid}/media/source`);
  const annotation = doc(db, `users/${uid}/annotations/note`);
  const history = collection(db, `users/${uid}/thinkingEvents`);
  const dateUpdated = '2026-11-13T12:00:00.000Z';
  const textProvenance = { kind: 'ai-assisted', provenanceId: 'ai-review-example' };
  const data = { id: 'note', userId: uid, sourceId: source.id, text: 'Restored text', textProvenance };
  const restore = () => commitWorkspaceMutation({
    db, ref: annotation, operation: 'create', data,
    requireUnchanged: { ref: source, field: 'dateUpdated', value: dateUpdated },
    thinkingEvent: {
      collection: history, userId: uid, entityId: annotation.id, entityType: 'annotation',
      eventType: 'restored', summary: 'Restored annotation.', origin: 'user', after: data,
      relatedEntityIds: { sourceIds: [source.id] },
    },
  });
  await assert.rejects(restore(), /record changed/);
  assert.equal((await getDocFromServer(annotation)).exists(), false);
  assert.equal((await getDocsFromServer(history)).size, 0);
  await setDoc(source, { id: source.id, title: 'Original source', dateUpdated });
  await restore();
  const saved = (await getDocFromServer(annotation)).data();
  assert.equal(saved?.text, data.text);
  assert.deepEqual(saved?.textProvenance, textProvenance);
  const restored = (await getDocsFromServer(history)).docs[0].data();
  assert.equal(restored.eventType, 'restored');
  assert.deepEqual(restored.after, { id: data.id, textProvenance });
  assert.equal(restored.diff, null);
  await assert.rejects(restore(), /already exists/);
  assert.equal((await getDocsFromServer(history)).size, 1);
  await commitWorkspaceMutation({
    db, ref: annotation, operation: 'delete',
    thinkingEvent: { collection: history, userId: uid, entityId: annotation.id, entityType: 'annotation',
      eventType: 'deleted', summary: 'Deleted annotation.', origin: 'user', before: data,
      relatedEntityIds: { sourceIds: [source.id] } },
  });
  const deleted = (await getDocsFromServer(history)).docs.map((item) => item.data()).find((item) => item.eventType === 'deleted');
  assert.deepEqual(deleted?.before, data);
  assert.equal(deleted?.diff, null);
});

test('recovery includes both date formats beyond the normal Evolution window', async () => {
  const uid = 'busy-recovery-owner';
  const db = env.authenticatedContext(uid).firestore();
  const events = collection(db, `users/${uid}/thinkingEvents`);
  const now = Date.now();
  const batch = writeBatch(db);
  const put = (id: string, entityId: string, eventType: string, createdAt: Timestamp | string) => {
    batch.set(doc(events, id), { id, eventId: id, userId: uid, actorId: uid, schemaVersion: 2,
      summary: id, entityType: 'work', entityId, before: { id: entityId }, eventType, createdAt });
  };
  put('older-deletion', 'older', 'deleted', Timestamp.fromMillis(now - 60_000));
  put('legacy-deletion', 'legacy', 'deleted', new Date(now - 50_000).toISOString());
  put('replaced-deletion', 'replaced', 'deleted', Timestamp.fromMillis(now - 40_000));
  put('replacement', 'replaced', 'work_created', new Date(now - 30_000).toISOString());
  put('expired-deletion', 'expired', 'deleted', Timestamp.fromMillis(now - RECOVERY_RETENTION_MS - 1));
  for (let index = 0; index < 201; index++) put(`edit-${index}`, 'routine', 'edited', Timestamp.fromMillis(now - index - 1));
  await batch.commit();
  const evolution = await getDocs(query(events, orderBy('createdAt', 'desc'), limit(200)));
  assert.equal(evolution.docs.some((record) => record.id === 'older-deletion'), false);
  const cutoff = now - RECOVERY_RETENTION_MS;
  const result = await Promise.all([Timestamp.fromMillis(cutoff), new Date(cutoff).toISOString()].map((value) =>
    getDocs(query(events, where('eventType', 'in', [...RECOVERY_EVENT_TYPES]), where('createdAt', '>=', value), orderBy('createdAt', 'desc')))));
  const candidates = result.flatMap((snapshot) => snapshot.docs.map((record) => record.data() as ThinkingEvent));
  assert.deepEqual(recentRecoverableDeletions(candidates, now).map((record) => record.id), ['legacy-deletion', 'older-deletion']);
});

test('a terminal read denial needs a fresh listener before newly visible data can load', { timeout: 10_000 }, async () => {
  const owner = env.authenticatedContext('retry-owner').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const path = 'publicProfiles/retry-profile';
  await setDoc(doc(owner, path), { id: 'retry-profile', shareSlug: 'retry-profile', ownerId: 'retry-owner', displayName: 'Retry profile', enabled: false });
  let firstSnapshots = 0;
  let stopFirst = () => {};
  let stopRetry = () => {};
  try {
    const failure = await new Promise<{ code: string }>((resolve) => {
      stopFirst = onSnapshot(doc(guest, path), () => { firstSnapshots += 1; }, resolve);
    });
    assert.equal(failure.code, 'permission-denied');
    await updateDoc(doc(owner, path), { enabled: true });
    const name = await new Promise<string | undefined>((resolve, reject) => {
      stopRetry = onSnapshot(doc(guest, path), (snapshot) => {
        if (!snapshot.metadata.fromCache) resolve(snapshot.data()?.displayName);
      }, reject);
    });
    assert.equal(name, 'Retry profile');
    assert.equal(firstSnapshots, 0);
  } finally {
    stopFirst();
    stopRetry();
  }
});

test('an accepted period review saves long text once without allowing an altered retry', async () => {
  const uid = 'synthesis-owner';
  const db = env.authenticatedContext(uid).firestore();
  const events = collection(db, `users/${uid}/thinkingEvents`);
  const reason = 'Reviewed analysis. '.repeat(200);
  const input: WriteThinkingEventInput = {
    collection: events, userId: uid, entityType: 'evolution', entityId: 'period',
    eventType: 'synthesized', origin: 'ai-assisted', summary: 'Period synthesis',
    after: { legacyTimelineEvent: { reason } }, idempotencyKey: 'period-review-test',
  };
  await Promise.all([writePeriodSynthesis(input), writePeriodSynthesis(input)]);
  await assert.rejects(writePeriodSynthesis({ ...input, after: { legacyTimelineEvent: { reason: 'Other content' } } }), /different content/);
  const results = await getDocs(events);
  assert.equal(results.size, 1);
  assert.equal(results.docs[0].data().after.legacyTimelineEvent.reason, reason);
});

test('period synthesis keeps approved text in its private origin rather than calendar history', async () => {
  const uid = 'structured-synthesis-owner';
  const db = context(uid).firestore();
  const root = `users/${uid}`;
  const id = 'period-review-reference';
  const text = 'The revised position is still tentative.';
  const date = '2026-11-13T12:00:00Z';
  const provenance: AiProvenanceRecord = {
    id, provenanceId: id, userId: uid, schemaVersion: 1, kind: 'ai-assisted', sourceActionId: id, state: 'active',
    targets: [{ type: 'evolution', id, fieldPath: 'synthesis', subrecordId: id }],
    origin: { feature: 'evolution', action: 'synthesize_evolution_period' }, generatedAt: date, acceptedAt: serverTimestamp(),
    acceptedText: text, acceptedTextHash: await acceptedTextHash(text), precursor: 'Private original',
    contextRefs: [{ type: 'thinking-event', id: 'evidence' }],
  };
  const origin = doc(db, root, 'aiProvenance', id);
  await assertFails(setDoc(origin, provenance));
  const input: WriteThinkingEventInput = {
    collection: collection(db, root, 'thinkingEvents'), userId: uid, entityType: 'evolution', entityId: 'period',
    eventType: 'synthesized', origin: 'ai-assisted', summary: 'Period synthesis', idempotencyKey: id,
    after: { legacyTimelineEvent: { id, entityType: 'evolution', entityTitle: 'Period synthesis', reason: '', date,
      synthesisProvenance: { provenanceId: id, kind: 'ai-assisted' } } },
    metadata: { provenanceId: id },
  };
  const { eventRef, payload } = makeThinkingEventPayload(input);
  await assertFails(setDoc(eventRef, payload));
  await Promise.all([writePeriodSynthesis(input, provenance), writePeriodSynthesis(input, provenance)]);
  await assert.rejects(writePeriodSynthesis(input, { ...provenance, contextRefs: [] }), /different content/);
  const history = await getDocs(input.collection);
  assert.equal(history.size, 1);
  assert.doesNotMatch(JSON.stringify(history.docs[0].data()), /tentative|Private original/);
  assert.equal((await getDocFromServer(origin)).data()?.acceptedText, text);
  const outsider = doc(context('outsider').firestore(), origin.path);
  const removal = { state: 'redacted', precursor: null };
  await assertFails(getDocFromServer(outsider));
  await assertFails(updateDoc(outsider, removal));
  await assertFails(updateDoc(origin, { ...removal, acceptedText: 'Tampered' }));
  await assertFails(updateDoc(origin, { ...removal, targets: [] }));
  await assertFails(updateDoc(origin, { ...removal, precursor: 'Not removed' }));
  await updateDoc(origin, removal);
  await updateDoc(origin, removal);
  await assertFails(updateDoc(origin, { state: 'active', precursor: 'Restored' }));
  const redacted = (await getDocFromServer(origin)).data();
  assert.equal(redacted?.precursor, null);
  assert.equal(redacted?.acceptedText, text);
  assert.deepEqual(redacted?.targets, provenance.targets);
  assert.deepEqual((await getDocFromServer(eventRef)).data(), history.docs[0].data());
  await writePeriodSynthesis(input, provenance);
  assert.equal((await getDocFromServer(origin)).data()?.precursor, null);
});
