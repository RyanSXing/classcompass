"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Edit3,
  Sparkles,
  Printer,
  CalendarDays,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import {
  PageGate,
  PageHeading,
  EmptyState,
  Banner,
  Modal,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Textarea, Select } from "@/components/ui/input";
import { JobProgress } from "@/components/job-progress";
import { EvidenceView } from "@/components/evidence-view";
import type { LessonBlock, Proposal, ProposalChange } from "@/lib/contracts";
import { dateLabel } from "@/lib/utils";
import { selectResponseRevision } from "@/lib/analytics";
import { getPlanningFindings } from "@/lib/domain";
import { getAssignment } from "@/lib/assignments";
import { assignments } from "@/lib/assignments";
import { assignmentHref } from "@/lib/client/links";
import { buildLessonGuide } from "@/lib/lesson-guide";
import { LessonGuide } from "@/components/lesson-guide";
import { getLessonPlanningState } from "@/lib/teacher-workflow";

function Lanes({ block }: { block: LessonBlock }) {
  const { data } = useWorkspace();
  return (
    <div className="lane-grid">
      {block.lanes?.map((lane) => (
        <div className="lane" key={lane.id}>
          <h4>{lane.title}</h4>
          <Badge tone={lane.teacherLed ? "violet" : "neutral"}>
            {lane.teacherLed ? "With teacher" : "Independent"} · {lane.minutes}{" "}
            min
          </Badge>
          <div className="lane-students">
            {lane.studentIds
              .map(
                (id) =>
                  data?.state.students.find((s) => s.id === id)?.displayName,
              )
              .join(", ") || "No students in this group"}
          </div>
          <p>{lane.instructions}</p>
          {lane.entryCheckStudentIds.length > 0 && (
            <div className="lane-check">
              <strong>Quick entry check:</strong>{" "}
              {lane.entryCheckStudentIds
                .map(
                  (id) =>
                    data?.state.students.find((s) => s.id === id)?.displayName,
                )
                .join(", ")}
              . Gather fresh independent evidence.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function ChangeEditor({
  proposal,
  change,
  onClose,
}: {
  proposal: Proposal;
  change: ProposalChange;
  onClose: () => void;
}) {
  const { data, mutate, notify } = useWorkspace();
  const [draft, setDraft] = useState<ProposalChange>(structuredClone(change));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      wide
      title="Edit lesson change"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await mutate(
                  `/api/proposals/${proposal.id}`,
                  {
                    expectedRevision: proposal.revision,
                    changes: proposal.changes.map((c) =>
                      c.id === draft.id ? draft : c,
                    ),
                    reason,
                  },
                  "PATCH",
                );
                notify("Draft updated. Review and apply when you’re ready.");
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to save");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save edits
          </Button>
        </>
      }
    >
      <div className="form-stack">
        {error && <Banner tone="error">{error}</Banner>}
        <Banner>
          The total stays at 45 minutes. Each student needs exactly one
          activity, with only one teacher-led group.
        </Banner>
        {draft.operation === "schedule_checkpoint" ? (
          <>
            <label className="field">
              <span>Checkpoint title</span>
              <Input
                aria-label="Checkpoint title"
                value={draft.payload.title}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    payload: { ...draft.payload, title: e.target.value },
                  })
                }
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Existing teaching session</span>
                <Select
                  aria-label="Existing teaching session"
                  value={draft.payload.calendarEntryId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      payload: {
                        ...draft.payload,
                        calendarEntryId: e.target.value,
                      },
                    })
                  }
                >
                  {data?.state.calendarEntries
                    .filter((c) => !c.locked && c.minutes === 45)
                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {dateLabel(c.date)} · {c.title}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="field">
                <span>Minutes within session</span>
                <Input
                  aria-label="Minutes within session"
                  type="number"
                  min={1}
                  max={12}
                  value={draft.payload.minutes}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      payload: {
                        ...draft.payload,
                        minutes: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span>Activity title</span>
              <Input
                aria-label="Activity title"
                value={draft.payload.block.title}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    payload: {
                      block: { ...draft.payload.block, title: e.target.value },
                    },
                  })
                }
              />
            </label>
            <label className="field">
              <span>Activity instructions</span>
              <Textarea
                aria-label="Activity instructions"
                value={draft.payload.block.instructions}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    payload: {
                      block: {
                        ...draft.payload.block,
                        instructions: e.target.value,
                      },
                    },
                  })
                }
              />
            </label>
            {draft.payload.block.lanes?.map((lane, index) => (
              <div
                className="spaced"
                key={lane.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 17,
                }}
              >
                <label className="field">
                  <span>Activity {index + 1} title</span>
                  <Input
                    value={lane.title}
                    onChange={(e) => {
                      setDraft({
                        ...draft,
                        payload: {
                          block: {
                            ...draft.payload.block,
                            lanes: draft.payload.block.lanes?.map((l, i) =>
                              i === index ? { ...l, title: e.target.value } : l,
                            ),
                          },
                        },
                      });
                    }}
                  />
                </label>
                <label className="field">
                  <span>Student instructions</span>
                  <Textarea
                    aria-label="Student instructions"
                    value={lane.instructions}
                    onChange={(e) => {
                      setDraft({
                        ...draft,
                        payload: {
                          block: {
                            ...draft.payload.block,
                            lanes: draft.payload.block.lanes?.map((l, i) =>
                              i === index
                                ? { ...l, instructions: e.target.value }
                                : l,
                            ),
                          },
                        },
                      });
                    }}
                  />
                </label>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 9 }}>
                    Students in this activity
                  </div>
                  <div className="pattern-roster">
                    {data?.state.students.map((s) => (
                      <label className="selection-chip" key={s.id}>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={lane.studentIds.includes(s.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setDraft({
                              ...draft,
                              payload: {
                                block: {
                                  ...draft.payload.block,
                                  lanes: draft.payload.block.lanes?.map(
                                    (l, i) =>
                                      i === index
                                        ? {
                                            ...l,
                                            studentIds: checked
                                              ? [...l.studentIds, s.id]
                                              : l.studentIds.filter(
                                                  (id) => id !== s.id,
                                                ),
                                            entryCheckStudentIds:
                                              l.entryCheckStudentIds.filter(
                                                (id) => id !== s.id || checked,
                                              ),
                                          }
                                        : checked
                                          ? {
                                              ...l,
                                              studentIds: l.studentIds.filter(
                                                (id) => id !== s.id,
                                              ),
                                              entryCheckStudentIds:
                                                l.entryCheckStudentIds.filter(
                                                  (id) => id !== s.id,
                                                ),
                                            }
                                          : l,
                                  ),
                                },
                              },
                            });
                          }}
                        />
                        {s.displayName}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        <label className="field">
          <span>Why this change helps</span>
          <Textarea
            aria-label="Why this change helps"
            value={draft.rationale}
            onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Note about your edit</span>
          <Input
            aria-label="Note about your edit"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Shorten the instructions and move a student after reviewing their work."
          />
        </label>
      </div>
    </Modal>
  );
}
const changeTitles: Record<ProposalChange["operation"], string> = {
  replace_practice: "Adjust practice groups",
  replace_exit: "Change the exit question",
  schedule_checkpoint: "Add a follow-up check",
};
function PlanContent({
  lessonId,
  initialVersionId,
}: {
  lessonId: string;
  initialVersionId?: string;
}) {
  const router = useRouter();
  const { data, mutate, notify } = useWorkspace();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [selectionFor, setSelectionFor] = useState("");
  const [activeChangeId, setActiveChangeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [editing, setEditing] = useState<ProposalChange | null>(null);
  const [versionId, setVersionId] = useState(initialVersionId ?? "");
  const [evidenceId, setEvidenceId] = useState("");
  const [error, setError] = useState("");
  const [refreshConfirm, setRefreshConfirm] = useState(false);
  if (!data) return null;
  const { state } = data;
  const plan = state.plans.find((p) => p.id === lessonId);
  if (!plan)
    return (
      <div className="page">
        <EmptyState
          title="Lesson not found"
          text="Choose a lesson or import your own plan."
          action={
            <Button asChild>
              <Link href="/plans">Lessons</Link>
            </Button>
          }
        />
      </div>
    );
  const versions = state.planVersions.filter((v) => v.lessonId === lessonId);
  const currentVersion = versions.find((v) => v.id === plan.currentVersionId)!;
  const version = versionId
    ? versions.find((v) => v.id === versionId)
    : currentVersion;
  if (!version)
    return (
      <div className="page">
        <EmptyState
          title="Saved lesson version unavailable"
          text="This link refers to a version that is not available in this classroom. Open the current lesson to continue."
          action={
            <Button asChild>
              <Link href={`/plans/${lessonId}`}>Open current lesson</Link>
            </Button>
          }
        />
      </div>
    );
  const historical = version.id !== currentVersion.id;
  const {
    proposal,
    hasFreshDraft: fresh,
    hasCurrentSavedChanges,
  } = getLessonPlanningState(state, lessonId);
  const confirmed = getPlanningFindings(state, plan.date);
  const latestReviewedBatch = state.findings
    .filter((finding) => finding.status === "confirmed")
    .map((finding) =>
      state.batches.find((batch) => batch.id === finding.batchId),
    )
    .filter((batch) => !!batch)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0];
  const latestEligibleAssignment = confirmed
    .map((finding) => {
      const batch = state.batches.find((item) => item.id === finding.batchId);
      return batch ? getAssignment(batch.templateId) : undefined;
    })
    .filter((assignment) => !!assignment)
    .sort((a, b) => b.date.localeCompare(a.date) || b.sequence - a.sequence)[0];
  const hasLaterReviewedWork =
    !!latestReviewedBatch && latestReviewedBatch.activityDate >= plan.date;
  const targetAssignment = hasLaterReviewedWork
    ? getAssignment(latestReviewedBatch.templateId)
    : latestEligibleAssignment;
  const wrongTarget =
    hasLaterReviewedWork ||
    (!!targetAssignment && targetAssignment.targetLessonId !== lessonId);
  const targetLesson = state.plans.find(
    (item) => item.id === targetAssignment?.targetLessonId,
  );
  const canGenerate = confirmed.length > 0 && !wrongTarget;
  const sourceAssignment = assignments.find(
    (assignment) => assignment.targetLessonId === lessonId,
  );
  const job = [...state.jobs]
    .reverse()
    .find((j) => j.lessonId === lessonId && j.type === "proposal");
  const selectedIds =
    selected && selectionFor === proposal?.id
      ? selected
      : (proposal?.changes.map((c) => c.id) ?? []);
  const activeChange =
    proposal?.changes.find((c) => c.id === activeChangeId) ??
    proposal?.changes[0];
  const sourceFindings = (activeChange?.findingIds ?? [])
    .map((id) => state.findings.find((f) => f.id === id))
    .filter((f) => !!f);
  const refs = [
    ...new Map(
      (activeChange?.evidence ?? []).map((ref) => [
        `${ref.responseId}:${ref.responseRevision}`,
        ref,
      ]),
    ).values(),
  ];
  const selectedRef =
    refs.find(
      (ref) => `${ref.responseId}:${ref.responseRevision}` === evidenceId,
    ) ?? refs[0];
  const chosenEvidence = selectedRef
    ? selectResponseRevision(
        state,
        selectedRef.responseId,
        selectedRef.responseRevision,
      )
    : undefined;
  const sourceFinding = sourceFindings.find((f) =>
    f.evidence.some(
      (ref) =>
        ref.responseId === selectedRef?.responseId &&
        ref.responseRevision === selectedRef?.responseRevision,
    ),
  );
  const evidenceSubmission = state.submissions.find(
    (s) => s.id === chosenEvidence?.submissionId,
  );
  const sourceObservation = state.observations
    .filter(
      (observation) =>
        activeChange?.findingIds.includes(observation.findingId) &&
        observation.createdAt <= (proposal?.createdAt ?? "") &&
        observation.evidence.some(
          (ref) =>
            ref.responseId === selectedRef?.responseId &&
            ref.responseRevision === selectedRef?.responseRevision,
        ),
    )
    .at(-1);
  const recordedHelp = (
    sourceObservation?.supportSnapshots ??
    (fresh ? sourceFinding?.supportSnapshots : undefined)
  )?.find((s) => s.submissionId === chosenEvidence?.submissionId)?.support;
  const evidenceStudent = state.students.find(
    (s) => s.id === evidenceSubmission?.studentId,
  );
  const oldBlock =
    activeChange && activeChange.operation !== "schedule_checkpoint"
      ? version.snapshot.blocks.find(
          (b) => b.id === activeChange.payload.block.id,
        )
      : undefined;
  const total = version.snapshot.blocks.reduce((n, b) => n + b.minutes, 0);
  const hasMaterials = state.materialSets.some(
    (m) => m.planVersionId === version.id,
  );
  const studentNames = (change: ProposalChange) =>
    [...new Set(change.affectedStudentIds)]
      .map((id) => state.students.find((s) => s.id === id)?.displayName)
      .filter(Boolean)
      .join(", ");
  function chooseForSave(changeId: string, checked: boolean) {
    if (!proposal) return;
    setSelectionFor(proposal.id);
    setSelected(
      checked
        ? [...new Set([...selectedIds, changeId])]
        : selectedIds.filter((id) => id !== changeId),
    );
  }
  async function generate() {
    if (!canGenerate) return;
    setBusy(true);
    setError("");
    setRefreshConfirm(false);
    setAutoRun(true);
    try {
      await mutate(`/api/plans/${plan!.id}/proposals`, {
        basePlanVersionId: plan!.currentVersionId,
        expectedEvidenceRevision: state.classroom.evidenceRevision,
        expectedCalendarRevision: state.classroom.calendarRevision,
      });
      setSelected(null);
      setEvidenceId("");
      setActiveChangeId("");
    } catch (e) {
      setAutoRun(false);
      setError(
        e instanceof Error
          ? e.message
          : "Could not prepare lesson suggestions.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      const result = await mutate<{
        planVersionId?: string;
        versionId?: string;
      }>(`/api/proposals/${proposal.id}/apply`, {
        expectedRevision: proposal.revision,
        basePlanVersionId: proposal.basePlanVersionId,
        expectedEvidenceRevision: state.classroom.evidenceRevision,
        expectedCalendarRevision: state.classroom.calendarRevision,
        selectedChangeIds: selectedIds,
      });
      setVersionId(result.planVersionId ?? result.versionId ?? "");
      router.replace(`/plans/${lessonId}`, { scroll: false });
      setSelected(null);
      notify(
        selectedIds.length
          ? "Lesson saved. Your materials and calendar are ready."
          : "Original lesson kept. The suggestions remain in history.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save these lesson changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page lesson-detail-page">
      <PageHeading
        title={version.snapshot.title}
        description={`${dateLabel(version.snapshot.date, { weekday: "long", month: "long", day: "numeric" })} · ${total} minutes`}
        breadcrumb="Lesson"
      >
        <Select
          aria-label="Saved lesson version"
          value={version.id}
          onChange={(e) => {
            setVersionId(e.target.value);
            setEvidenceId("");
            router.replace(
              `/plans/${lessonId}${e.target.value === plan.currentVersionId ? "" : `?version=${encodeURIComponent(e.target.value)}`}`,
              { scroll: false },
            );
          }}
          style={{ width: "auto" }}
        >
          {[...versions].reverse().map((v) => (
            <option value={v.id} key={v.id}>
              Version {v.versionNumber}
              {v.id === plan.currentVersionId ? " · Current" : " · Earlier"}
            </option>
          ))}
        </Select>
        <Button variant="outline" asChild>
          <Link href="/calendar">
            <CalendarDays />
            Calendar
          </Link>
        </Button>
        {!historical && (
          <Button variant="outline" asChild>
            <Link
              href={`/assistant?lesson=${encodeURIComponent(lessonId)}&prompt=${encodeURIComponent("Help me prepare to teach this saved lesson. Explain the worked example and the checks I should listen for.")}`}
            >
              Ask assistant
            </Link>
          </Button>
        )}
        {hasMaterials && (
          <Button variant="outline" asChild>
            <Link href={`/materials/${version.id}`}>
              <Printer />
              Print materials
            </Link>
          </Button>
        )}
      </PageHeading>
      {error && (
        <div className="mb-16">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
      {historical && (
        <div className="mb-16">
          <Banner>
            You’re viewing saved version {version.versionNumber}.{" "}
            <button
              className="text-link"
              onClick={() => {
                setVersionId("");
                router.replace(`/plans/${lessonId}`, { scroll: false });
              }}
            >
              Open the current lesson
            </button>{" "}
            to make changes.
          </Banner>
        </div>
      )}
      <LessonGuide guide={buildLessonGuide(state, version)} />
      <section
        id="lesson-suggestions"
        className="lesson-suggestions"
        aria-label="Lesson suggestions"
      >
        {!historical && !wrongTarget && !hasCurrentSavedChanges && (
          <p className="help-note mb-16">
            <strong>Make a change?</strong> Use approved teaching notes to adjust
            this lesson. Nothing changes until you save.
          </p>
        )}
        {job && job.status !== "completed" && !historical && (
          <JobProgress key={job.id} job={job} autoStart={autoRun} />
        )}
        {!historical && wrongTarget && targetAssignment && (
          <div className="mb-16">
            <Banner>
              {hasLaterReviewedWork
                ? "Newer work has been reviewed. "
                : "These teaching notes belong to another lesson. "}
              Plan the next lesson after {targetAssignment.title}.{" "}
              <Link
                className="text-link"
                href={`/plans/${targetAssignment.targetLessonId}`}
              >
                Open {targetLesson ? dateLabel(targetLesson.date) : "the next"}{" "}
                lesson
              </Link>
            </Banner>
          </div>
        )}
        {!historical && proposal && !fresh && (
          <div className="mb-16">
            <Banner tone="warning">
              <strong>These suggestions need updating.</strong> The evidence,
              lesson or calendar needs another check. Review affected teaching
              notes, then update the suggestions. Your saved lesson is
              unchanged.{" "}
              {sourceAssignment && !wrongTarget && (
                <Link
                  className="text-link"
                  href={`${assignmentHref(state, sourceAssignment.templateId)}#teaching-notes`}
                >
                  Review teaching notes
                </Link>
              )}
            </Banner>
          </div>
        )}
        {!historical && proposal && activeChange ? (
          <>
            <div className="results-section-heading">
              <div>
                <h2>Suggested changes</h2>
                <p>
                  Compare each suggestion, then check the changes to save.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !canGenerate}
                onClick={() =>
                  proposal.teacherEdited
                    ? setRefreshConfirm(true)
                    : void generate()
                }
              >
                <RefreshCw />
                Update suggestions
              </Button>
            </div>
            <Card className="change-list-card">
              <div
                className="change-list"
                role="group"
                aria-label="Suggested lesson changes"
              >
                {proposal.changes.map((change) => (
                  <div
                    className={`change-list-row${activeChange.id === change.id ? " active" : ""}`}
                    key={change.id}
                  >
                    <input
                      className="checkbox"
                      type="checkbox"
                      checked={selectedIds.includes(change.id)}
                      aria-label={`Save change: ${changeTitles[change.operation]}`}
                      onChange={(e) =>
                        chooseForSave(change.id, e.target.checked)
                      }
                    />
                    <button
                      aria-pressed={activeChange.id === change.id}
                      className="change-select"
                      onClick={() => {
                        setActiveChangeId(change.id);
                        setEvidenceId("");
                      }}
                    >
                      <strong>{changeTitles[change.operation]}</strong>
                      <span>{studentNames(change) || "Whole class"}</span>
                      <small>{change.rationale}</small>
                    </button>
                    <Badge>
                      {change.operation === "schedule_checkpoint"
                        ? change.payload.minutes
                        : change.payload.block.minutes}{" "}
                      min
                    </Badge>
                    <span className="change-decision">
                      {selectedIds.includes(change.id)
                        ? "Save change"
                        : "Keep original"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <section
              className="selected-change-section"
              aria-labelledby="selected-change-title"
            >
              <div className="results-section-heading">
                <h2 id="selected-change-title">
                  {changeTitles[activeChange.operation]}
                </h2>
                <div className="inline-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(activeChange)}
                  >
                    <Edit3 />
                    Edit change
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      chooseForSave(
                        activeChange.id,
                        !selectedIds.includes(activeChange.id),
                      )
                    }
                  >
                    {selectedIds.includes(activeChange.id)
                      ? "Keep original"
                      : "Include change"}
                  </Button>
                </div>
              </div>
              <div className="selected-change-grid">
                <div className="selected-change-content">
                  <Card>
                    <div className="change-body">
                      <dl className="change-at-a-glance">
                        <div><dt>Who</dt><dd>{studentNames(activeChange) || "Whole class"}</dd></div>
                        <div><dt>Time</dt><dd>{activeChange.operation === "schedule_checkpoint" ? `${activeChange.payload.minutes} min within the next session` : `${activeChange.payload.block.minutes} min${oldBlock ? ` · was ${oldBlock.minutes} min` : ""}`}</dd></div>
                      </dl>
                      {activeChange.operation === "schedule_checkpoint" ? (
                        <div className="before-after">
                          <div className="comparison-pane">
                            <h3>Current</h3>
                            <p>
                              {
                                state.calendarEntries.find(
                                  (e) =>
                                    e.id ===
                                    activeChange.payload.calendarEntryId,
                                )?.title
                              }{" "}
                              ·{" "}
                              {dateLabel(
                                state.calendarEntries.find(
                                  (e) =>
                                    e.id ===
                                    activeChange.payload.calendarEntryId,
                                )?.date ?? plan.date,
                              )}
                            </p>
                            <p>45 minutes of planned teaching.</p>
                          </div>
                          <div className="comparison-pane after">
                            <h3>Suggested</h3>
                            <p>
                              {activeChange.payload.title}:{" "}
                              {activeChange.payload.minutes} minutes within this
                              session.
                            </p>
                            <p>
                              {45 - activeChange.payload.minutes} minutes remain
                              for the planned teaching.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="before-after">
                            <div className="comparison-pane">
                              <h3>Current <span>{oldBlock?.minutes ?? "—"} min</span></h3>
                              <strong className="comparison-title">{oldBlock?.title}</strong>
                              <details className="comparison-instructions"><summary>Full instructions</summary><p>{oldBlock?.instructions}</p>
                                {oldBlock?.lanes && <Lanes block={oldBlock} />}
                              </details>
                            </div>
                            <div className="comparison-pane after">
                              <h3>Suggested <span>{activeChange.payload.block.minutes} min</span></h3>
                              <strong className="comparison-title">{activeChange.payload.block.title}</strong>
                              <details className="comparison-instructions"><summary>Full instructions</summary><p>{activeChange.payload.block.instructions}</p></details>
                            </div>
                          </div>
                          {activeChange.payload.block.lanes && (
                            <>
                              <p className="practice-summary">
                                <UsersRound size={18} />
                                {activeChange.payload.block.minutes} minutes ·{" "}
                                {activeChange.payload.block.lanes.length} groups
                                working at the same time
                              </p>
                              <Lanes block={activeChange.payload.block} />
                            </>
                          )}
                        </>
                      )}
                      <details className="selected-change-reason" open>
                        <summary>Why this change</summary>
                        <p>{activeChange.rationale}</p>
                      </details>
                      {activeChange.dependsOnChangeIds.length > 0 && (
                        <p className="answer-facet">
                          Save together with:{" "}
                          {activeChange.dependsOnChangeIds
                            .map((id) => {
                              const dependency = proposal.changes.find(
                                (c) => c.id === id,
                              );
                              return dependency
                                ? changeTitles[dependency.operation]
                                : "another selected change";
                            })
                            .join(", ")}
                          .
                        </p>
                      )}
                    </div>
                  </Card>
                </div>
                <aside
                  className="selected-change-evidence"
                  aria-label="Evidence for selected change"
                >
                  <div className="change-evidence-heading">
                    <h3>Evidence for this change</h3>
                    <p>{sourceFindings.length} linked teaching notes</p>
                  </div>
                  {refs.length ? (
                    <>
                      <label className="field">
                        <span>Student answer</span>
                        <Select
                          aria-label="Evidence for this change"
                          value={
                            selectedRef
                              ? `${selectedRef.responseId}:${selectedRef.responseRevision}`
                              : ""
                          }
                          onChange={(e) => setEvidenceId(e.target.value)}
                        >
                          {refs.map((ref) => {
                            const r = selectResponseRevision(
                              state,
                              ref.responseId,
                              ref.responseRevision,
                            );
                            const sub = state.submissions.find(
                              (s) => s.id === r?.submissionId,
                            );
                            const sourceBatch = state.batches.find(
                              (b) => b.id === sub?.batchId,
                            );
                            const template = data.curriculum.templates.find(
                              (t) => t.id === sourceBatch?.templateId,
                            );
                            return (
                              <option
                                key={`${ref.responseId}:${ref.responseRevision}`}
                                value={`${ref.responseId}:${ref.responseRevision}`}
                              >
                                {state.students.find(
                                  (s) => s.id === sub?.studentId,
                                )?.displayName ?? "Student"}{" "}
                                · Question{" "}
                                {(template?.questionIds.indexOf(
                                  r?.questionId ?? "",
                                ) ?? -1) + 1}{" "}
                                · reading {ref.responseRevision}
                              </option>
                            );
                          })}
                        </Select>
                      </label>
                      {chosenEvidence && evidenceSubmission ? (
                        <>
                          <EvidenceView
                            compact
                            submissionId={chosenEvidence.submissionId}
                            questionId={chosenEvidence.questionId}
                          />
                          <Card>
                            <div className="change-evidence-reading">
                              <strong>
                                {evidenceStudent?.displayName}’s saved reading
                              </strong>
                              <p>
                                {chosenEvidence.workingText ||
                                  "No working shown"}
                              </p>
                              <p>
                                <b>
                                  {chosenEvidence.answerText ||
                                    "No final answer"}
                                </b>
                              </p>
                              <p className="text-small">
                                Help given:{" "}
                                {recordedHelp?.level === "independent"
                                  ? "Without help"
                                  : recordedHelp?.level === "supported"
                                    ? "With help"
                                    : "Not recorded"}
                              </p>
                              {recordedHelp?.note && (
                                <p className="text-small muted">
                                  {recordedHelp.note}
                                </p>
                              )}
                              <details>
                                <summary>Approved teaching note</summary>
                                <p>
                                  {sourceObservation?.interpretation ??
                                    (fresh
                                      ? sourceFinding?.explanation
                                      : "This teaching note has changed. Update the suggestions before using it.")}
                                </p>
                              </details>
                              <Link
                                className="text-link"
                                href={`/review/${evidenceSubmission.batchId}?response=${chosenEvidence.id}&revision=${chosenEvidence.revision}${sourceObservation ? `&observation=${sourceObservation.id}` : ""}#answer-inspector`}
                              >
                                Open this answer
                              </Link>
                            </div>
                          </Card>
                        </>
                      ) : (
                        <Banner tone="warning">
                          The exact saved reading is unavailable. Review this
                          evidence before saving changes.
                        </Banner>
                      )}
                    </>
                  ) : (
                    <Banner>
                      No linked evidence is available for this change.
                    </Banner>
                  )}
                </aside>
              </div>
            </section>
            <div className="plan-save-bar">
              <div>
                <strong>
                  {selectedIds.length} of {proposal.changes.length} changes
                  selected · {total} minutes
                </strong>
                <p>Unchecked changes keep the original lesson.</p>
              </div>
              <div className="inline-actions">
                <Button variant="outline" asChild>
                  <Link href={`/calendar?proposal=${proposal.id}`}>
                    Preview calendar
                  </Link>
                </Button>
                <Button
                  disabled={busy || (selectedIds.length > 0 && !fresh)}
                  onClick={() => void apply()}
                >
                  <Check />
                  {selectedIds.length
                    ? "Save selected changes"
                    : "Keep original lesson"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {!historical && (
              <Card>
                <div className="lesson-suggest-prompt">
                  <div>
                    <h2>
                      {version.versionNumber > 1
                        ? "Saved lesson"
                        : "Adjust this lesson"}
                    </h2>
                    <p>
                      {wrongTarget
                        ? "Keep this saved lesson for reference. Use the linked lesson above for new suggestions."
                        : hasCurrentSavedChanges
                          ? "Your changes are saved in the lesson above. Activities are ready to print."
                          : confirmed.length
                            ? `${confirmed.length} current teaching notes can inform a suggestion. Review every change before saving.`
                            : "Review the student work and approve the teaching notes you want to use."}
                    </p>
                  </div>
                  {!canGenerate && !wrongTarget && sourceAssignment ? (
                    <Button asChild>
                      <Link
                        href={`${assignmentHref(state, sourceAssignment.templateId)}#teaching-notes`}
                      >
                        Review teaching notes
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant={hasCurrentSavedChanges ? "outline" : "default"}
                      disabled={
                        busy ||
                        !canGenerate ||
                        (!!job &&
                          ![
                            "completed",
                            "failed",
                            "cancelled",
                            "blocked",
                          ].includes(job.status))
                      }
                      onClick={() => void generate()}
                    >
                      <Sparkles />
                      Suggest lesson changes
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </section>
      {editing && proposal && (
        <ChangeEditor
          proposal={proposal}
          change={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {refreshConfirm && (
        <Modal
          title="Replace these edited suggestions?"
          onClose={() => setRefreshConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRefreshConfirm(false)}>
                Keep this draft
              </Button>
              <Button
                disabled={busy || !canGenerate}
                onClick={() => void generate()}
              >
                Create new suggestions
              </Button>
            </>
          }
        >
          <p>
            Your edits remain in history. New suggestions use current approved
            evidence; they will not include your unsaved edits automatically.
          </p>
        </Modal>
      )}
    </div>
  );
}
export default function PlanPage({
  lessonId,
  initialVersionId,
}: {
  lessonId: string;
  initialVersionId?: string;
}) {
  return (
    <PageGate>
      <PlanContent
        key={`${lessonId}:${initialVersionId ?? "current"}`}
        lessonId={lessonId}
        initialVersionId={initialVersionId}
      />
    </PageGate>
  );
}
