"use client";
import { StudentAvatar } from "@/components/student-avatar";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, ChartNoAxesCombined } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { AppState } from "@/lib/contracts";
import type { getLearningInsights } from "@/lib/learning-insights";
import { getUnderstandingOverview } from "@/lib/understanding";
import { assistantHref } from "./decision-brief";
import { LearningEvidence } from "./learning-evidence";
import { Select } from "./ui/input";
import { ClassroomCharts } from "./classroom-charts";
import {
  StudentUnderstandingChart,
  UnderstandingHeatmap,
  UnderstandingStageBadge,
} from "./understanding-charts";

type Learning = ReturnType<typeof getLearningInsights>;

export function LearningOverview({
  learning,
  state,
}: {
  learning: Learning;
  state: AppState;
}) {
  const search = useSearchParams();
  const progressRef = useRef<HTMLDetailsElement>(null);
  const openSelectedWork = useRef(false);
  useEffect(() => {
    if (!openSelectedWork.current || search.get("progress") !== "open") return;
    const target = progressRef.current?.querySelector<HTMLElement>(".understanding-student-detail");
    if (!target) return;
    openSelectedWork.current = false;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }, [search]);
  const overview = getUnderstandingOverview(
    state,
    learning.assignment.templateId,
  );
  const skill =
    overview.skills.find((item) => item.id === search.get("skill")) ??
    overview.skills.find((item) => item.id === "obj-add-unlike-fractions") ??
    overview.skills[0];
  const selectedTemplateId = skill.snapshots.some(
    (item) => item.templateId === search.get("understandingDate"),
  )
    ? search.get("understandingDate")!
    : overview.assignment.templateId;
  const student =
    overview.students.find(
      (item) => item.studentId === search.get("understandingStudent"),
    ) ??
    overview.students.find(
      (item) =>
        item.skills.find((entry) => entry.skillId === skill.id)?.current
          .stage === "needs_support",
    ) ??
    overview.students.find(
      (item) =>
        item.skills.find((entry) => entry.skillId === skill.id)?.current
          .stage === "developing",
    ) ??
    overview.students[0];
  function updateSelection(values: Record<string, string | undefined>) {
    const query = new URLSearchParams(window.location.search);
    Object.entries(values).forEach(([key, value]) => value ? query.set(key, value) : query.delete(key));
    window.history.replaceState(null, "", `/classroom?${query}`);
  }
  return (
    <section
      className="understanding-panel"
      aria-labelledby="learning-picture-title"
    >
      <div className="understanding-heading">
        <div>
          <span className="intelligence-eyebrow">
            <ChartNoAxesCombined size={14} /> Across the unit
          </span>
          <h2 id="learning-picture-title">Learning picture</h2>
          <p>See where students are now and how the work has changed.</p>
        </div>
        <label className="field understanding-skill">
          <span>Focus on a skill</span>
          <Select
            aria-label="Understanding skill"
            value={skill.id}
            onChange={(event) => updateSelection({ skill: event.target.value })}
          >
            {overview.skills.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="understanding-legend" aria-label="Understanding stages">
        {overview.legend.map((item) => (
          <UnderstandingStageBadge key={item.stage} stage={item.stage} />
        ))}
      </div>
      <ClassroomCharts
        overview={overview}
        skill={skill}
        selectedTemplateId={selectedTemplateId}
        selectedStudentId={student?.studentId ?? ""}
        onSelectDate={(templateId) => updateSelection({ understandingDate: templateId })}
        onSelectStudent={(studentId, templateId) => {
          openSelectedWork.current = true;
          updateSelection({
            understandingStudent: studentId,
            understandingDate: templateId,
            progress: "open",
          });
        }}
        onSelectSkill={(skillId) => updateSelection({ skill: skillId })}
      />
      <details className="understanding-definitions">
        <summary>How to read these stages</summary>
        <dl>
          {overview.legend.map((item) => (
            <div key={item.stage} className="understanding-definition">
              <dt>
                <UnderstandingStageBadge stage={item.stage} />
              </dt>
              <dd>{item.description}</dd>
            </div>
          ))}
        </dl>
        <p>{skill.description}</p>
        <ul>
          {skill.criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
        {overview.limitations.map((limitation) => (
          <p key={limitation}>{limitation}</p>
        ))}
      </details>
      <details
        ref={progressRef}
        className="student-progress-explorer"
        open={search.get("progress") === "open"}
        onToggle={(event) => {
          if (event.currentTarget.open !== (search.get("progress") === "open"))
            updateSelection({ progress: event.currentTarget.open ? "open" : undefined });
        }}
      >
        <summary><span>Explore student progress</span><small>Dates, working and next checks</small></summary>
        <UnderstandingHeatmap
          overview={overview}
          skill={skill}
          selectedStudentId={student?.studentId ?? ""}
          selectedTemplateId={selectedTemplateId}
          onSelect={(studentId, templateId) =>
            updateSelection({
              understandingStudent: studentId,
              understandingDate: templateId,
            })
          }
        />
      {student && (
        <StudentUnderstandingChart
          student={student}
          skill={skill}
          selectedTemplateId={selectedTemplateId}
          onSelectDate={(templateId) =>
            updateSelection({ understandingDate: templateId })
          }
        />
      )}
      </details>
    </section>
  );
}

export function LearningFollowUps({
  learning,
  state,
}: {
  learning: Learning;
  state: AppState;
}) {
  return (
    <section
      className="learning-section understanding-followups"
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
                      !learning.followUps.some((shown) => shown.id === item.id),
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
        <StudentAvatar studentId={followUp.studentId} size={36} />
        <Link href={`/students/${followUp.studentId}`}>{name}</Link>
      </div>
      <div className="followup-content">
        <h3>{followUp.title}</h3>
        <p className="followup-action">
          <strong>Next:</strong> {followUp.nextStep}
        </p>
        <details className="followup-steps">
          <summary>Teaching steps · {followUp.minutes} min</summary>
          <p>{followUp.reason}</p>
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
