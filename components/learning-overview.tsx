"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, TrendingUp } from "lucide-react";
import type { AppState } from "@/lib/contracts";
import type { getLearningInsights } from "@/lib/learning-insights";
import { dateLabel } from "@/lib/utils";
import { assistantHref } from "./decision-brief";
import { LearningEvidence } from "./learning-evidence";

type Learning = ReturnType<typeof getLearningInsights>;

export function LearningOverview({
  learning,
  state,
}: {
  learning: Learning;
  state: AppState;
}) {
  return (
    <>
      <section
        className="learning-section"
        aria-labelledby="learning-development-title"
      >
        <div className="learning-section-heading">
          <div>
            <span className="intelligence-eyebrow">
              <TrendingUp size={15} /> Across the unit
            </span>
            <h2 id="learning-development-title">How learning is developing</h2>
          </div>
          <span className="learning-through">
            Through {dateLabel(learning.throughDate)}
          </span>
        </div>
        {learning.trends.length === 0 && (
          <p className="learning-summary">{learning.summary}</p>
        )}
        <div className="learning-trend-grid">
          {learning.trends.map((trend) => (
            <article className="learning-trend" key={trend.id}>
              <p className="learning-skill">{trend.skill}</p>
              <h3>{trend.title}</h3>
              {trend.studentIds.length > 0 && (
                <p className="learning-students">
                  {trend.studentIds
                    .slice(0, 3)
                    .map(
                      (id) =>
                        state.students.find((student) => student.id === id)
                          ?.displayName,
                    )
                    .filter(Boolean)
                    .join(", ")}
                  {trend.studentIds.length > 3
                    ? ` and ${trend.studentIds.length - 3} others`
                    : ""}
                </p>
              )}
              <div className="learning-dates">
                {dateLabel(trend.dateRange.from)}
                {trend.dateRange.to !== trend.dateRange.from && (
                  <>
                    {" "}
                    <ArrowRight size={12} aria-label="to" />{" "}
                    {dateLabel(trend.dateRange.to)}
                  </>
                )}
              </div>
              <p>{trend.description}</p>
              <div className="learning-next">
                <Compass size={16} />
                <p>{trend.nextStep}</p>
              </div>
              <LearningEvidence state={state} evidence={trend.evidence}>
                <p className="learning-comparability">{trend.comparability}</p>
              </LearningEvidence>
            </article>
          ))}
        </div>
        {learning.limitations.length > 0 && (
          <details className="learning-limits">
            <summary>What we can tell from this work</summary>
            <ul>
              {learning.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section
        className="learning-section"
        aria-labelledby="student-followups-title"
      >
        <div className="learning-section-heading">
          <div>
            <span className="intelligence-eyebrow">Individual follow-ups</span>
            <h2 id="student-followups-title">Students to check</h2>
          </div>
          <Link href="/students" className="text-link">
            All students <ArrowRight size={14} />
          </Link>
        </div>
        {learning.followUps.length ? (
          <>
            <div className="learning-followups">
              {learning.followUps.map((followUp) => (
                <FollowUp
                  key={followUp.id}
                  followUp={followUp}
                  state={state}
                  templateId={learning.assignment.templateId}
                />
              ))}
            </div>
            {learning.allFollowUps.length > learning.followUps.length && (
              <details className="more-followups">
                <summary>More student follow-ups</summary>
                <div className="learning-followups">
                  {learning.allFollowUps
                    .filter(
                      (item) =>
                        !learning.followUps.some(
                          (shown) => shown.id === item.id,
                        ),
                    )
                    .map((followUp) => (
                      <FollowUp
                        key={followUp.id}
                        followUp={followUp}
                        state={state}
                        templateId={learning.assignment.templateId}
                      />
                    ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <div className="learning-empty">
            <CheckCircle2 size={20} />
            <p>
              No specific follow-up is supported yet. Use the next independent
              task to check the skill and record any help.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function FollowUp({
  followUp,
  state,
  templateId,
}: {
  followUp: Learning["followUps"][number];
  state: AppState;
  templateId: string;
}) {
  const name =
    state.students.find((s) => s.id === followUp.studentId)?.displayName ??
    "Student";
  return (
    <article className="learning-followup" aria-label={`${name} follow-up`}>
      <div className="followup-person">
        <span className="matrix-avatar" aria-hidden="true">
          {name.charAt(0)}
        </span>
        <Link href={`/students/${followUp.studentId}`}>{name}</Link>
      </div>
      <div className="followup-content">
        <h3>{followUp.title}</h3>
        <p>{followUp.reason}</p>
        <p className="followup-action">
          <strong>Next:</strong> {followUp.nextStep}
        </p>
        <details className="followup-steps">
          <summary>Teaching steps · {followUp.minutes} min</summary>
          <ol>
            {followUp.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>
            <strong>Look for:</strong> {followUp.successCheck}
          </p>
        </details>
        <LearningEvidence evidence={followUp.evidence} state={state} />
      </div>
      <Link
        className="text-link followup-ask"
        href={assistantHref(
          templateId,
          `Help me follow up with ${name}: ${followUp.nextStep} Use their dated work and help records, explain the teaching steps, and give a fresh question to check independence.`,
        )}
      >
        Ask assistant <ArrowRight size={14} />
      </Link>
    </article>
  );
}
