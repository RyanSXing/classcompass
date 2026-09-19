import type { AppState } from '../contracts';
import { CATALOG_VERSION } from '../assignments';
import { curriculum } from '../curriculum';

/** Append authored additions to saved classrooms without replacing teacher history. */
export function upgradeCatalog(state: AppState): boolean {
  const stamp = new Date().toISOString();
  const previousVersion = state.classroom.catalogVersion ?? 1;
  let changed = previousVersion < CATALOG_VERSION;
  const addedLessonIds: string[] = [];
  for (const lesson of curriculum.lessons) {
    if (state.plans.some(plan => plan.id === lesson.lessonId)) continue;
    const originalId = `${lesson.lessonId}-original`;
    if (!state.planVersions.some(version => version.id === originalId)) state.planVersions.push({ id: originalId, ownerId: state.ownerId, createdAt: stamp, lessonId: lesson.lessonId, versionNumber: 1, previousVersionId: null, snapshot: structuredClone(lesson), proposalId: null, selectedChangeIds: [], evidence: [], actorId: state.ownerId });
    state.plans.push({ id: lesson.lessonId, ownerId: state.ownerId, createdAt: stamp, updatedAt: stamp, revision: 1, unitId: lesson.unitId, date: lesson.date, title: lesson.title, currentVersionId: originalId });
    addedLessonIds.push(lesson.lessonId); changed = true;
  }
  for (const authored of curriculum.calendar) {
    const plan = state.plans.find(plan => plan.id === authored.lessonId);
    const entry = state.calendarEntries.find(entry => entry.id === authored.id);
    if (!entry) {
      state.calendarEntries.push({ id: authored.id, ownerId: state.ownerId, createdAt: stamp, updatedAt: stamp, revision: 1, unitId: curriculum.unit.id, date: authored.date, title: authored.title, instructions: authored.content, kind: authored.eventType, minutes: authored.minutes, locked: authored.locked, objectiveIds: [...authored.learningObjectiveIds], prerequisiteEntryIds: [...authored.prerequisiteCalendarEntryIds], ...(plan ? { lessonId: plan.id, planVersionId: plan.currentVersionId } : {}) });
      changed = true;
    } else if (plan && !entry.locked && !entry.lessonId) {
      // Attaching a new lesson leaves dates, allocations and accepted checkpoints intact.
      entry.lessonId = plan.id; entry.planVersionId = plan.currentVersionId;
      entry.revision++; entry.updatedAt = stamp; changed = true;
    }
  }
  if (!changed) return false;
  state.classroom.catalogVersion = CATALOG_VERSION;
  state.classroom.revision++; state.classroom.calendarRevision++; state.classroom.evidenceRevision++; state.classroom.updatedAt = stamp;
  for (const proposal of state.proposals) if (proposal.status === 'draft') { proposal.status = 'stale'; proposal.revision++; proposal.updatedAt = stamp; }
  for (const job of state.jobs) if (['queued', 'running', 'waiting_retry'].includes(job.status)) {
    job.status = 'cancelled'; job.cancelledAt = stamp; job.errorCode = 'CATALOG_CHANGED'; job.error = 'Assignment definitions changed. Start a fresh analysis; saved readings are retained.'; job.revision++; job.updatedAt = stamp;
    for (const step of job.steps) if (step.status !== 'completed') { step.status = 'cancelled'; delete step.leaseToken; delete step.leaseExpiresAt; }
  }
  state.auditEvents.push({ id: `audit-${crypto.randomUUID()}`, ownerId: state.ownerId, createdAt: stamp, actorId: state.ownerId, action: 'catalog.upgraded', entityId: state.classroom.id, details: { previousVersion, catalogVersion: CATALOG_VERSION, addedLessonIds } });
  return true;
}
