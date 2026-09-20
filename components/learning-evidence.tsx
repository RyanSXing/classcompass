"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AppState } from "@/lib/contracts";
import type { LearningEvidence as Evidence } from "@/lib/learning-insights";
import { dateLabel } from "@/lib/utils";
export function LearningEvidence({
  evidence,
  state,
  children,
}: {
  evidence: Evidence[];
  state: AppState;
  children?: React.ReactNode;
}) {
  return (
    <details className="learning-evidence">
      <summary>Evidence</summary>
      {children}
      {evidence.length ? (
        <ul>
          {evidence.map((ref) => (
            <li
              key={`${ref.responseId}:${ref.responseRevision}:${ref.observationId ?? "current"}`}
            >
              <Link href={ref.href}>
                {
                  state.students.find((s) => s.id === ref.studentId)
                    ?.displayName
                }{" "}
                · {dateLabel(ref.activityDate)} · Q{ref.questionNumber}
                <ArrowRight size={13} />
              </Link>
              <span>
                {ref.support.level === "independent"
                  ? "Without help"
                  : ref.support.level === "supported"
                    ? "With help"
                    : "Help not recorded"}{" "}
                · {ref.taskDifficulty}
                {!ref.readingReviewed ? " · Reading not checked" : ""}
              </span>
              {ref.support.note && <p>{ref.support.note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p>Collect and read the work before drawing a conclusion.</p>
      )}
    </details>
  );
}
