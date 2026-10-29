import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const projectIdArg = process.argv.find((arg) => arg.startsWith('--project='));
const uidArg = process.argv.find((arg) => arg.startsWith('--uid='));
const projectId = projectIdArg?.split('=')[1] || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const requestedUid = uidArg?.split('=')[1];

if (!getApps().length) initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
const db = getFirestore();

const stats = {
  users: 0,
  annotationsSeen: 0,
  annotationsCreated: 0,
  conceptIdsBackfilled: 0,
  practiceLogsCreated: 0,
  workRevisionsCreated: 0,
  positionVersionsCreated: 0,
  embeddedCachesCompacted: 0,
  timelineEventsSeen: 0,
  thinkingEventsCreated: 0,
  collisions: 0,
};

const normalized = (value = '') => String(value).trim().toLocaleLowerCase();
const unique = (values) => [...new Set(values.filter(Boolean))];
const mappedEntityType = (value) => ({ media: 'source', vault: 'position', question: 'inquiry', draft: 'work' }[value] || value || 'evolution');
const newest = (items, field) => [...items].sort((left, right) => Date.parse(right?.[field] || '') - Date.parse(left?.[field] || ''));
const historyId = (parentId, entryId) => `${parentId}__${entryId}`.replaceAll('/', '_');
const stableToken = (value = '') => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

async function commitOperations(operations) {
  if (!execute || !operations.length) return;
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = db.batch();
    operations.slice(offset, offset + 400).forEach(({ ref, data, options }) => {
      if (options) batch.set(ref, data, options);
      else batch.set(ref, data);
    });
    await batch.commit();
  }
}

