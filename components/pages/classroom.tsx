"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading, EmptyState } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/upload-dialog";
import {
  AssignmentTrend,
  ResultCards,
  ResultCounts,
} from "@/components/analytics";
import { SampleLoader } from "@/components/sample-loader";
import {
  getAssignmentAnalytics,
  currentAssignmentFindings,
} from "@/lib/analytics";
import { getPlanningFindings } from "@/lib/domain";
import { assignments } from "@/lib/assignments";
import { assignmentHref } from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";
function ClassroomContent() {
  const { data } = useWorkspace();
  const search = useSearchParams();
  const router = useRouter();
  const [upload, setUpload] = useState(false);
  if (!data) return null;
  const { state } = data;
  const latest =
    [...assignments]
      .reverse()
      .find((a) => state.batches.some((b) => b.templateId === a.templateId)) ??
    assignments[0];
  const selected =
    assignments.find((a) => a.templateId === search.get("assignment")) ??
    latest;
  const analytics = getAssignmentAnalytics(state, selected.templateId);
  const { counts } = analytics;
  const notes = currentAssignmentFindings(state, selected.templateId);
  const pending = notes.filter(
    (f) => f.status === "candidate" || f.status === "stale",
  );
  const eligible = new Set(
    getPlanningFindings(
      state,
      selected.targetLessonId.replace("lesson-", ""),
    ).map((f) => f.id),
  );
  const confirmed = notes.filter(
    (f) => f.status === "confirmed" && eligible.has(f.id),
  );
  const hasWork = state.submissions.length > 0;
  return (
    <div className="page">
      <PageHeading title="Overview" description="Grade 5 · Fraction addition" />
      {!hasWork ? (
        <Card>
          <EmptyState
            title="Add student work"
            text="Upload worksheets or explore five sample assignments for eight fictional students."
            action={
              <div className="inline-actions">
                <Button onClick={() => setUpload(true)}>Upload work</Button>
                <SampleLoader />
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <div className="analytics-toolbar overview-toolbar">
            <label className="field">
              <span>Assignment</span>
              <Select
                aria-label="Assignment"
                value={selected.templateId}
                onChange={(event) =>
                  router.replace(`/classroom?assignment=${event.target.value}`)
                }
              >
                {assignments.map((a) => (
                  <option value={a.templateId} key={a.id}>
                    {a.title} · {dateLabel(a.date)}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="outline" asChild>
              <Link href={assignmentHref(state, selected.templateId)}>
                Open answers
                <ArrowRight />
              </Link>
            </Button>
            <span className="text-small muted">
              {analytics.submittedStudents} of {analytics.expectedStudents}{" "}
              worksheets received
            </span>
          </div>
          <ResultCards state={state} templateId={selected.templateId} />
          {(counts.unprocessed > 0 || counts.not_received > 0) && (
            <p className="help-note mb-16">
              {counts.unprocessed > 0
                ? `${counts.unprocessed} answers not analyzed. `
                : ""}
              {counts.not_received > 0
                ? `${counts.not_received} answers not received.`
                : ""}
            </p>
          )}
          <div className="analytics-columns">
            <Card className="analytics-panel">
              <div className="panel-head">
                <h2>Results over time</h2>
                <Link className="text-link text-small" href="/assignments">
                  All assignments
                </Link>
              </div>
              <AssignmentTrend state={state} />
            </Card>
            <Card className="analytics-panel">
              <div className="panel-head">
                <h2>Next actions</h2>
              </div>
              <ul className="action-list">
                {counts.flagged > 0 && (
                  <li>
                    <Link
                      href={assignmentHref(state, selected.templateId, {
                        result: "flagged",
                      })}
                    >
                      Check {counts.flagged} flagged{" "}
                      {counts.flagged === 1 ? "reading" : "readings"}
                      <ArrowRight size={16} />
                    </Link>
                    <p>Check the original work before using these results.</p>
                  </li>
                )}
                {counts.incorrect > 0 && (
                  <li>
                    <Link
                      href={assignmentHref(state, selected.templateId, {
                        result: "incorrect",
                      })}
                    >
                      Inspect {counts.incorrect} incorrect{" "}
                      {counts.incorrect === 1 ? "answer" : "answers"}
                      <ArrowRight size={16} />
                    </Link>
                    <p>See the working behind each answer.</p>
                  </li>
                )}
                {counts.unanswered > 0 && (
                  <li>
                    <Link
                      href={assignmentHref(state, selected.templateId, {
                        result: "unanswered",
                      })}
                    >
                      Follow up on {counts.unanswered} unanswered{" "}
                      {counts.unanswered === 1 ? "question" : "questions"}
                      <ArrowRight size={16} />
                    </Link>
                  </li>
                )}
                {pending.length > 0 && (
                  <li>
                    <Link
                      href={`${assignmentHref(state, selected.templateId)}#teaching-notes`}
                    >
                      Review {pending.length} teaching{" "}
                      {pending.length === 1 ? "note" : "notes"}
                      <ArrowRight size={16} />
                    </Link>
                    <p>Confirm or edit suggestions before planning.</p>
                  </li>
                )}
                {confirmed.length > 0 && (
                  <li>
                    <Link href={`/plans/${selected.targetLessonId}`}>
                      Plan the{" "}
                      {dateLabel(
                        selected.targetLessonId.replace("lesson-", ""),
                      )}{" "}
                      lesson
                      <ArrowRight size={16} />
                    </Link>
                    <p>
                      {confirmed.length} teacher-approved notes from this
                      assignment.
                    </p>
                  </li>
                )}
                {!counts.flagged &&
                  !counts.incorrect &&
                  !counts.unanswered &&
                  !pending.length &&
                  !confirmed.length && (
                    <li>
                      <Link href={assignmentHref(state, selected.templateId)}>
                        Review this assignment
                        <ArrowRight size={16} />
                      </Link>
                      <p>Read the work and add a teaching note.</p>
                    </li>
                  )}
              </ul>
            </Card>
          </div>
          <section className="analytics-section">
            <div className="section-heading">
              <h2>Questions in {selected.title}</h2>
            </div>
            <Card>
              <div className="table-wrap">
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col">Results</th>
                      <th scope="col">Work</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.curriculum.templates
                      .find((t) => t.id === selected.templateId)
                      ?.questionIds.map((id, index) => {
                        const question = data.curriculum.questions.find(
                          (q) => q.id === id,
                        )!;
                        const result = getAssignmentAnalytics(
                          state,
                          selected.templateId,
                          { questionId: id },
                        );
                        return (
                          <tr key={id}>
                            <th scope="row">
                              Q{index + 1}
                              <small>{question.prompt}</small>
                            </th>
                            <td>
                              <ResultCounts
                                counts={result.counts}
                                href={(bucket) =>
                                  assignmentHref(state, selected.templateId, {
                                    question: id,
                                    result: bucket,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <Link
                                className="text-link text-small"
                                href={assignmentHref(
                                  state,
                                  selected.templateId,
                                  { question: id },
                                )}
                              >
                                See answers
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}
      {(upload || search.get("upload") === "work") && (
        <UploadDialog
          initialTemplateId={search.get("assignment") ?? undefined}
          onClose={(navigated) => {
            setUpload(false);
            if (!navigated && search.get("upload"))
              router.replace("/classroom");
          }}
        />
      )}
    </div>
  );
}
export default function ClassroomPage() {
  return (
    <PageGate>
      <Suspense fallback={null}>
        <ClassroomContent />
      </Suspense>
    </PageGate>
  );
}
