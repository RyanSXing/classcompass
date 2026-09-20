"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Edit3,
  Play,
  RefreshCw,
  Plus,
  ChevronRight,
  FilterX,
} from "lucide-react";
import type {
  Finding,
  FindingCode,
  Response,
  Submission,
  SupportContext,
  CandidateFindingDraft,
} from "@/lib/contracts";
import { useWorkspace } from "@/components/workspace-provider";
import {
  PageGate,
  PageHeading,
  EmptyState,
  StatusBadge,
  Banner,
  Modal,
} from "@/components/shared";
import { EvidenceView } from "@/components/evidence-view";
import { JobProgress } from "@/components/job-progress";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/input";
import { findingWarnings } from "@/lib/domain";
import {
  currentAssignmentFindings,
  getAssignmentAnalytics,
  selectResponseRevision,
  type ResultBucket,
  type AnalyticsFilters,
} from "@/lib/analytics";
import { getAssignment } from "@/lib/assignments";
import { getAssignmentInsights } from "@/lib/insights";
import { dateLabel, humanize } from "@/lib/utils";

const findingLabels: Record<FindingCode, string> = {
  denominator_addition: "Adding the denominators",
  equivalent_fraction_reasoning: "Uses equivalent fractions",
  correct_with_support: "Correct with help",
  needs_independent_check: "Ready for a check without help",
  ambiguous_transcription: "Reading needs a check",
  insufficient_evidence: "More evidence needed",
  other_teacher_finding: "Teacher observation",
};
function TranscriptionEditor({
  response,
  onClose,
  onSaved,
  advance = false,
}: {
  response: Response;
  onClose: () => void;
  onSaved?: () => void;
  advance?: boolean;
}) {
  const { mutate, notify } = useWorkspace();
  const [working, setWorking] = useState(response.workingText);
  const [answer, setAnswer] = useState(response.answerText ?? "");
  const [legibility, setLegibility] = useState(response.legibility);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Edit the reading"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await mutate(
                  `/api/responses/${response.id}`,
                  {
                    expectedRevision: response.revision,
                    workingText: working,
                    answerText: answer || null,
                    legibility,
                    readingStatus:
                      legibility === "uncertain" ? "unreviewed" : "resolved",
                    reason,
                  },
                  "PATCH",
                );
                notify(
                  "Reading saved. Update affected teaching notes before using them.",
                );
                onClose();
                onSaved?.();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Check />
            {busy ? "Saving…" : advance ? "Save and next" : "Save reading"}
          </Button>
        </>
      }
    >
      <div className="reading-edit-grid">
        <EvidenceView
          submissionId={response.submissionId}
          questionId={response.questionId}
          compact
        />
        <fieldset className="form-stack reading-fields" disabled={busy}>
          {error && <Banner tone="error">{error}</Banner>}
          <label className="field">
            <span>Working shown on the page</span>
            <Textarea
              aria-label="Working shown on the page"
              value={working}
              onChange={(e) => setWorking(e.target.value)}
              rows={4}
            />
          </label>
          <label className="field">
            <span>Final answer</span>
            <Input
              aria-label="Final answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          <label className="field">
            <span>How readable is this response?</span>
            <Select
              aria-label="How readable is this response?"
              value={legibility}
              onChange={(e) =>
                setLegibility(e.target.value as Response["legibility"])
              }
            >
              <option value="clear">Clear — I checked the original work</option>
              <option value="uncertain">Still uncertain</option>
              <option value="blank">Blank</option>
            </Select>
          </label>
          <label className="field">
            <span>Reason or review note</span>
            <Input
              aria-label="Reason or review note"
              placeholder="What did you check or change?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="muted text-small">
            The original work and earlier readings stay saved.
          </p>
        </fieldset>
      </div>
    </Modal>
  );
}
function SupportEditor({
  submission,
  onClose,
  onSaved,
}: {
  submission: Submission;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { mutate, notify } = useWorkspace();
  const [level, setLevel] = useState(submission.support.level);
  const [note, setNote] = useState(submission.support.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Edit help given"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !note.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await mutate(
                  `/api/submissions/${submission.id}/support`,
                  {
                    expectedRevision: submission.revision,
                    support: { level, source: "teacher-corrected", note },
                    reason: note,
                  },
                  "PATCH",
                );
                notify("Help given updated. Numerical results stay separate.");
                onClose();
                onSaved?.();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not save the help given. Try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Save help given
          </Button>
        </>
      }
    >
      <fieldset
        className="form-stack"
        disabled={busy}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        {error && <Banner tone="error">{error}</Banner>}
        <Banner>
          This applies to all answers on this worksheet. The teacher records
          assistance; correct answers alone don’t establish independence.
        </Banner>
        <label className="field">
          <span>Help given</span>
          <Select
            aria-label="Help given"
            value={level}
            onChange={(e) =>
              setLevel(e.target.value as SupportContext["level"])
            }
          >
            <option value="independent">Completed independently</option>
            <option value="supported">Completed with support</option>
            <option value="unknown">Help was not recorded</option>
          </Select>
        </label>
        <label className="field">
          <span>What help was provided or verified?</span>
          <Textarea
            aria-label="What help was provided or verified?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I prompted the student to find a common denominator on each question."
          />
        </label>
      </fieldset>
    </Modal>
  );
}
function FindingEditor({
  finding,
  onClose,
  isNew = false,
}: {
  finding: Finding;
  onClose: () => void;
  isNew?: boolean;
}) {
  const { data, mutate, notify } = useWorkspace();
  const [code, setCode] = useState(finding.code);
  const [explanation, setExplanation] = useState(finding.explanation);
  const [scope, setScope] = useState(finding.claimScope);
  const [step, setStep] = useState(finding.suggestedNextStep);
  const [objectiveId, setObjectiveId] = useState(finding.objectiveId);
  const [evidence, setEvidence] = useState(finding.evidence);
  const [limitations, setLimitations] = useState(
    finding.limitations.join("\n"),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const responses =
    data?.state.responses.filter((r) =>
      data.state.submissions.some(
        (sub) =>
          sub.id === r.submissionId && sub.studentId === finding.studentId,
      ),
    ) ?? [];
  async function save() {
    setBusy(true);
    setError("");
    const fields = {
      objectiveId,
      code,
      claimScope: scope,
      explanation,
      evidence,
      limitations: limitations
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      suggestedNextStep: step,
    };
    try {
      if (isNew)
        await mutate("/api/findings", {
          ...fields,
          studentId: finding.studentId,
          batchId: finding.batchId,
        });
      else
        await mutate(
          `/api/findings/${finding.id}`,
          { ...fields, expectedRevision: finding.revision, reason },
          "PATCH",
        );
      notify("Teaching note saved. Approve it when ready.");
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This interpretation could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={isNew ? "Add a teacher note" : "Edit teaching note"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              (!isNew && !reason.trim()) ||
              !explanation.trim() ||
              !evidence.length
            }
            onClick={() => void save()}
          >
            Save note
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Banner>
          Notes need your approval before they can support a lesson change.
        </Banner>
        {error && <Banner tone="error">{error}</Banner>}
        <div className="form-grid">
          <label className="field">
            <span>Note type</span>
            <Select
              aria-label="Note type"
              value={code}
              onChange={(e) => setCode(e.target.value as FindingCode)}
            >
              {Object.entries(findingLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>What this note describes</span>
            <Select
              aria-label="What this note describes"
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as CandidateFindingDraft["claimScope"])
              }
            >
              <option value="mathematics">Mathematics</option>
              <option value="independent_performance">
                Independent performance
              </option>
              <option value="evidence_quality">Evidence quality</option>
            </Select>
          </label>
        </div>
        <label className="field">
          <span>Learning objective</span>
          <Select
            aria-label="Learning objective"
            value={objectiveId}
            onChange={(e) => setObjectiveId(e.target.value)}
          >
            {data?.curriculum.objectives.map((o) => (
              <option value={o.id} key={o.id}>
                {o.description}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>Teaching note</span>
          <Textarea
            aria-label="Teaching note"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </label>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="eyebrow" style={{ marginBottom: 9 }}>
            Supporting responses
          </legend>
          <div className="pattern-roster">
            {responses.map((r) => {
              const sub = data?.state.submissions.find(
                (x) => x.id === r.submissionId,
              );
              const batch = data?.state.batches.find(
                (x) => x.id === sub?.batchId,
              );
              return (
                <label className="selection-chip" key={r.id}>
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={evidence.some((ref) => ref.responseId === r.id)}
                    onChange={(e) =>
                      setEvidence(
                        e.target.checked
                          ? [
                              ...evidence,
                              {
                                responseId: r.id,
                                responseRevision: r.revision,
                              },
                            ]
                          : evidence.filter((ref) => ref.responseId !== r.id),
                      )
                    }
                  />
                  {batch ? dateLabel(batch.activityDate) : ""} ·{" "}
                  {r.questionId.replace("q-", "Q").replace("fq", "Q")}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="field">
          <span>Limitations or missing context</span>
          <Textarea
            aria-label="Limitations or missing context"
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            placeholder="One note per line; leave blank if none."
          />
        </label>
        <label className="field">
          <span>Suggested next step</span>
          <Select
            aria-label="Suggested next step"
            value={step}
            onChange={(e) =>
              setStep(
                e.target.value as CandidateFindingDraft["suggestedNextStep"],
              )
            }
          >
            {[
              "targeted_equal_parts",
              "independent_application",
              "extension",
              "independent_check",
              "gather_evidence",
            ].map((v) => (
              <option key={v} value={v}>
                {nextStepLabels[v as keyof typeof nextStepLabels]}
              </option>
            ))}
          </Select>
        </label>
        {!isNew && (
          <label className="field">
            <span>Reason for your change</span>
            <Input
              aria-label="Reason for your change"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
type ReviewPageProps = {
  batchId: string;
  startAnalysis?: boolean;
};
const resultLabels: Record<ResultBucket, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  flagged: "Flagged",
  unanswered: "No answer",
  unprocessed: "Not analyzed",
  not_received: "Not received",
};
const helpLabels = {
  independent: "Without help",
  supported: "With help",
  unknown: "Help not recorded",
};
const nextStepLabels: Record<
  CandidateFindingDraft["suggestedNextStep"],
  string
> = {
  targeted_equal_parts: "Practice making equal parts with a teacher",
  independent_application: "Try the next problem independently",
  extension: "Explain a more challenging problem",
  independent_check: "Check this skill without help",
  gather_evidence: "Collect another answer before deciding",
};
function ReviewContent({ batchId, startAnalysis = false }: ReviewPageProps) {
  const { data, mutate, notify } = useWorkspace();
  const search = useSearchParams();
  const focusInspector = useRef(false);
  useEffect(() => {
    if (focusInspector.current) {
      document.getElementById("selected-answer-heading")?.focus();
      focusInspector.current = false;
    }
  }, [search]);
  const [editingResponse, setEditingResponse] = useState<Response | null>(null);
  const [advanceAfterSave, setAdvanceAfterSave] = useState(false);
  const [queueFinished, setQueueFinished] = useState(false);
  const [editingSupport, setEditingSupport] = useState<Submission | null>(null);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [newFinding, setNewFinding] = useState<Finding | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [runBatchId, setRunBatchId] = useState(startAnalysis ? batchId : "");
  if (!data) return null;
  const { state, curriculum } = data;
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch)
    return (
      <div className="page">
        <EmptyState
          title="Assignment not found"
          text="Choose an assignment to view its results."
          action={
            <Button asChild>
              <Link href="/assignments">Assignments</Link>
            </Button>
          }
        />
      </div>
    );
  const assignment = getAssignment(batch.templateId);
  const template = curriculum.templates.find(
    (item) => item.id === batch.templateId,
  )!;
  const resultParam = search.get("result") ?? "all";
  const supportParam = search.get("support") ?? "all";
  const filters: AnalyticsFilters = {
    studentId: search.get("student") || undefined,
    questionId: search.get("question") || undefined,
    result: resultParam in resultLabels ? (resultParam as ResultBucket) : "all",
    support:
      supportParam in helpLabels
        ? (supportParam as SupportContext["level"])
        : "all",
  };
  const analytics = getAssignmentAnalytics(state, batch.templateId, filters);
  const broad = getAssignmentAnalytics(state, batch.templateId, {
    ...filters,
    result: "all",
  });
  const explicitResponse = state.responses.find(
    (r) => r.id === search.get("response"),
  );
  const selectedSlot =
    (explicitResponse
      ? analytics.allSlots.find(
          (slot) => slot.responseId === explicitResponse.id,
        )
      : undefined) ??
    analytics.slots.find(
      (slot) =>
        slot.studentId === search.get("focusStudent") &&
        slot.questionId === search.get("focusQuestion"),
    ) ??
    analytics.slots.find((slot) => slot.batchId === batchId) ??
    analytics.slots[0];
  const revisionValue = search.get("revision");
  const requestedRevision =
    revisionValue && /^\d+$/.test(revisionValue)
      ? Number(revisionValue)
      : undefined;
  const selectedResponseId = explicitResponse?.id ?? selectedSlot?.responseId;
  const response = selectedResponseId
    ? selectResponseRevision(state, selectedResponseId, requestedRevision)
    : undefined;
  const currentResponse = state.responses.find(
    (r) => r.id === selectedResponseId,
  );
  const submission = state.submissions.find(
    (s) =>
      s.id ===
      (response?.submissionId ??
        explicitResponse?.submissionId ??
        selectedSlot?.submissionId),
  );
  const student = state.students.find(
    (s) => s.id === (submission?.studentId ?? selectedSlot?.studentId),
  );
  const questionId =
    response?.questionId ??
    explicitResponse?.questionId ??
    selectedSlot?.questionId;
  const question = curriculum.questions.find((q) => q.id === questionId);
  const questionIndex = template.questionIds.indexOf(questionId ?? "");
  const currentSlotForAnswer = analytics.allSlots.find(
    (slot) => slot.studentId === student?.id && slot.questionId === questionId,
  );
  const oldAttempt =
    !!submission &&
    !analytics.allSlots.some((slot) => slot.submissionId === submission.id);
  const observation = state.observations.find(
    (o) =>
      o.id === search.get("observation") &&
      o.evidence.some(
        (ref) =>
          ref.responseId === response?.id &&
          ref.responseRevision === response?.revision,
      ),
  );
  const supportSnapshot = observation?.supportSnapshots.find(
    (snapshot) => snapshot.submissionId === submission?.id,
  );
  const historical =
    oldAttempt ||
    (requestedRevision !== undefined && !response) ||
    (!!response && response.revision !== currentResponse?.revision) ||
    (!!supportSnapshot &&
      supportSnapshot.submissionRevision !== submission?.revision);
  const support =
    supportSnapshot?.support ??
    (!historical && !oldAttempt ? submission?.support : undefined);
  const extraction = state.extractions.find(
    (e) => e.id === response?.extractionId,
  );
  const originalReadingNote = extraction?.raw.responses.find(
    (item) => item.questionId === response?.questionId,
  )?.uncertaintyNote;
  const teacherCorrected = state.responseRevisions.some(
    (revision) =>
      revision.responseId === response?.id &&
      revision.after.revision <= (response?.revision ?? 0) &&
      (revision.before.answerText !== revision.after.answerText ||
        revision.before.workingText !== revision.after.workingText ||
        revision.before.legibility !== revision.after.legibility),
  );
  const findings = currentAssignmentFindings(state, batch.templateId);
  const visibleFindings = findings.filter((finding) =>
    finding.evidence.some((ref) =>
      analytics.slots.some((slot) => slot.responseId === ref.responseId),
    ),
  );
  const noteWarnings = new Map(
    findings.map((finding) => {
      const currentReadings = finding.evidence.every((ref) =>
        state.responses.some(
          (item) =>
            item.id === ref.responseId &&
            item.revision === ref.responseRevision,
        ),
      );
      const currentHelp = finding.supportSnapshots.every((snapshot) =>
        state.submissions.some(
          (item) =>
            item.id === snapshot.submissionId &&
            item.revision === snapshot.submissionRevision,
        ),
      );
      const warnings =
        finding.status === "stale" || !currentReadings || !currentHelp
          ? [
              "The readings or help given have changed. Update teaching notes before using this note.",
            ]
          : findingWarnings(state, finding, {
              acknowledgeClear: true,
              batchId: finding.batchId,
            });
      return [finding.id, warnings] as const;
    }),
  );
  const warningsFor = (finding: Finding) => noteWarnings.get(finding.id) ?? [];
  const approved = findings.filter(
    (f) => f.status === "confirmed" && !warningsFor(f).length,
  );
  const reviewable = (f: Finding) =>
    f.status === "candidate" && warningsFor(f).length === 0;
  const selectedReviewable = visibleFindings.filter(
    (f) => selectedNotes.includes(f.id) && reviewable(f),
  );
  const flags = analytics.slots.filter(
    (slot) => slot.bucket === "flagged" && slot.responseId,
  );
  const nextFlag = flags.find((slot) => slot.responseId !== response?.id);
  const actionBatch =
    state.batches.find(
      (item) => item.id === (submission?.batchId ?? selectedSlot?.batchId),
    ) ?? (!selectedSlot ? batch : undefined);
  const job = state.jobs.find((j) => j.id === actionBatch?.latestJobId);
  const uploadHasFindings = findings.some((f) => f.batchId === actionBatch?.id);
  const students = state.students.filter((s) =>
    analytics.slots.some((slot) => slot.studentId === s.id),
  );
  const questionIds = template.questionIds.filter(
    (id) => !filters.questionId || filters.questionId === id,
  );
  const targetLesson = getAssignmentInsights(
    state,
    batch.templateId,
  ).targetLessonId;
  const outsideFilters =
    !!response &&
    !analytics.slots.some((slot) => slot.responseId === response.id);
  function updateQuery(
    values: Record<string, string | undefined>,
    resetAnswer = false,
  ) {
    const query = new URLSearchParams(window.location.search);
    query.delete("run");
    if (resetAnswer) {
      setRunBatchId("");
      [
        "response",
        "revision",
        "observation",
        "focusStudent",
        "focusQuestion",
      ].forEach((key) => query.delete(key));
    }
    Object.entries(values).forEach(([key, value]) =>
      value && value !== "all" ? query.set(key, value) : query.delete(key),
    );
    window.history.replaceState(
      null,
      "",
      `/review/${batchId}${query.size ? `?${query}` : ""}`,
    );
  }
  function chooseAnswer(slot: (typeof analytics.slots)[number]) {
    if (slot.batchId !== actionBatch?.id) setRunBatchId("");
    focusInspector.current = true;
    setQueueFinished(false);
    updateQuery({
      response: slot.responseId,
      focusStudent: slot.studentId,
      focusQuestion: slot.questionId,
      revision: undefined,
      observation: undefined,
    });
  }
  async function review(list: Finding[], decision: "confirm" | "reject") {
    if (!list.length) return;
    setBusy(true);
    try {
      await mutate("/api/findings/review", {
        items: list.map((f) => ({
          findingId: f.id,
          expectedRevision: f.revision,
          decision,
        })),
        acknowledgeClearReadings: true,
      });
      setSelectedNotes([]);
      notify(
        decision === "confirm"
          ? `${list.length} teaching note${list.length === 1 ? "" : "s"} approved.`
          : "Teaching note dismissed. Original work is saved.",
      );
    } catch {
      /* The workspace shows the API message. */
    } finally {
      setBusy(false);
    }
  }
  function addNote() {
    if (!response || !submission) return;
    const draft: CandidateFindingDraft = {
      studentId: submission.studentId,
      objectiveId: curriculum.objectives[0].id,
      code: "other_teacher_finding",
      claimScope: "mathematics",
      explanation: "",
      evidence: [
        { responseId: response.id, responseRevision: response.revision },
      ],
      limitations: [],
      suggestedNextStep: "gather_evidence",
    };
    setNewFinding({
      ...draft,
      id: "new-local-draft",
      ownerId: state.ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 1,
      batchId: submission.batchId,
      status: "candidate",
      observationStatus: "insufficient",
      supportSnapshots: [],
      source: "teacher",
      provenance: null,
      originalDraft: draft,
      priorVersions: [],
      eligibilityWarnings: [],
    });
  }
  return (
    <div className="page assignment-results-page">
      <PageHeading
        title={assignment?.title ?? batch.title}
        description={`${dateLabel(batch.activityDate)} · ${analytics.submittedStudents} of ${analytics.expectedStudents} students submitted`}
        breadcrumb="Assignment results"
      >
        <Button variant="outline" asChild>
          <Link
            href={`/classroom?upload=work&assignment=${encodeURIComponent(batch.templateId)}`}
          >
            <Plus />
            Add worksheets
          </Link>
        </Button>
        <Button
          variant="outline"
          disabled={
            busy ||
            !actionBatch ||
            historical ||
            oldAttempt ||
            (!!job &&
              !["completed", "failed", "cancelled", "blocked"].includes(
                job.status,
              ))
          }
          onClick={async () => {
            if (!actionBatch) return;
            setBusy(true);
            setRunBatchId(actionBatch.id);
            try {
              await mutate(`/api/batches/${actionBatch.id}/analyze`, {
                expectedRevision: actionBatch.revision,
              });
            } catch {
              setRunBatchId("");
            } finally {
              setBusy(false);
            }
          }}
        >
          {uploadHasFindings ? <RefreshCw /> : <Play />}
          {uploadHasFindings ? "Update teaching notes" : "Analyze this upload"}
        </Button>
        <span className="processing-upload-context">
          {actionBatch
            ? `Selected upload · ${actionBatch.submissionIds.length} worksheet${actionBatch.submissionIds.length === 1 ? "" : "s"}`
            : "No worksheet selected"}
        </span>
      </PageHeading>
      {job && (
        <JobProgress
          key={job.id}
          job={job}
          autoStart={runBatchId === actionBatch?.id}
        />
      )}
      <section aria-labelledby="answer-results-heading">
        <div className="results-section-heading">
          <h2 id="answer-results-heading">Answer results</h2>
          <p>
            {broad.counts.total} answers · {broad.counts.usable} with a usable
            result
          </p>
        </div>
        <div className="result-counts">
          {(Object.keys(resultLabels) as ResultBucket[]).map((bucket) => (
            <button
              key={bucket}
              className={`result-count result-${bucket}${filters.result === bucket ? " active" : ""}`}
              aria-pressed={filters.result === bucket}
              onClick={() =>
                updateQuery(
                  { result: filters.result === bucket ? undefined : bucket },
                  true,
                )
              }
            >
              <strong>{broad.counts[bucket]}</strong>
              <span>{resultLabels[bucket]}</span>
            </button>
          ))}
        </div>
        <div className="results-filters">
          <label className="field">
            <span>Student</span>
            <Select
              aria-label="Filter student"
              value={filters.studentId ?? ""}
              onChange={(e) => updateQuery({ student: e.target.value }, true)}
            >
              <option value="">All students</option>
              {state.students.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.displayName}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>Question</span>
            <Select
              aria-label="Filter question"
              value={filters.questionId ?? ""}
              onChange={(e) => updateQuery({ question: e.target.value }, true)}
            >
              <option value="">All questions</option>
              {template.questionIds.map((id, i) => (
                <option value={id} key={id}>
                  Question {i + 1}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>Result</span>
            <Select
              aria-label="Filter result"
              value={filters.result ?? "all"}
              onChange={(e) => updateQuery({ result: e.target.value }, true)}
            >
              <option value="all">All results</option>
              {Object.entries(resultLabels).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>Help given</span>
            <Select
              aria-label="Filter help given"
              value={filters.support ?? "all"}
              onChange={(e) => updateQuery({ support: e.target.value }, true)}
            >
              <option value="all">All help levels</option>
              {Object.entries(helpLabels).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          {(filters.studentId ||
            filters.questionId ||
            filters.result !== "all" ||
            filters.support !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateQuery(
                  {
                    student: undefined,
                    question: undefined,
                    result: undefined,
                    support: undefined,
                  },
                  true,
                )
              }
            >
              <FilterX />
              Clear filters
            </Button>
          )}
        </div>
        <Card className="results-table-card">
          <div className="table-wrap">
            <table className="answer-table">
              <caption className="sr-only">
                {assignment?.title ?? batch.title}: student answers. Select an
                answer to inspect the original work.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  {questionIds.map((id) => (
                    <th scope="col" key={id}>
                      <button
                        onClick={() =>
                          updateQuery(
                            { question: filters.questionId ? undefined : id },
                            true,
                          )
                        }
                        aria-label={`Filter question ${template.questionIds.indexOf(id) + 1}`}
                      >
                        Q{template.questionIds.indexOf(id) + 1}
                      </button>
                      <span className="question-prompt">
                        {curriculum.questions.find((q) => q.id === id)?.prompt}
                      </span>
                    </th>
                  ))}
                  <th scope="col">Help given</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">
                      <Link href={`/students/${s.id}`}>{s.displayName}</Link>
                    </th>
                    {questionIds.map((id) => {
                      const slot = analytics.slots.find(
                        (item) =>
                          item.studentId === s.id && item.questionId === id,
                      );
                      if (!slot)
                        return (
                          <td key={id}>
                            <span
                              className="answer-filtered"
                              aria-label="Hidden by filters"
                            >
                              —
                            </span>
                          </td>
                        );
                      const active =
                        selectedSlot?.id === slot.id &&
                        !historical &&
                        !oldAttempt;
                      return (
                        <td key={id}>
                          <button
                            className={`answer-cell result-${slot.bucket}${active ? " active" : ""}`}
                            aria-pressed={active}
                            aria-label={`${s.displayName}, question ${template.questionIds.indexOf(id) + 1}: ${resultLabels[slot.bucket]}${slot.response?.answerText ? `, ${slot.response.answerText}` : ""}`}
                            onClick={() => chooseAnswer(slot)}
                          >
                            <strong>{slot.response?.answerText || "—"}</strong>
                            <span>{resultLabels[slot.bucket]}</span>
                            {slot.teacherReviewed && (
                              <Check size={12} aria-label="Reading reviewed" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td>
                      <span className="help-text">
                        {helpLabels[
                          (analytics.allSlots.find(
                            (slot) => slot.studentId === s.id,
                          )?.supportLevel ??
                            "unknown") as keyof typeof helpLabels
                        ] ?? "Not recorded"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!students.length && (
            <div className="compact-empty">
              No answers match these filters.{" "}
              <button
                className="text-link"
                onClick={() =>
                  updateQuery(
                    {
                      result: undefined,
                      student: undefined,
                      question: undefined,
                      support: undefined,
                    },
                    true,
                  )
                }
              >
                Clear filters
              </button>
            </div>
          )}
          <div className="answer-table-foot">
            <span>
              Showing {analytics.counts.total} of {analytics.allSlots.length}{" "}
              answers
            </span>
            <span>Flagged answers are not counted as incorrect.</span>
          </div>
        </Card>
      </section>
      <section
        id="answer-inspector"
        className="answer-inspector-section"
        aria-labelledby="selected-answer-heading"
      >
        <div className="results-section-heading">
          <div>
            <h2 id="selected-answer-heading" tabIndex={-1}>
              {student
                ? `${student.displayName} · Question ${questionIndex + 1}`
                : "Select an answer"}
            </h2>
            <p>
              {historical || oldAttempt
                ? "Saved earlier work"
                : "Original work and current reading"}
            </p>
          </div>
          {nextFlag && !historical && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => chooseAnswer(nextFlag)}
            >
              Next flagged answer
              <ChevronRight />
            </Button>
          )}
        </div>
        {queueFinished && (
          <div className="mb-16">
            <Banner tone={broad.counts.flagged ? "warning" : "success"}>
              {broad.counts.flagged
                ? `${broad.counts.flagged} flagged answer${broad.counts.flagged === 1 ? " still needs" : "s still need"} a check in this view.`
                : "No flagged answers remain in this view."}{" "}
              <button
                className="text-link"
                onClick={() => {
                  setQueueFinished(false);
                  updateQuery({ result: undefined }, true);
                  document
                    .getElementById("answer-results-heading")
                    ?.scrollIntoView();
                }}
              >
                Return to results
              </button>
            </Banner>
          </div>
        )}
        {(historical || oldAttempt || (requestedRevision && !response)) && (
          <div className="mb-16">
            <Banner tone="warning">
              {requestedRevision && !response
                ? "That saved reading could not be found. The current reading has not been substituted."
                : `You’re viewing ${oldAttempt ? "an earlier upload" : `reading revision ${response?.revision}`}. It does not change the current results.`}
              <button
                className="text-link"
                disabled={!currentSlotForAnswer}
                onClick={() => {
                  if (currentSlotForAnswer) chooseAnswer(currentSlotForAnswer);
                }}
              >
                {" "}
                View current results
              </button>
            </Banner>
          </div>
        )}
        {outsideFilters && !historical && !oldAttempt && (
          <p className="answer-filter-note">
            This selected answer no longer matches your filters. The table
            totals have updated.
          </p>
        )}
        {submission && questionId ? (
          <div className="answer-inspector">
            <EvidenceView
              submissionId={submission.id}
              questionId={questionId}
            />
            <Card>
              <div className="answer-detail">
                <div className="answer-detail-heading">
                  <h3>Reading</h3>
                  {response && (
                    <Badge
                      tone={
                        extraction?.provenance.mode === "fixture"
                          ? "violet"
                          : "aqua"
                      }
                    >
                      {extraction?.provenance.mode === "fixture"
                        ? "Sample reading"
                        : extraction?.provenance.mode === "live"
                          ? "Live reading"
                          : "Source unavailable"}
                    </Badge>
                  )}
                </div>
                {response ? (
                  <>
                    <div className="transcript">
                      {response.workingText || (
                        <span className="muted">No working shown</span>
                      )}
                      <strong>
                        {response.answerText || "No final answer"}
                      </strong>
                    </div>
                    <div className="answer-facts">
                      <div>
                        <span>Numerical result</span>
                        <strong>
                          {historical || oldAttempt
                            ? humanize(response.mathCheck.status)
                            : resultLabels[
                                selectedSlot?.bucket ?? "unprocessed"
                              ]}
                        </strong>
                      </div>
                      <div>
                        <span>Help given</span>
                        <strong>
                          {support
                            ? helpLabels[support.level]
                            : "Historical help not available"}
                        </strong>
                      </div>
                      {question && (
                        <div>
                          <span>Expected value</span>
                          <strong>
                            {question.expectedAnswer.canonicalFraction}
                            {question.answerUnit
                              ? ` ${question.answerUnit}`
                              : ""}
                          </strong>
                        </div>
                      )}
                      <div>
                        <span>Reading checked</span>
                        <strong>
                          {response.readingStatus === "resolved"
                            ? "Yes"
                            : "Not yet"}
                        </strong>
                      </div>
                    </div>
                    {teacherCorrected && (
                      <Badge tone="green">Teacher corrected</Badge>
                    )}
                    {support?.note && (
                      <p className="text-small muted">{support.note}</p>
                    )}
                    {!!selectedSlot?.reviewReasons.length &&
                      !historical &&
                      !oldAttempt &&
                      !(
                        selectedSlot.teacherReviewed &&
                        ["correct", "incorrect"].includes(selectedSlot.bucket)
                      ) && (
                        <div className="reading-flags">
                          <strong>Check this reading</strong>
                          <ul>
                            {selectedSlot.reviewReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {(historical || oldAttempt
                      ? response.mathCheck.unitStatus
                      : selectedSlot?.facets.unitStatus) === "missing" && (
                      <p className="answer-facet">
                        Units are missing. This is separate from the numerical
                        result.
                      </p>
                    )}
                    {(historical || oldAttempt
                      ? response.mathCheck.contradictions
                      : (selectedSlot?.facets.contradictions ?? [])
                    ).length > 0 && (
                      <p className="answer-facet">
                        Working to discuss:{" "}
                        {(historical || oldAttempt
                          ? response.mathCheck.contradictions
                          : (selectedSlot?.facets.contradictions ?? [])
                        ).join(" ")}
                      </p>
                    )}
                    {!historical && !oldAttempt && (
                      <div className="answer-actions">
                        <Button
                          onClick={() => {
                            setAdvanceAfterSave(false);
                            setEditingResponse(response);
                          }}
                        >
                          <Edit3 />
                          Edit reading
                        </Button>
                        {selectedSlot?.bucket === "flagged" && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAdvanceAfterSave(true);
                              setEditingResponse(response);
                            }}
                          >
                            Check and move to next
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => setEditingSupport(submission)}
                        >
                          Edit help given
                        </Button>
                      </div>
                    )}
                    <details className="answer-history">
                      <summary>Review history</summary>
                      {question && (
                        <>
                          <p>
                            Question type:{" "}
                            {question.taskDifficulty === "core-transfer"
                              ? "Apply the skill in a new context"
                              : "Core fraction calculation"}
                            .
                          </p>
                          <p>
                            Skills:{" "}
                            {question.learningObjectiveIds
                              .map(
                                (id) =>
                                  curriculum.objectives.find((o) => o.id === id)
                                    ?.description,
                              )
                              .filter(Boolean)
                              .join("; ")}
                            .
                          </p>
                        </>
                      )}
                      <p>
                        {extraction?.provenance.mode === "fixture"
                          ? "Prepared sample output"
                          : "Live model output"}
                        . Updating teaching notes reuses saved readings and
                        teacher corrections.
                      </p>
                      {originalReadingNote && (
                        <p>
                          <strong>Original reading note:</strong>{" "}
                          {originalReadingNote}
                        </p>
                      )}
                      {response.uncertaintyNote &&
                        response.uncertaintyNote !== originalReadingNote && (
                          <p>
                            <strong>Current reading note:</strong>{" "}
                            {response.uncertaintyNote}
                          </p>
                        )}
                      <p>
                        Reading revision {response.revision} ·{" "}
                        {extraction?.provenance.modelId ?? "Source unavailable"}
                      </p>
                      {state.responseRevisions
                        .filter((r) => r.responseId === response.id)
                        .map((r) => (
                          <div key={r.id}>
                            <button
                              className="text-link"
                              onClick={() =>
                                updateQuery({
                                  response: response.id,
                                  revision: String(r.before.revision),
                                })
                              }
                            >
                              View revision {r.before.revision}
                            </button>
                            <p>
                              {r.before.answerText || "No answer"} →{" "}
                              {r.after.answerText || "No answer"}. {r.reason}
                            </p>
                          </div>
                        ))}
                      {analytics.totalAttempts > analytics.submittedStudents &&
                        state.submissions
                          .filter(
                            (s) =>
                              s.studentId === submission.studentId &&
                              state.batches.find((b) => b.id === s.batchId)
                                ?.templateId === batch.templateId &&
                              s.id !== submission.id,
                          )
                          .map((s) => {
                            const old = state.responses.find(
                              (r) =>
                                r.submissionId === s.id &&
                                r.questionId === questionId,
                            );
                            return old ? (
                              <p key={s.id}>
                                <button
                                  className="text-link"
                                  onClick={() =>
                                    updateQuery({
                                      response: old.id,
                                      revision: String(old.revision),
                                      observation: undefined,
                                    })
                                  }
                                >
                                  View another upload from{" "}
                                  {dateLabel(s.createdAt)}
                                </button>
                              </p>
                            ) : null;
                          })}
                    </details>
                  </>
                ) : (
                  <div className="compact-empty">
                    {requestedRevision
                      ? "The requested reading is unavailable."
                      : "This worksheet has not been analyzed yet. Run or resume analysis to see the reading."}
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <div className="compact-empty">
              {selectedSlot?.bucket === "not_received" ? (
                <>
                  <p>
                    No worksheet has been received for{" "}
                    {student?.displayName ?? "this student"}.
                  </p>
                  <Link
                    className="text-link"
                    href={`/classroom?upload=work&assignment=${encodeURIComponent(batch.templateId)}`}
                  >
                    Upload this assignment’s worksheet
                  </Link>
                </>
              ) : (
                "Select a received answer in the table to see the original work."
              )}
            </div>
          </Card>
        )}
      </section>
      <section
        id="teaching-notes"
        className="teaching-notes"
        aria-labelledby="teaching-notes-heading"
      >
        <div className="results-section-heading">
          <div>
            <h2 id="teaching-notes-heading">Teaching notes</h2>
            <p>
              Approve notes you want to use for lesson suggestions. Answer
              results alone do not approve a note.
            </p>
          </div>
          {response && !historical && !oldAttempt && (
            <Button variant="outline" size="sm" onClick={addNote}>
              <Plus />
              Add a teacher note
            </Button>
          )}
        </div>
        {!visibleFindings.length ? (
          <Card>
            <div className="compact-empty">
              {findings.length
                ? "No teaching notes are linked to the answers in these filters."
                : "Analyze the work to prepare teaching notes for your review."}
            </div>
          </Card>
        ) : (
          <>
            <div className="notes-toolbar">
              <span>
                {
                  visibleFindings.filter(
                    (f) => f.status === "confirmed" && !warningsFor(f).length,
                  ).length
                }{" "}
                approved in this view ·{" "}
                {visibleFindings.filter(reviewable).length} ready to review
              </span>
              {selectedReviewable.length > 0 && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void review(selectedReviewable, "confirm")}
                >
                  <Check />
                  Approve {selectedReviewable.length} selected
                </Button>
              )}
            </div>
            <div className="teaching-note-list">
              {visibleFindings.map((f) => (
                <Card key={f.id}>
                  <article className="teaching-note">
                    <div className="teaching-note-heading">
                      <div>
                        {reviewable(f) && (
                          <input
                            type="checkbox"
                            className="checkbox"
                            aria-label={`Select teaching note for ${state.students.find((s) => s.id === f.studentId)?.displayName}: ${findingLabels[f.code]}`}
                            checked={selectedNotes.includes(f.id)}
                            onChange={(e) =>
                              setSelectedNotes(
                                e.target.checked
                                  ? [...selectedNotes, f.id]
                                  : selectedNotes.filter((id) => id !== f.id),
                              )
                            }
                          />
                        )}
                        <h3>
                          {
                            state.students.find((s) => s.id === f.studentId)
                              ?.displayName
                          }{" "}
                          · {findingLabels[f.code]}
                        </h3>
                      </div>
                      <StatusBadge
                        status={
                          f.status === "confirmed" && warningsFor(f).length
                            ? "stale"
                            : f.status
                        }
                      />
                    </div>
                    <p>{f.explanation}</p>
                    <p className="note-next-step">
                      <strong>Next step:</strong>{" "}
                      {nextStepLabels[f.suggestedNextStep]}
                    </p>
                    <div className="note-evidence-links">
                      {f.evidence.map((ref) => {
                        const reading = selectResponseRevision(
                          state,
                          ref.responseId,
                          ref.responseRevision,
                        );
                        const sourceSubmission = state.submissions.find(
                          (s) => s.id === reading?.submissionId,
                        );
                        const sourceBatch = state.batches.find(
                          (b) => b.id === sourceSubmission?.batchId,
                        );
                        const sourceTemplate = curriculum.templates.find(
                          (t) => t.id === sourceBatch?.templateId,
                        );
                        const sourceAssignment = sourceBatch
                          ? getAssignment(sourceBatch.templateId)
                          : undefined;
                        const approvedObservation = state.observations.find(
                          (o) =>
                            o.findingId === f.id &&
                            o.findingRevision === f.revision,
                        );
                        const evidenceQuery = new URLSearchParams(
                          sourceBatch?.templateId === batch.templateId
                            ? search.toString()
                            : "",
                        );
                        evidenceQuery.delete("run");
                        [
                          "result",
                          "support",
                          "focusStudent",
                          "focusQuestion",
                        ].forEach((key) => evidenceQuery.delete(key));
                        evidenceQuery.set(
                          "student",
                          sourceSubmission?.studentId ?? f.studentId,
                        );
                        evidenceQuery.set(
                          "question",
                          reading?.questionId ?? "",
                        );
                        evidenceQuery.set("response", ref.responseId);
                        evidenceQuery.set(
                          "revision",
                          String(ref.responseRevision),
                        );
                        if (approvedObservation)
                          evidenceQuery.set(
                            "observation",
                            approvedObservation.id,
                          );
                        else evidenceQuery.delete("observation");
                        return reading && sourceSubmission ? (
                          <Link
                            className="text-link"
                            key={`${ref.responseId}-${ref.responseRevision}`}
                            href={`/review/${sourceSubmission.batchId}?${evidenceQuery}#answer-inspector`}
                            onClick={(event) => {
                              if (
                                sourceSubmission.batchId !== batchId ||
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey
                              )
                                return;
                              event.preventDefault();
                              focusInspector.current = true;
                              updateQuery({
                                student: sourceSubmission.studentId,
                                question: reading.questionId,
                                result: undefined,
                                support: undefined,
                                focusStudent: undefined,
                                focusQuestion: undefined,
                                response: ref.responseId,
                                revision: String(ref.responseRevision),
                                observation: approvedObservation?.id,
                              });
                            }}
                          >
                            {sourceBatch?.templateId !== batch.templateId
                              ? `${sourceAssignment?.title ?? "Earlier work"} · `
                              : ""}
                            View question{" "}
                            {(sourceTemplate?.questionIds.indexOf(
                              reading.questionId,
                            ) ?? -1) + 1}
                          </Link>
                        ) : null;
                      })}
                    </div>
                    {(f.limitations.length > 0 ||
                      warningsFor(f).length > 0) && (
                      <div className="note-limitations">
                        {f.limitations.map((note) => (
                          <p key={note}>{note}</p>
                        ))}
                        {warningsFor(f).map((note) => (
                          <p key={note}>{note}</p>
                        ))}
                      </div>
                    )}
                    <div className="note-actions">
                      {f.status === "candidate" && (
                        <Button
                          size="sm"
                          disabled={busy || !reviewable(f)}
                          onClick={() => void review([f], "confirm")}
                        >
                          <Check />
                          Approve note
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingFinding(f)}
                      >
                        <Edit3 />
                        Edit note
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void review([f], "reject")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </article>
                </Card>
              ))}
            </div>
          </>
        )}
        <div className="lesson-next-action">
          <div>
            <strong>{approved.length} approved teaching notes</strong>
            <p>Only approved, current evidence can support a lesson change.</p>
          </div>
          {approved.length ? (
            <Button asChild>
              <Link href={`/plans/${targetLesson}`}>
                Plan the next lesson
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button disabled>Approve notes to plan</Button>
          )}
        </div>
      </section>
      {editingResponse && (
        <TranscriptionEditor
          response={editingResponse}
          onClose={() => setEditingResponse(null)}
          advance={advanceAfterSave}
          onSaved={
            advanceAfterSave
              ? () => {
                  if (nextFlag) chooseAnswer(nextFlag);
                  else {
                    focusInspector.current = true;
                    setQueueFinished(true);
                    updateQuery({
                      result: undefined,
                      response: editingResponse.id,
                      revision: undefined,
                      observation: undefined,
                    });
                  }
                }
              : () =>
                  updateQuery({
                    response: editingResponse.id,
                    revision: undefined,
                    observation: undefined,
                  })
          }
        />
      )}
      {editingSupport && (
        <SupportEditor
          submission={editingSupport}
          onClose={() => setEditingSupport(null)}
          onSaved={() =>
            updateQuery({ revision: undefined, observation: undefined })
          }
        />
      )}
      {editingFinding && (
        <FindingEditor
          finding={editingFinding}
          onClose={() => setEditingFinding(null)}
        />
      )}
      {newFinding && (
        <FindingEditor
          isNew
          finding={newFinding}
          onClose={() => setNewFinding(null)}
        />
      )}
    </div>
  );
}
export default function ReviewPage(props: ReviewPageProps) {
  return (
    <PageGate>
      <ReviewContent {...props} />
    </PageGate>
  );
}
