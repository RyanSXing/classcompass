"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/upload-dialog";
import { dateLabel } from "@/lib/utils";
import { assignments } from "@/lib/assignments";
import { assignmentHref } from "@/lib/client/links";
import { curriculum } from "@/lib/curriculum";

function planStatus(
  proposal: { status: string } | undefined,
  version: { proposalId: string | null } | undefined,
) {
  if (proposal?.status === "draft") return "draft";
  return version?.proposalId ? "saved" : "original";
}

function Content() {
  const { data } = useWorkspace();
  const [upload, setUpload] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  if (!data) return null;

  const { state } = data;
  const plans = [...state.plans].sort((a, b) => a.date.localeCompare(b.date));
  const latestSubmittedAssignment = assignments
    .filter((assignment) =>
      state.batches.some(
        (batch) =>
          batch.templateId === assignment.templateId &&
          batch.submissionIds.length > 0,
      ),
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const defaultPlanId =
    plans.find((plan) => plan.id === latestSubmittedAssignment?.targetLessonId)
      ?.id ?? plans[0]?.id;
  const selectedPlan =
    plans.find((plan) => plan.id === (selectedPlanId ?? defaultPlanId)) ??
    plans[0];
  const version = selectedPlan
    ? state.planVersions.find((item) => item.id === selectedPlan.currentVersionId)
    : undefined;
  const proposal = selectedPlan
    ? state.proposals.filter((item) => item.lessonId === selectedPlan.id).at(-1)
    : undefined;
  const assignment = selectedPlan
    ? assignments.find((item) => item.targetLessonId === selectedPlan.id)
    : undefined;
  const objectiveLabels = (version?.snapshot.objectiveIds ?? [])
    .map(
      (id) => curriculum.objectives.find((objective) => objective.id === id)
        ?.description,
    )
    .filter((label): label is string => Boolean(label));

  return (
    <div className="page lessons-page">
      <PageHeading
        title="Lessons"
        description="Choose a lesson, scan the plan, then open it when you are ready to teach."
      >
        <Button variant="outline" asChild>
          <Link href="/calendar">
            <CalendarDays />
            Calendar
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setUpload(true)}>
          <Plus />
          Import lesson
        </Button>
      </PageHeading>

      {selectedPlan && version ? (
        <section className="lesson-library" aria-label="Lesson library">
          <aside className="lesson-library-list" aria-label="Unit lessons">
            <div className="lesson-library-list-head">
              <span className="eyebrow">Unit lessons</span>
              <span>{plans.length} planned</span>
            </div>
            <div className="lesson-library-options" role="list">
              {plans.map((plan) => {
                const current = state.planVersions.find(
                  (item) => item.id === plan.currentVersionId,
                );
                const planProposal = state.proposals
                  .filter((item) => item.lessonId === plan.id)
                  .at(-1);
                const active = plan.id === selectedPlan.id;
                return (
                  <button
                    className={`lesson-library-option${active ? " active" : ""}`}
                    key={plan.id}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Show ${dateLabel(plan.date)} lesson: ${plan.title}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <span className="lesson-option-date">{dateLabel(plan.date)}</span>
                    <span className="lesson-option-title">{plan.title}</span>
                    <span className="lesson-option-meta">
                      {current?.snapshot.totalMinutes ?? 45} min
                      <StatusBadge status={planStatus(planProposal, current)} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="lesson-library-fixed-date">Assessment · Oct 2</p>
          </aside>

          <article className="lesson-library-preview">
            <div className="lesson-preview-topline">
              <span>{dateLabel(selectedPlan.date, { month: "long", day: "numeric" })}</span>
              <StatusBadge status={planStatus(proposal, version)} />
            </div>
            <div className="lesson-preview-title-row">
              <div>
                <h2>{selectedPlan.title}</h2>
                <p>{version.snapshot.totalMinutes} minute lesson</p>
              </div>
              <Button asChild>
                <Link href={`/plans/${selectedPlan.id}`}>
                  Open lesson plan <ChevronRight />
                </Link>
              </Button>
            </div>

            <div className="lesson-preview-body">
              <section
                className="lesson-preview-focus"
                aria-labelledby="lesson-focus-title"
              >
                <span className="eyebrow">Learning focus</span>
                <h3 id="lesson-focus-title">What students will practise</h3>
                <ul>
                  {objectiveLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </section>
              <section
                className="lesson-preview-blocks"
                aria-labelledby="lesson-blocks-title"
              >
                <div className="lesson-preview-section-head">
                  <div>
                    <span className="eyebrow">Lesson flow</span>
                    <h3 id="lesson-blocks-title">45 minutes at a glance</h3>
                  </div>
                  {assignment && (
                    <Link
                      className="text-link"
                      href={assignmentHref(state, assignment.templateId)}
                    >
                      View linked work
                    </Link>
                  )}
                </div>
                <ol className="lesson-preview-block-list">
                  {version.snapshot.blocks.map((block) => (
                    <li key={block.id}>
                      <span>{block.minutes} min</span>
                      <div>
                        <strong>{block.title}</strong>
                        <small>
                          {block.mode === "concurrent"
                            ? "Small groups"
                            : "Whole class"}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <div className="lesson-preview-footer">
              <p>
                {assignment
                  ? `This plan follows ${assignment.title}.`
                  : "This plan is ready for your classroom."}
              </p>
              <Link href={`/plans/${selectedPlan.id}`}>Read the full plan</Link>
            </div>
          </article>
        </section>
      ) : (
        <section className="lesson-library-empty">
          <h2>No lessons yet</h2>
          <p>Import a lesson plan to begin building your unit.</p>
        </section>
      )}

      {upload && (
        <UploadDialog initialTab="lesson" onClose={() => setUpload(false)} />
      )}
    </div>
  );
}

export default function LessonsPage() {
  return (
    <PageGate>
      <Content />
    </PageGate>
  );
}
