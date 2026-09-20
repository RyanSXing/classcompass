"use client";
import Link from "next/link";
import { ArrowRight, BarChart3, Grid2X2, ListChecks } from "lucide-react";
import type { AppState } from "@/lib/contracts";
import {
  compareAssignments,
  getAssignmentInsights,
  getStudentAssignmentMatrix,
} from "@/lib/insights";
import { assignmentHref, supportLabels } from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";
import {
  ResultCards,
  ResultCounts,
  resultLabels,
  resultOrder,
} from "./analytics";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Select } from "./ui/input";
import { assignments } from "@/lib/assignments";

export type AnalyticsView = "class" | "students" | "questions";
const views = [
  { id: "class", label: "Results", icon: BarChart3 },
  { id: "students", label: "Students", icon: Grid2X2 },
  { id: "questions", label: "Questions", icon: ListChecks },
] as const;

function Comparison({
  state,
  templateId,
  previousTemplateId,
  onComparisonChange,
}: {
  state: AppState;
  templateId: string;
  previousTemplateId?: string;
  onComparisonChange: (templateId: string) => void;
}) {
  const comparison = compareAssignments(state, templateId, previousTemplateId);
  if (!comparison)
    return (
      <div className="comparison-empty">
        <h3>Starting point</h3>
        <p>
          This is the first available assignment. Add follow-up work to see each
          student’s next observation.
        </p>
      </div>
    );
  const names = (ids: string[]) =>
    ids
      .map(
        (id) =>
          state.students.find((student) => student.id === id)?.displayName,
      )
      .join(", ");
  const eligible = comparison.independentStudentIds.length > 0;
  return (
    <article className="comparison-summary">
      <div>
        <label className="field comparison-chooser">
          <span>Compare with</span>
          <Select
            aria-label="Compare with"
            value={comparison.previous.templateId}
            onChange={(event) => onComparisonChange(event.target.value)}
          >
            {assignments
              .filter(
                (assignment) =>
                  assignment.sequence < comparison.current.sequence &&
                  state.batches.some(
                    (batch) => batch.templateId === assignment.templateId,
                  ),
              )
              .map((assignment) => (
                <option key={assignment.id} value={assignment.templateId}>
                  {assignment.title} · {dateLabel(assignment.date)}
                </option>
              ))}
          </Select>
        </label>
        <span className="intelligence-eyebrow">
          Compared with {comparison.previous.title}
        </span>
        <h3>
          {eligible
            ? "Independent calculations, side by side"
            : "No independent calculations to compare"}
        </h3>
        <p>
          {eligible
            ? `${comparison.independentStudentIds.length} students completed clear calculation answers without help in both assignments.`
            : "Choose another assignment to compare calculation answers completed without help."}
        </p>
      </div>
      {eligible && (
        <div className="paired-scores">
          {(["previous", "current"] as const).map((period) => (
            <div key={period}>
              <span>{comparison[period].title}</span>
              <strong>
                {comparison.pairedCore[period].correct}
                <small> / {comparison.pairedCore[period].usable}</small>
              </strong>
              <small>correct calculations · same students</small>
            </div>
          ))}
          <ArrowRight size={19} aria-hidden="true" />
        </div>
      )}
      <div className="comparison-caveats">
        {eligible && (
          <p>
            <strong>Students included:</strong>{" "}
            {comparison.independentStudentIds.map((id, index) => (
              <span key={id}>
                {index > 0 ? ", " : ""}
                <Link className="text-link" href={`/students/${id}`}>
                  {
                    state.students.find((student) => student.id === id)
                      ?.displayName
                  }
                </Link>
              </span>
            ))}
          </p>
        )}
        <p>
          <strong>Questions:</strong> {comparison.previousMix.core} calculations
          + {comparison.previousMix.transfer} word problems →{" "}
          {comparison.currentMix.core} calculations +{" "}
          {comparison.currentMix.transfer} word problems.
          {(comparison.previousMix.other > 0 ||
            comparison.currentMix.other > 0) &&
            ` Other question types: ${comparison.previousMix.other} → ${comparison.currentMix.other}.`}
          {comparison.taskMixChanged ? " The task mix or focus changed." : ""}
        </p>
        {comparison.supportChangedStudentIds.length > 0 && (
          <p>
            <strong>Help changed:</strong>{" "}
            {names(comparison.supportChangedStudentIds)}. They are excluded from
            the independent comparison.
          </p>
        )}
        <p>{comparison.limitation}</p>
      </div>
    </article>
  );
}

