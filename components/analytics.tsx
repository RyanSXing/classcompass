"use client";
import Link from "next/link";
import type { AppState } from "@/lib/contracts";
import { getAssignmentAnalytics, type ResultBucket } from "@/lib/analytics";
import { assignments } from "@/lib/assignments";
import { assignmentHref } from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";
export const resultLabels: Record<ResultBucket, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  flagged: "Flagged",
  unanswered: "No answer",
  unprocessed: "Not analyzed",
  not_received: "Not received",
};
export const resultOrder: ResultBucket[] = [
  "correct",
  "incorrect",
  "flagged",
  "unanswered",
  "unprocessed",
  "not_received",
];
type Counts = ReturnType<typeof getAssignmentAnalytics>["counts"];
export function ResultLabel({
  result,
  count,
}: {
  result: ResultBucket;
  count?: number;
}) {
  return (
    <span className={`result-label result-${result}`}>
      <span className="result-dot" />
      {count !== undefined && <b>{count}</b>}
      {resultLabels[result]}
    </span>
  );
}
export function ResultCounts({
  counts,
  href,
}: {
  counts: Counts;
  href?: (result: ResultBucket) => string;
}) {
  return (
    <div className="result-counts">
      {resultOrder
        .filter((r) => counts[r] > 0)
        .map((r) =>
          href ? (
            <Link key={r} href={href(r)}>
              <ResultLabel result={r} count={counts[r]} />
            </Link>
          ) : (
            <ResultLabel key={r} result={r} count={counts[r]} />
          ),
        )}
    </div>
  );
}
export function ResultCards({
  state,
  templateId,
  studentId,
}: {
  state: AppState;
  templateId: string;
  studentId?: string;
}) {
  const { counts } = getAssignmentAnalytics(state, templateId, { studentId });
  return (
    <div className="result-cards">
      {(
        ["correct", "incorrect", "flagged", "unanswered"] as ResultBucket[]
      ).map((result) => (
        <Link
          key={result}
          className={`result-card result-${result}`}
          href={assignmentHref(state, templateId, {
            result,
            student: studentId,
          })}
        >
          <strong>{counts[result]}</strong>
          <span>
            <ResultLabel result={result} />
            <small>
              {result === "flagged"
                ? "Check the reading"
                : `of ${counts.total} answers`}
            </small>
          </span>
        </Link>
      ))}
    </div>
  );
}
export function AssignmentTrend({
  state,
  studentId,
}: {
  state: AppState;
  studentId?: string;
}) {
  return (
    <>
      <div className="result-legend">
        {resultOrder.map((result) => (
          <ResultLabel key={result} result={result} />
        ))}
      </div>
      <div className="trend-list">
        {assignments.map((assignment) => {
          const { counts } = getAssignmentAnalytics(
            state,
            assignment.templateId,
            { studentId },
          );
          return (
            <div className="trend-row" key={assignment.id}>
              <Link
                className="trend-name"
                href={assignmentHref(state, assignment.templateId, {
                  student: studentId,
                })}
              >
                {assignment.title}
                <small>{dateLabel(assignment.date)}</small>
              </Link>
              <div className="trend-track">
                {resultOrder
                  .filter((result) => counts[result] > 0)
                  .map((result) => (
                    <Link
                      key={result}
                      className={`trend-segment result-${result}`}
                      href={assignmentHref(state, assignment.templateId, {
                        student: studentId,
                        result,
                      })}
                      style={{ flex: counts[result] }}
                      aria-label={`${assignment.title}: ${counts[result]} ${resultLabels[result].toLowerCase()} of ${counts.total}`}
                    >
                      {counts[result]}
                    </Link>
                  ))}
              </div>
              <span className="trend-total">{counts.total} total</span>
            </div>
          );
        })}
      </div>
      <p className="chart-note">
        Answer counts by assignment. Tasks and help may differ.
      </p>
    </>
  );
}
