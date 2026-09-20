"use client";
import { StudentAvatar } from "@/components/student-avatar";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, EmptyState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import {
  AssignmentTrend,
  ResultCounts,
  resultLabels,
  resultOrder,
} from "@/components/analytics";
import { getPlanningFindings } from "@/lib/domain";
import { assignments, getAssignment } from "@/lib/assignments";
import {
  getAssignmentAnalytics,
  selectResponseRevision,
  type ResultBucket,
} from "@/lib/analytics";
import {
  assignmentHref,
  supportLabels,
  nextStepLabels,
} from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";
import { StudentLearning } from "@/components/student-learning";
import type {
  Observation,
  ObservationStatus,
  SupportContext,
} from "@/lib/contracts";
const statusLabels: Record<ObservationStatus, string> = {
  independent: "Demonstrated independently",
  supported: "Demonstrated with help",
  not_demonstrated: "Needs practice",
  insufficient: "More evidence needed",
  unknown_support: "Help not recorded",
};
function StudentContent({ studentId }: { studentId: string }) {
  const { data } = useWorkspace();
  const search = useSearchParams();
  if (!data) return null;
  const { state, curriculum } = data;
  const student = state.students.find((s) => s.id === studentId);
  if (!student)
    return (
      <div className="page">
        <EmptyState
          title="Student not found"
          text="Choose a student from the student list."
          action={
            <Link className="text-link" href="/students">
              Students
            </Link>
          }
        />
      </div>
    );
  const current = getPlanningFindings(state, "9999-12-31").filter(
    (f) => f.studentId === studentId,
  );
  const latestWork = assignments
    .filter((assignment) =>
      state.submissions.some(
        (submission) =>
          submission.studentId === studentId &&
          state.batches.some(
            (batch) =>
              batch.id === submission.batchId &&
              batch.templateId === assignment.templateId,
          ),
      ),
    )
    .at(-1);
  const currentIds = new Set(current.map((f) => f.id));
  const observations = state.observations
    .filter((o) => o.studentId === studentId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const currentObservations = observations.filter(
    (o) =>
      !o.superseded &&
      currentIds.has(o.findingId) &&
      current.some(
        (f) => f.id === o.findingId && f.revision === o.findingRevision,
      ),
  );
  const history = observations.filter((o) => !currentObservations.includes(o));
  const result = (
    resultOrder.includes(search.get("result") as ResultBucket)
      ? search.get("result")
      : "all"
  ) as ResultBucket | "all";
  const support = (
    ["independent", "supported", "unknown"].includes(
      search.get("support") ?? "",
    )
      ? search.get("support")
      : "all"
  ) as SupportContext["level"] | "all";
  const chosen = search.get("assignment") ?? "all";
  function filter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete(key);
    else params.set(key, value);
    window.history.replaceState(null, "", `/students/${studentId}?${params}`);
  }
  function observationCard(o: Observation, old = false) {
    return (
      <Card className="observation-row" key={o.id}>
        <div className="inline-actions">
          <Badge
            tone={
              old
                ? "neutral"
                : o.observationStatus === "independent"
                  ? "green"
                  : "amber"
            }
          >
            {statusLabels[o.observationStatus]}
          </Badge>
          <span className="text-small muted">
            {dateLabel(o.date)} ·{" "}
            {getAssignment(o.templateId)?.title ?? "Assignment"}
          </span>
        </div>
        <p>{o.interpretation}</p>
        <div className="help-note">
          {
            curriculum.objectives.find((obj) => obj.id === o.objectiveId)
              ?.description
          }{" "}
          ·{" "}
          {o.difficulty === "core"
            ? "Core task"
            : o.difficulty === "core-transfer"
              ? "Apply in context"
              : o.difficulty === "extension"
                ? "Extension task"
                : o.difficulty}
        </div>
        <div className="help-note">
          {o.supportSnapshots
            .map((s) => supportLabels[s.support.level])
            .join(" · ")}
        </div>
        {!old && (
          <p>
            <strong>Next:</strong>{" "}
            {nextStepLabels[o.suggestedNextStep] ?? o.suggestedNextStep}
          </p>
        )}
        <div className="result-counts">
          {o.evidence.map((ref, index) => {
            const reading = selectResponseRevision(
              state,
              ref.responseId,
              ref.responseRevision,
            );
            const sub = state.submissions.find(
              (s) => s.id === reading?.submissionId,
            );
            return sub ? (
              <Link
                key={`${ref.responseId}:${ref.responseRevision}`}
                className="text-link text-small"
                href={`/review/${sub.batchId}?student=${studentId}&response=${ref.responseId}&revision=${ref.responseRevision}&observation=${o.id}`}
              >
                Answer {index + 1}
                {old ? ` · review ${ref.responseRevision}` : ""}
              </Link>
            ) : null;
          })}
        </div>
        {old && o.supersededReason && (
          <p className="help-note">{o.supersededReason}</p>
        )}
      </Card>
    );
  }
  return (
    <div className="page">
      <div className="breadcrumb">
        <Link href="/students">Students</Link>
        <span>›</span>
        <span>{student.displayName}</span>
      </div>
      <div className="page-heading">
        <div className="student-title">
          <StudentAvatar studentId={student.id} size={56} />
          <div>
            <h1>{student.displayName}</h1>
            <p>Grade 5 · Fraction addition</p>
          </div>
        </div>
      </div>
      <StudentLearning state={state} studentId={studentId} templateId={
        assignments.find(item => item.templateId === chosen)?.templateId ?? latestWork?.templateId ?? assignments[0].templateId
      } />
      <div>
        <Card className="analytics-panel">
          <div className="panel-head">
            <h2>Next steps</h2>
          </div>
          {current.length ? (
            <ul className="action-list">
              {current.map((f) => {
                const batch = state.batches.find((b) => b.id === f.batchId)!;
                return (
                  <li key={f.id}>
                    <Link
                      href={`/review/${batch.id}?student=${studentId}#teaching-notes`}
                    >
                      {nextStepLabels[f.suggestedNextStep]}
                    </Link>
                    <p>
                      {dateLabel(batch.activityDate)} ·{" "}
                      {getAssignment(batch.templateId)?.title}
                    </p>
                    <details className="student-work-details"><summary>Why this step</summary><p>{f.explanation}</p></details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>
              <p className="text-small muted">
                {latestWork
                  ? "Review the latest work to add a next step."
                  : "Upload work to get started."}
              </p>
              <Link
                className="text-link"
                href={
                  latestWork
                    ? `${assignmentHref(state, latestWork.templateId, { student: studentId })}#teaching-notes`
                    : "/classroom?upload=work"
                }
              >
                {latestWork ? "Review latest work" : "Upload work"}
              </Link>
            </div>
          )}
        </Card>
      </div>
      <details className="evidence-explorer" open={search.has("result") || search.has("support") || search.has("assignment") || search.get("evidence") === "open"}>
        <summary><span>Assignment results</span><small>Answers, help and totals</small></summary>
        <details className="student-work-details"><summary>Answer totals over time</summary><AssignmentTrend state={state} studentId={studentId} /></details>
        <div className="analytics-toolbar">
          <label className="field">
            <span>Assignment</span>
            <Select
              aria-label="Assignment"
              value={chosen}
              onChange={(e) => filter("assignment", e.target.value)}
            >
              <option value="all">All assignments</option>
              {assignments.map((a) => (
                <option value={a.templateId} key={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>Answer result</span>
            <Select
              aria-label="Answer result"
              value={result}
              onChange={(e) => filter("result", e.target.value)}
            >
              <option value="all">All results</option>
              {resultOrder.map((r) => (
                <option key={r} value={r}>
                  {resultLabels[r]}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>Help given</span>
            <Select
              aria-label="Help given"
              value={support}
              onChange={(e) => filter("support", e.target.value)}
            >
              <option value="all">Any help</option>
              {Object.entries(supportLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <Card>
          <div className="table-wrap">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th scope="col">Assignment</th>
                  <th scope="col">Results</th>
                  <th scope="col">Help given</th>
                  <th scope="col">Answers</th>
                </tr>
              </thead>
              <tbody>
                {assignments
                  .filter((a) => chosen === "all" || a.templateId === chosen)
                  .map((a) => {
                    const stats = getAssignmentAnalytics(state, a.templateId, {
                      studentId,
                      result,
                      support,
                    });
                    if (!stats.slots.length) return null;
                    return (
                      <tr key={a.id}>
                        <th scope="row">
                          {a.title}
                          <small>{dateLabel(a.date)}</small>
                        </th>
                        <td>
                          <ResultCounts
                            counts={stats.counts}
                            href={(bucket) =>
                              assignmentHref(state, a.templateId, {
                                student: studentId,
                                result: bucket,
                                support:
                                  support === "all" ? undefined : support,
                              })
                            }
                          />
                        </td>
                        <td>
                          {[
                            ...new Set(
                              stats.slots
                                .filter((s) => s.submission)
                                .map((s) => supportLabels[s.supportLevel]),
                            ),
                          ].join(" · ") || "—"}
                        </td>
                        <td>
                          <Link
                            className="text-link text-small"
                            href={assignmentHref(state, a.templateId, {
                              student: studentId,
                              result: result === "all" ? undefined : result,
                              support: support === "all" ? undefined : support,
                            })}
                          >
                            See work
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!assignments.some(
            (a) =>
              (chosen === "all" || a.templateId === chosen) &&
              getAssignmentAnalytics(state, a.templateId, {
                studentId,
                result,
                support,
              }).slots.length > 0,
          ) && (
            <div className="compact-empty">
              <p>No answers match these filters.</p>
              <button
                className="text-link"
                onClick={() => {
                  window.history.replaceState(
                    null,
                    "",
                    `/students/${studentId}?evidence=open`,
                  );
                }}
              >
                Clear result filters
              </button>
            </div>
          )}
        </Card>
      </details>
      <section className="analytics-section">
        <div className="section-heading">
          <h2>Teacher-reviewed evidence</h2>
        </div>
        <div className="observation-list">
          {currentObservations.length ? (
            currentObservations.map((o) => observationCard(o))
          ) : (
            <p className="empty-inline">
              No current reviewed evidence. Earlier reviews remain below.
            </p>
          )}
        </div>
      </section>
      {history.length > 0 && (
        <details className="history-details">
          <summary>Earlier reviews ({history.length})</summary>
          <div className="observation-list">
            {history.map((o) => observationCard(o, true))}
          </div>
        </details>
      )}
    </div>
  );
}
export default function StudentPage({ studentId }: { studentId: string }) {
  return (
    <PageGate>
      <Suspense fallback={null}>
        <StudentContent studentId={studentId} />
      </Suspense>
    </PageGate>
  );
}