async function migrateUser(userRef) {
  stats.users += 1;
  const [conceptsSnap, mediaSnap, vaultSnap, insightsSnap, draftsSnap, practicesSnap, timelineSnap, annotationsSnap, thinkingSnap, practiceLogsSnap, workRevisionsSnap, positionVersionsSnap] = await Promise.all([
    userRef.collection('concepts').get(),
    userRef.collection('media').get(),
    userRef.collection('vault').get(),
    userRef.collection('insights').get(),
    userRef.collection('drafts').get(),
    userRef.collection('practices').get(),
    userRef.collection('timeline').get(),
    userRef.collection('annotations').get(),
    userRef.collection('thinkingEvents').get(),
    userRef.collection('practiceLogs').get(),
    userRef.collection('workRevisions').get(),
    userRef.collection('positionVersions').get(),
  ]);
  const conceptIdsByName = new Map(conceptsSnap.docs.map((snapshot) => [normalized(snapshot.data().name), snapshot.id]));
  const existingAnnotations = new Map(annotationsSnap.docs.map((snapshot) => [snapshot.id, snapshot.data()]));
  const existingEvents = new Set(thinkingSnap.docs.map((snapshot) => snapshot.id));
  const existingPracticeLogs = new Set(practiceLogsSnap.docs.map((snapshot) => snapshot.id));
  const existingWorkRevisions = new Set(workRevisionsSnap.docs.map((snapshot) => snapshot.id));
  const existingPositionVersions = new Set(positionVersionsSnap.docs.map((snapshot) => snapshot.id));
  const operations = [];

  for (const sourceSnap of mediaSnap.docs) {
    const source = sourceSnap.data();
    for (const annotation of source.annotations || []) {
      if (!annotation?.id) continue;
      stats.annotationsSeen += 1;
      const existing = existingAnnotations.get(annotation.id);
      if (existing && existing.sourceId !== sourceSnap.id) {
        stats.collisions += 1;
        console.warn(`Annotation ID collision for ${annotation.id}; kept ${existing.sourceId}, skipped ${sourceSnap.id}.`);
        continue;
      }
      if (!existing) {
        stats.annotationsCreated += 1;
        operations.push({
          ref: userRef.collection('annotations').doc(annotation.id),
          data: { ...annotation, id: annotation.id, sourceId: sourceSnap.id, userId: userRef.id, dateUpdated: annotation.date || new Date().toISOString() },
          options: { merge: true },
        });
      }
    }
    if ((source.annotations || []).length > 200) {
      stats.embeddedCachesCompacted += 1;
      operations.push({ ref: sourceSnap.ref, data: { annotations: newest(source.annotations, 'date').slice(0, 200), dateUpdated: new Date().toISOString() }, options: { merge: true } });
    }
  }

  for (const snapshot of vaultSnap.docs) {
    const versions = snapshot.data().versionHistory || [];
    versions.forEach((version) => {
      const id = historyId(snapshot.id, `${version.date || 'undated'}__${stableToken(version.description || '')}`);
      if (existingPositionVersions.has(id)) return;
      stats.positionVersionsCreated += 1;
      operations.push({ ref: userRef.collection('positionVersions').doc(id), data: { ...version, id, positionId: snapshot.id, userId: userRef.id }, options: { merge: true } });
    });
    if (versions.length > 100) {
      stats.embeddedCachesCompacted += 1;
      operations.push({ ref: snapshot.ref, data: { versionHistory: newest(versions, 'date').slice(0, 100).reverse(), dateUpdated: new Date().toISOString() }, options: { merge: true } });
    }
  }

  for (const snapshot of draftsSnap.docs) {
    const revisions = snapshot.data().versionHistory || [];
    revisions.forEach((revision) => {
      if (!revision.id) return;
      const id = historyId(snapshot.id, revision.id);
      if (existingWorkRevisions.has(id)) return;
      stats.workRevisionsCreated += 1;
      operations.push({ ref: userRef.collection('workRevisions').doc(id), data: { ...revision, id, revisionId: revision.id, workId: snapshot.id, userId: userRef.id }, options: { merge: true } });
    });
    if (revisions.length > 10) {
      stats.embeddedCachesCompacted += 1;
      operations.push({ ref: snapshot.ref, data: { versionHistory: newest(revisions, 'createdAt').slice(0, 10).reverse(), dateUpdated: new Date().toISOString() }, options: { merge: true } });
    }
  }

  for (const snapshot of practicesSnap.docs) {
    const logs = snapshot.data().logs || [];
    logs.forEach((log) => {
      if (!log.id) return;
      const id = historyId(snapshot.id, log.id);
      if (existingPracticeLogs.has(id)) return;
      stats.practiceLogsCreated += 1;
      operations.push({ ref: userRef.collection('practiceLogs').doc(id), data: { ...log, id, logId: log.id, practiceId: snapshot.id, userId: userRef.id }, options: { merge: true } });
    });
    if (logs.length > 180) {
      stats.embeddedCachesCompacted += 1;
      operations.push({ ref: snapshot.ref, data: { logs: newest(logs, 'date').slice(0, 180), dateUpdated: new Date().toISOString() }, options: { merge: true } });
    }
  }

  for (const [snapshot, labelField] of [
    ...mediaSnap.docs.map((item) => [item, 'tags']),
    ...vaultSnap.docs.map((item) => [item, 'tags']),
    ...insightsSnap.docs.map((item) => [item, 'tags']),
    ...draftsSnap.docs.map((item) => [item, 'conceptTags']),
    ...practicesSnap.docs.map((item) => [item, 'conceptTags']),
  ]) {
    const data = snapshot.data();
    const conceptIds = unique((data[labelField] || []).map((label) => conceptIdsByName.get(normalized(label))));
    if (JSON.stringify(conceptIds) !== JSON.stringify(data.conceptIds || [])) {
      stats.conceptIdsBackfilled += 1;
      operations.push({ ref: snapshot.ref, data: { conceptIds, dateUpdated: new Date().toISOString() }, options: { merge: true } });
    }
  }

  for (const timelineSnapItem of timelineSnap.docs) {
    stats.timelineEventsSeen += 1;
    const eventId = `legacy_timeline_${timelineSnapItem.id}`;
    if (existingEvents.has(eventId)) continue;
    const event = timelineSnapItem.data();
    stats.thinkingEventsCreated += 1;
    operations.push({
      ref: userRef.collection('thinkingEvents').doc(eventId),
      data: {
        id: eventId,
        eventId,
        userId: userRef.id,
        actorId: userRef.id,
        schemaVersion: 2,
        eventType: 'synthesized',
        actionType: 'synthesized',
        entityType: mappedEntityType(event.entityType),
        entityId: event.entityId || timelineSnapItem.id,
        targetType: mappedEntityType(event.entityType),
        targetId: event.entityId || timelineSnapItem.id,
        relatedEntityIds: {},
        before: null,
        after: { legacyTimelineEvent: event },
        diff: null,
        changedFields: [],
        summary: event.reason || `${event.entityTitle || 'Item'} changed`,
        origin: 'system',
        sourceType: 'system',
        importance: 'medium',
        visibility: 'private',
        idempotencyKey: eventId,
        metadata: { legacyTimelineId: timelineSnapItem.id, migrationVersion: 5 },
        createdAt: event.date || FieldValue.serverTimestamp(),
      },
    });
  }

  operations.push({
    ref: userRef.collection('settings').doc('schema'),
    data: { schemaVersion: 5, collectionMigration: { annotations: 'dual-write', evolution: 'thinkingEvents-canonical', migratedAt: FieldValue.serverTimestamp() } },
    options: { merge: true },
  });
  await commitOperations(operations);
}

const userRefs = requestedUid
  ? [db.collection('users').doc(requestedUid)]
  : (await db.collection('users').listDocuments());

console.log(`${execute ? 'EXECUTE' : 'DRY RUN'} collection migration${requestedUid ? ` for ${requestedUid}` : ''}.`);
for (const userRef of userRefs) await migrateUser(userRef);
console.table(stats);
if (!execute) console.log('No writes were made. Re-run with --execute after reviewing these counts.');