function ClassResults({
  state,
  templateId,
  insights,
  comparisonTemplateId,
  onComparisonChange,
}: {
  state: AppState;
  templateId: string;
  insights: ReturnType<typeof getAssignmentInsights>;
  comparisonTemplateId?: string;
  onComparisonChange: (templateId: string) => void;
}) {
  const { counts } = insights.analytics;
  const supportCounts = { independent: 0, supported: 0, unknown: 0 };
  const received = new Set<string>();
  for (const slot of insights.analytics.allSlots)
    if (slot.submission && !received.has(slot.studentId)) {
      received.add(slot.studentId);
      supportCounts[slot.supportLevel]++;
    }
  return (
    <>
      <ResultCards state={state} templateId={templateId} />
      {(counts.unprocessed > 0 || counts.not_received > 0) && (
        <p className="analysis-coverage">
          {counts.unprocessed} answers not analyzed · {counts.not_received} not
          received. They are excluded from the usable-result total.
        </p>
      )}
      <div className="class-analysis-grid">
        <Card className="answer-quality">
          <div className="quality-score">
            <div>
              <span>Correct answers</span>
              <strong>
                {counts.correct} <small>of {counts.total}</small>
              </strong>
              <p>questions across the class</p>
            </div>
            <p className="quality-definition">
              All questions stay in view. Incorrect answers, reading flags, and
              missing answers are counted separately.
            </p>
          </div>
          <div className="question-score-list">
            {insights.questions.map((item) => (
              <Link
                key={item.question.id}
                href={assignmentHref(state, templateId, {
                  question: item.question.id,
                })}
              >
                <span className="question-score-number">Q{item.number}</span>
                <div>
                  <div className="question-score-label">
                    <span>
                      {item.question.taskDifficulty === "core"
                        ? "Calculation"
                        : "Apply in context"}
                    </span>
                    <b>
                      {item.counts.correct} / {item.counts.total}{" "}
                      <small>correct</small>
                    </b>
                  </div>
                  <div className="question-score-track" aria-hidden="true">
                    {resultOrder
                      .filter((result) => item.counts[result] > 0)
                      .map((result) => (
                        <span
                          key={result}
                          className={`question-segment-${result}`}
                          style={{
                            width: `${(item.counts[result] / Math.max(1, item.counts.total)) * 100}%`,
                          }}
                        />
                      ))}
                  </div>
                  <small className="question-score-breakdown">
                    {resultOrder
                      .filter(
                        (result) =>
                          result !== "correct" && item.counts[result] > 0,
                      )
                      .map(
                        (result) =>
                          `${item.counts[result]} ${resultLabels[result].toLowerCase()}`,
                      )
                      .join(" · ") || "All answers correct"}
                  </small>
                </div>
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </Card>
        <Card className="help-analysis">
          <h3>Support</h3>
          <p>
            Support is a separate part of the evidence, not a change to
            correctness.
          </p>
          <div className="help-cohorts">
            {(
              Object.keys(supportCounts) as Array<keyof typeof supportCounts>
            ).map((level) => (
              <div className="help-cohort" key={level}>
                <div>
                  <span>{supportLabels[level]}</span>
                  <strong>
                    {supportCounts[level]} <small>students</small>
                  </strong>
                </div>
                <p>
                  {state.students
                    .filter(
                      (student) =>
                        received.has(student.id) &&
                        insights.analytics.allSlots.find(
                          (slot) => slot.studentId === student.id,
                        )?.supportLevel === level,
                    )
                    .map((student, index) => (
                      <span key={student.id}>
                        {index > 0 ? ", " : ""}
                        <Link
                          href={assignmentHref(state, templateId, {
                            student: student.id,
                            support: level,
                          })}
                        >
                          {student.displayName}
                        </Link>
                      </span>
                    ))}
                </p>
              </div>
            ))}
          </div>
          <div className="approval-summary">
            <strong>
              {insights.confirmedNotes} approved teaching note
              {insights.confirmedNotes === 1 ? "" : "s"} for this assignment
            </strong>
            <p>
              {insights.pendingNotes} teaching notes still need review or
              updating.
            </p>
            <Link
              className="text-link"
              href={`${assignmentHref(state, templateId)}#teaching-notes`}
            >
              Review teaching notes <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
      </div>
      <Comparison
        state={state}
        templateId={templateId}
        previousTemplateId={comparisonTemplateId}
        onComparisonChange={onComparisonChange}
      />
    </>
  );
}

function StudentMatrix({
  state,
  templateId,
}: {
  state: AppState;
  templateId: string;
}) {
  const matrix = getStudentAssignmentMatrix(state);
  return (
    <Card className="student-matrix-card">
      <div className="analysis-explanation">
        <h3>Student progress</h3>
        <p>
          Each cell shows <strong>correct / all questions</strong>. Missing
          answers, reading flags, and help remain visible. Select a result to
          inspect the work.
        </p>
      </div>
      <div
        className="matrix-scroll"
        tabIndex={0}
        role="region"
        aria-label="Student results across assignments"
      >
        <table className="student-assignment-matrix">
          <caption className="sr-only">
            Dated student results by assignment. Scores are not mastery ratings;
            tasks and help may differ.
          </caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              {matrix.assignments.map((assignment) => (
                <th
                  scope="col"
                  key={assignment.id}
                  className={
                    assignment.templateId === templateId
                      ? "matrix-selected-column"
                      : ""
                  }
                >
                  <Link href={assignmentHref(state, assignment.templateId)}>
                    {assignment.title}
                  </Link>
                  <small>{dateLabel(assignment.date)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.students.map(({ student, cells }) => (
              <tr key={student.id}>
                <th scope="row">
                  <Link href={`/students/${student.id}`}>
                    {student.displayName}
                  </Link>
                </th>
                {cells.map((cell) => (
                  <td
                    key={cell.assignment.id}
                    className={
                      cell.assignment.templateId === templateId
                        ? "matrix-selected-column"
                        : ""
                    }
                  >
                    <div
                      className={`matrix-cell matrix-${cell.counts.usable === 0 ? "empty" : cell.counts.correct === cell.counts.total ? "secure" : cell.counts.correct === 0 ? "support" : "mixed"}`}
                    >
                      <Link
                        className="matrix-main-link"
                        href={assignmentHref(
                          state,
                          cell.assignment.templateId,
                          { student: student.id },
                        )}
                        aria-label={`${student.displayName}, ${cell.assignment.title}: ${cell.counts.correct} correct of ${cell.counts.total} questions`}
                      >
                        {cell.received ? (
                          <>
                            <strong>
                              {cell.analyzed
                                ? `${cell.counts.correct} / ${cell.counts.total}`
                                : "—"}
                            </strong>
                            <small>
                              {cell.analyzed
                                ? "correct / questions"
                                : "Not analyzed"}
                            </small>
                          </>
                        ) : (
                          <span>Not received</span>
                        )}
                      </Link>
                      <div className="matrix-cell-meta">
                        {cell.counts.flagged > 0 && (
                          <Link
                            href={assignmentHref(
                              state,
                              cell.assignment.templateId,
                              { student: student.id, result: "flagged" },
                            )}
                          >
                            {cell.counts.flagged} flagged
                          </Link>
                        )}
                        {cell.counts.unanswered > 0 && (
                          <Link
                            href={assignmentHref(
                              state,
                              cell.assignment.templateId,
                              { student: student.id, result: "unanswered" },
                            )}
                          >
                            {cell.counts.unanswered} no answer
                          </Link>
                        )}
                        {cell.supportLevel && (
                          <span>{supportLabels[cell.supportLevel]}</span>
                        )}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="matrix-footnote">
        Different questions were used across assignments. Green cells show
        correct numerical results, not a permanent label or mastery claim.
      </p>
    </Card>
  );
}

function QuestionPatterns({
  state,
  templateId,
  insights,
}: {
  state: AppState;
  templateId: string;
  insights: ReturnType<typeof getAssignmentInsights>;
}) {
  return (
    <>
      <p className="analysis-explanation question-pattern-intro">
        Look beyond the final answer. These checks describe what is visible in
        the recorded work; a teacher should inspect the original. Skill checks
        can overlap.
      </p>
      <div className="question-pattern-grid">
        {insights.questions.map((item) => (
          <article className="question-pattern-card" key={item.question.id}>
            <div className="question-pattern-top">
              <span className="question-score-number">Q{item.number}</span>
              <Badge>
                {item.question.taskDifficulty === "core"
                  ? "Core calculation"
                  : "Apply in context"}
              </Badge>
            </div>
            <h3>{item.question.prompt}</h3>
            <ResultCounts
              counts={item.counts}
              href={(result) =>
                assignmentHref(state, templateId, {
                  question: item.question.id,
                  result,
                })
              }
            />
            <dl className="pattern-facts">
              <div>
                <dt>Common-unit working shown</dt>
                <dd>
                  {item.methodsShown}
                  <small> / {item.counts.usable} usable</small>
                </dd>
              </div>
              <div>
                <dt>Denominators added directly</dt>
                <dd>{item.denominatorAddition}</dd>
              </div>
              <div>
                <dt>Correct value, method needs a look</dt>
                <dd>{item.correctWithoutMethod}</dd>
              </div>
              {item.question.answerUnit && (
                <div>
                  <dt>Missing “{item.question.answerUnit}”</dt>
                  <dd>{item.missingUnits}</dd>
                </div>
              )}
              <div>
                <dt>Conflicting working to discuss</dt>
                <dd>{item.reasoningConflicts}</dd>
              </div>
            </dl>
            <p className="pattern-interpretation">
              {item.denominatorAddition > 0
                ? "Start by checking whether the student is treating unequal parts as the same unit."
                : item.correctWithoutMethod > 0
                  ? "Ask for a calculation, labeled drawing, or explanation before concluding that the method is understood."
                  : item.missingUnits > 0
                    ? "The numerical answer and its meaning need separate checks."
                    : item.counts.usable
                      ? "Use the working and the help given to decide what to ask next."
                      : "Read or collect the work before drawing a conclusion."}
            </p>
            <Link
              className="text-link"
              href={assignmentHref(state, templateId, {
                question: item.question.id,
              })}
            >
              Inspect question {item.number} <ArrowRight size={14} />
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}

export function AnalyticsExplorer({
  state,
  templateId,
  insights,
  view,
  onViewChange,
  comparisonTemplateId,
  onComparisonChange,
}: {
  state: AppState;
  templateId: string;
  insights: ReturnType<typeof getAssignmentInsights>;
  view: AnalyticsView;
  onViewChange: (view: AnalyticsView) => void;
  comparisonTemplateId?: string;
  onComparisonChange: (templateId: string) => void;
}) {
  return (
    <section
      className="analytics-explorer"
      aria-labelledby="analytics-explorer-title"
    >
      <div className="analysis-heading">
        <div>
          <span className="intelligence-eyebrow">Evidence</span>
          <h2 id="analytics-explorer-title">Results</h2>
        </div>
        <span>
          {insights.analytics.submittedStudents} of{" "}
          {insights.analytics.expectedStudents} worksheets received
        </span>
      </div>
      <div
        className="analysis-tabs"
        role="tablist"
        aria-label="Explore class evidence"
      >
        {views.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            id={`analysis-tab-${id}`}
            role="tab"
            aria-selected={view === id}
            aria-controls={`analysis-panel-${id}`}
            tabIndex={view === id ? 0 : -1}
            onClick={() => onViewChange(id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % views.length;
              else if (event.key === "ArrowLeft")
                next = (index - 1 + views.length) % views.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = views.length - 1;
              else return;
              event.preventDefault();
              onViewChange(views[next].id);
              document
                .getElementById(`analysis-tab-${views[next].id}`)
                ?.focus();
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {views.map(({ id }) => (
        <div
          key={id}
          className="analysis-panel"
          id={`analysis-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`analysis-tab-${id}`}
          hidden={view !== id}
          tabIndex={0}
        >
          {view !== id ? null : id === "class" ? (
            <ClassResults
              state={state}
              templateId={templateId}
              insights={insights}
              comparisonTemplateId={comparisonTemplateId}
              onComparisonChange={onComparisonChange}
            />
          ) : id === "students" ? (
            <StudentMatrix state={state} templateId={templateId} />
          ) : (
            <QuestionPatterns
              state={state}
              templateId={templateId}
              insights={insights}
            />
          )}
        </div>
      ))}
    </section>
  );
}
