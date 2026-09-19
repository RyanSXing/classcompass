"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Edit3,
  Sparkles,
  Printer,
  CalendarDays,
  RefreshCw,
  Link2,
  UsersRound,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import {
  PageGate,
  PageHeading,
  EmptyState,
  Banner,
  Modal,
  StatusBadge,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Textarea, Select } from "@/components/ui/input";
import { JobProgress } from "@/components/job-progress";
import { EvidenceView } from "@/components/evidence-view";
import type { LessonBlock, Proposal, ProposalChange } from "@/lib/contracts";
import { dateLabel } from "@/lib/utils";

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
              .join(", ") || "No students in this lane"}
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
      title="Make this change your own"
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
            Save draft edits
          </Button>
        </>
      }
    >
      <div className="form-stack">
        {error && <Banner tone="error">{error}</Banner>}
        <Banner>
          The total stays at 45 minutes. Each student needs exactly one
          activity, with only one teacher-led lane.
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
              <span>Block title</span>
              <Input
                aria-label="Block title"
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
              <span>Block instructions</span>
              <Textarea
                aria-label="Block instructions"
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
function PlanContent({ lessonId }: { lessonId: string }) {
  const { data, mutate, notify } = useWorkspace();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [selectionFor, setSelectionFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [editing, setEditing] = useState<ProposalChange | null>(null);
  const [versionId, setVersionId] = useState("");
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
          text="Import a lesson from your classroom to start planning."
          action={
            <Button asChild>
              <Link href="/classroom">Back to classroom</Link>
            </Button>
          }
        />
      </div>
    );
  const versions = state.planVersions.filter((v) => v.lessonId === lessonId);
  const currentVersion = versions.find((v) => v.id === plan.currentVersionId)!;
  const version = versions.find((v) => v.id === versionId) ?? currentVersion;
  const historical = version.id !== currentVersion.id;
  const proposal = [...state.proposals]
    .reverse()
    .find(
      (p) => p.lessonId === lessonId && ["draft", "stale"].includes(p.status),
    );
  const fresh =
    proposal?.status === "draft" &&
    proposal.evidenceRevision === state.classroom.evidenceRevision &&
    proposal.calendarRevision === state.classroom.calendarRevision &&
    proposal.basePlanVersionId === plan.currentVersionId;
  const job = [...state.jobs]
    .reverse()
    .find((j) => j.lessonId === lessonId && j.type === "proposal");
  const selectedIds =
    selected && selectionFor === proposal?.id
      ? selected
      : (proposal?.changes.map((c) => c.id) ?? []);
  const confirmed = state.findings.filter((f) => f.status === "confirmed");
  const references = proposal
    ? [...new Set(proposal.changes.flatMap((c) => c.findingIds))]
    : [];
  const sourceFindings = references
    .map((id) => state.findings.find((f) => f.id === id))
    .filter((f) => !!f);
  const sourceFinding =
    sourceFindings.find((f) =>
      f.evidence.some((ref) => ref.responseId === evidenceId),
    ) ?? sourceFindings[0];
  const chosenEvidence = state.responses.find(
    (r) => r.id === (evidenceId || sourceFinding?.evidence[0]?.responseId),
  );
  const total = version.snapshot.blocks.reduce((n, b) => n + b.minutes, 0);
  async function generate() {
    setBusy(true);
    setError("");
    setRefreshConfirm(false);
    try {
      await mutate(`/api/plans/${plan!.id}/proposals`, {
        basePlanVersionId: plan!.currentVersionId,
        expectedEvidenceRevision: state.classroom.evidenceRevision,
        expectedCalendarRevision: state.classroom.calendarRevision,
      });
      setSelected(null);
      setAutoRun(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to generate a proposal.",
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
      setSelected(null);
      notify(
        "Your lesson changes are saved. Materials and calendar are ready.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This proposal could not be applied.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <PageHeading
        title={plan.title}
        description={`${dateLabel(plan.date, { weekday: "long", month: "long", day: "numeric" })} · Add unlike fractions using a common unit`}
        breadcrumb="Lesson plan"
      >
        <Badge tone="violet">
          <Clock3 />
          {total} minutes
        </Badge>
        <Select
          aria-label="Saved lesson version"
          value={version.id}
          onChange={(e) => setVersionId(e.target.value)}
          style={{ width: "auto", minWidth: 130 }}
        >
          {[...versions].reverse().map((v) => (
            <option value={v.id} key={v.id}>
              Saved version {v.versionNumber}
            </option>
          ))}
        </Select>
      </PageHeading>
      {error && (
        <div className="mb-16">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
      {historical && (
        <div className="mb-16">
          <Banner>
            You’re viewing a previous saved version.{" "}
            <button
              className="text-link"
              style={{ border: 0, background: "none" }}
              onClick={() => setVersionId("")}
            >
              Return to the current lesson
            </button>{" "}
            to make changes.
          </Banner>
        </div>
      )}
      <div className="timeline">
        {version.snapshot.blocks.map((block) => (
          <div
            key={block.id}
            className={`timeline-block ${block.id === "practice" ? "active" : ""}`}
            style={{ flex: block.minutes }}
          >
            <strong>{block.title}</strong>
            <small>{block.minutes} minutes</small>
          </div>
        ))}
      </div>
      {job && job.status !== "completed" && !historical && (
        <JobProgress job={job} autoStart={autoRun} />
      )}{" "}
      {!historical && proposal && !fresh && (
        <div className="mb-16">
          <Banner tone="warning">
            <strong>This draft needs a refresh.</strong> Student evidence, the
            calendar, or the saved plan changed. Reconfirm affected findings,
            then refresh the proposal. Your saved lesson hasn’t changed.
          </Banner>
        </div>
      )}
      {!historical && proposal ? (
        <>
          <div className="section-title">
            <h2>Small changes. A more useful lesson.</h2>
            <div className="inline-actions">
              <Badge tone={fresh ? "amber" : "red"}>
                {fresh ? "Draft · Your decision" : "Stale draft"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  proposal.teacherEdited
                    ? setRefreshConfirm(true)
                    : void generate()
                }
              >
                <RefreshCw />
                Refresh proposal
              </Button>
            </div>
          </div>
          <div className="lesson-grid">
            <aside className="lesson-evidence">
              <div className="section-title" style={{ marginTop: 0 }}>
                <h3>Why these changes?</h3>
                <Link2 size={17} color="#967aaf" />
              </div>
              <Select
                aria-label="Choose evidence student"
                value={sourceFinding?.id ?? ""}
                onChange={(e) =>
                  setEvidenceId(
                    sourceFindings.find((f) => f.id === e.target.value)
                      ?.evidence[0]?.responseId ?? "",
                  )
                }
                style={{ marginBottom: 14 }}
              >
                {sourceFindings.map((f) => (
                  <option key={f.id} value={f.id}>
                    {
                      state.students.find((s) => s.id === f.studentId)
                        ?.displayName
                    }{" "}
                    · Confirmed evidence
                  </option>
                ))}
              </Select>
              {chosenEvidence && (
                <div style={{ marginBottom: 14 }}>
                  <EvidenceView
                    compact
                    submissionId={chosenEvidence.submissionId}
                    questionId={chosenEvidence.questionId}
                  />
                </div>
              )}
              <div className="evidence-list">
                {(sourceFinding ? [sourceFinding] : []).map((f) => (
                  <div className="evidence-summary" key={f.id}>
                    <div
                      className="inline-actions"
                      style={{
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <h4>
                        {
                          state.students.find((s) => s.id === f.studentId)
                            ?.displayName
                        }
                      </h4>
                      <StatusBadge status={f.status} />
                    </div>
                    <p>{f.explanation}</p>
                    <div className="inline-actions" style={{ marginTop: 10 }}>
                      {f.evidence.slice(0, 4).map((ref) => {
                        const r = state.responses.find(
                          (x) => x.id === ref.responseId,
                        );
                        return r ? (
                          <button
                            className="question-button"
                            key={r.id}
                            onClick={() => setEvidenceId(r.id)}
                            aria-label={`Inspect ${r.questionId} for ${state.students.find((s) => s.id === f.studentId)?.displayName}`}
                          >{`Q${Number(r.questionId.replace("q-", "").replace("fq", ""))}`}</button>
                        ) : null;
                      })}
                    </div>
                    <Link className="text-link" href={`/review/${f.batchId}`}>
                      Review original evidence →
                    </Link>
                  </div>
                ))}
              </div>
            </aside>
            <div>
              {proposal.changes.map((change) => {
                const chosen = selectedIds.includes(change.id);
                const old =
                  change.operation === "schedule_checkpoint"
                    ? null
                    : version.snapshot.blocks.find(
                        (b) => b.id === change.payload.block.id,
                      );
                return (
                  <article
                    className={`change-card ${chosen ? "selected" : ""}`}
                    key={change.id}
                  >
                    <div className="change-header">
                      <label>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={chosen}
                          onChange={(e) => {
                            setSelectionFor(proposal.id);
                            setSelected(
                              e.target.checked
                                ? [...selectedIds, change.id]
                                : selectedIds.filter((id) => id !== change.id),
                            );
                          }}
                        />
                        <h3>
                          {change.operation === "replace_practice"
                            ? "Differentiate the practice"
                            : change.operation === "replace_exit"
                              ? "Check the next small step"
                              : "Schedule a fresh check"}
                        </h3>
                      </label>
                      <Badge tone="violet">
                        {change.operation === "schedule_checkpoint"
                          ? change.payload.minutes
                          : change.payload.block.minutes}{" "}
                        min
                      </Badge>
                    </div>
                    <div className="change-body">
                      {change.operation === "schedule_checkpoint" ? (
                        <>
                          <p className="text-small">
                            <strong>{change.payload.title}</strong> ·{" "}
                            {dateLabel(
                              state.calendarEntries.find(
                                (c) => c.id === change.payload.calendarEntryId,
                              )?.date ?? "2026-09-24",
                            )}
                          </p>
                          <div className="before-after">
                            <div className="comparison-pane">
                              <h4>Before</h4>
                              <p>
                                A 45-minute lesson follows the planned sequence.
                              </p>
                            </div>
                            <div className="comparison-pane after">
                              <h4>After</h4>
                              <p>
                                Use {change.payload.minutes} minutes within the
                                existing session for fresh independent evidence.
                                Keep {45 - change.payload.minutes} minutes for
                                the planned teaching.
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className="before-after"
                            style={{ marginTop: 0 }}
                          >
                            <div className="comparison-pane">
                              <h4>Before · Saved lesson</h4>
                              <p>{old?.instructions}</p>
                            </div>
                            <div className="comparison-pane after">
                              <h4>After · Proposed</h4>
                              <p>{change.payload.block.instructions}</p>
                            </div>
                          </div>
                          {change.operation === "replace_practice" && (
                            <>
                              <div className="inline-actions mt-16">
                                <UsersRound size={18} color="#6b3db8" />
                                <strong className="text-small">
                                  One 12-minute block. Three concurrent
                                  activities.
                                </strong>
                              </div>
                              <Lanes block={change.payload.block} />
                            </>
                          )}
                        </>
                      )}
                      <p className="change-rationale">
                        <strong>Why:</strong> {change.rationale}
                      </p>
                      {change.dependsOnChangeIds.length > 0 && (
                        <p className="finding-limit">
                          Apply with:{" "}
                          {change.dependsOnChangeIds
                            .map((id) =>
                              proposal.changes
                                .find((c) => c.id === id)
                                ?.operation.replaceAll("_", " "),
                            )
                            .join(", ")}
                          .
                        </p>
                      )}
                      <div className="inline-actions mt-16">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(change)}
                        >
                          <Edit3 />
                          Edit change
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectionFor(proposal.id);
                            setSelected(
                              selectedIds.filter((id) => id !== change.id),
                            );
                          }}
                        >
                          Keep original
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="sticky-actions">
            <div>
              <strong>
                {selectedIds.length} change{selectedIds.length === 1 ? "" : "s"}{" "}
                selected · Still 45 minutes
              </strong>
              <p>Only your selected changes become part of the saved lesson.</p>
            </div>
            <div className="inline-actions">
              <Button variant="outline" asChild>
                <Link href={`/calendar?proposal=${proposal.id}`}>
                  <CalendarDays />
                  Preview calendar
                </Link>
              </Button>
              {selectedIds.length ? (
                <Button disabled={!fresh || busy} onClick={() => void apply()}>
                  <Check />
                  Apply selected changes
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={async () => {
                    await mutate(`/api/proposals/${proposal.id}/apply`, {
                      expectedRevision: proposal.revision,
                      basePlanVersionId: proposal.basePlanVersionId,
                      expectedEvidenceRevision:
                        state.classroom.evidenceRevision,
                      expectedCalendarRevision:
                        state.classroom.calendarRevision,
                      selectedChangeIds: [],
                    });
                    notify(
                      "Original lesson kept. The draft is saved in history.",
                    );
                  }}
                >
                  Keep the original lesson
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <Card>
            <div
              className="card-content"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div>
                <Badge tone="green">
                  <Check />
                  Saved version {version.versionNumber}
                </Badge>
                <h2 style={{ marginTop: 13, fontSize: 22 }}>
                  {version.proposalId
                    ? "Your evidence. Your updated lesson."
                    : "A good plan starts here."}
                </h2>
                <p
                  className="muted text-small"
                  style={{ marginTop: 8, maxWidth: 620 }}
                >
                  {version.proposalId
                    ? "Every accepted change is preserved with its evidence. Print the materials and see where the next check fits."
                    : "Review student work, then use the evidence you confirm to suggest a focused adjustment. Nothing changes without your decision."}
                </p>
              </div>
              {!historical && (
                <Button
                  disabled={
                    busy ||
                    !confirmed.length ||
                    (!!job &&
                      !["completed", "failed", "cancelled", "blocked"].includes(
                        job.status,
                      ))
                  }
                  onClick={() => void generate()}
                >
                  <Sparkles />
                  {version.proposalId
                    ? "Suggest next adjustments"
                    : "Suggest lesson changes"}
                </Button>
              )}
            </div>
            {!confirmed.length && !historical && (
              <div style={{ padding: "0 24px 24px" }}>
                <Banner>
                  Start by confirming student findings.{" "}
                  <Link
                    className="text-link"
                    href={
                      state.batches.at(-1)
                        ? `/review/${state.batches.at(-1)!.id}`
                        : "/classroom"
                    }
                  >
                    Open student evidence →
                  </Link>
                </Banner>
              </div>
            )}
          </Card>
          <div className="section-title">
            <h2>
              {historical ? "Historical saved lesson" : "Your saved lesson"}
            </h2>
            {state.materialSets.some((m) => m.planVersionId === version.id) && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/materials/${version.id}`}>
                  <Printer />
                  Open materials
                </Link>
              </Button>
            )}
          </div>
          <Card>
            {version.snapshot.blocks.map((block) => (
              <div className="saved-block" key={block.id}>
                <div className="saved-block-header">
                  <h3>{block.title}</h3>
                  <Badge>{block.minutes} min</Badge>
                </div>
                <p>{block.instructions}</p>
                {block.lanes && <Lanes block={block} />}
              </div>
            ))}
          </Card>
          <div className="inline-actions mt-24">
            <Button variant="outline" asChild>
              <Link href="/calendar">
                <CalendarDays />
                View the unit calendar
              </Link>
            </Button>
            {state.materialSets.some((m) => m.planVersionId === version.id) && (
              <Button asChild>
                <Link href={`/materials/${version.id}`}>
                  <Printer />
                  Get teaching materials
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </>
      )}
      {editing && proposal && (
        <ChangeEditor
          proposal={proposal}
          change={editing}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {refreshConfirm && (
        <Modal
          title="Refresh this edited draft?"
          onClose={() => setRefreshConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRefreshConfirm(false)}>
                Keep editing this draft
              </Button>
              <Button onClick={() => void generate()}>
                Create a fresh proposal
              </Button>
            </>
          }
        >
          <p>
            Your teacher edits remain in this draft’s history. A fresh proposal
            uses current evidence and starts with newly suggested wording. You
            can reapply any edits afterward.
          </p>
        </Modal>
      )}
    </div>
  );
}
export default function PlanPage({ lessonId }: { lessonId: string }) {
  return (
    <PageGate>
      <PlanContent lessonId={lessonId} />
    </PageGate>
  );
}
