"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, MessageSquare, Upload } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading, EmptyState } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/upload-dialog";
import { SampleLoader } from "@/components/sample-loader";
import { DecisionBrief, assistantHref } from "@/components/decision-brief";
import {
  AnalyticsExplorer,
  type AnalyticsView,
} from "@/components/analytics-explorer";
import { getAssignmentInsights } from "@/lib/insights";
import { assignments } from "@/lib/assignments";
import { assignmentHref } from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";
import { teacherNextStep } from "@/lib/teacher-workflow";
import { getLearningInsights } from "@/lib/learning-insights";
import {
  LearningFollowUps,
  LearningOverview,
} from "@/components/learning-overview";

function ClassroomContent() {
  const { data } = useWorkspace();
  const search = useSearchParams();
  const [upload, setUpload] = useState(false);
  if (!data) return null;
  const { state } = data;
  const latest =
    [...assignments]
      .reverse()
      .find((assignment) =>
        state.batches.some(
          (batch) => batch.templateId === assignment.templateId,
        ),
      ) ?? assignments[0];
  const selected =
    assignments.find(
      (assignment) => assignment.templateId === search.get("assignment"),
    ) ?? latest;
  const insights = getAssignmentInsights(state, selected.templateId);
  const learning = getLearningInsights(state, selected.templateId);
  const nextStep = teacherNextStep(state, selected.templateId);
  const view: AnalyticsView =
    search.get("view") === "students"
      ? "students"
      : search.get("view") === "questions"
        ? "questions"
        : "class";
  const hasWork = state.submissions.length > 0;
  function updateQuery(values: Record<string, string | undefined>) {
    const query = new URLSearchParams(window.location.search);
    Object.entries(values).forEach(([key, value]) =>
      value ? query.set(key, value) : query.delete(key),
    );
    window.history.replaceState(
      null,
      "",
      `/classroom${query.size ? `?${query}` : ""}`,
    );
  }
  return (
    <div className="page intelligence-page">
      <PageHeading title="Overview" description="Grade 5 · Fraction addition">
        <Button variant="outline" onClick={() => setUpload(true)}>
          <Upload size={16} />
          Upload work
        </Button>
        <Button variant="outline" asChild>
          <Link
            href={assistantHref(
              selected.templateId,
              "What should I teach next, and what evidence supports that decision?",
            )}
          >
            <MessageSquare size={16} />
            Ask assistant
          </Link>
        </Button>
      </PageHeading>
      {!hasWork ? (
        <Card>
          <EmptyState
            title="Start with your students’ work"
            text={data.config.sampleToolsEnabled === false ? "Upload a worksheet to see what your students understand and what to teach next." : "Upload a worksheet, then turn the answers into a practical teaching brief. Or explore five assignments from a fictional class."}
            action={
              <div className="inline-actions">
                <Button onClick={() => setUpload(true)}>
                  Upload worksheets
                </Button>
                <SampleLoader />
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <div className="intelligence-assignment-bar">
            <label className="field">
              <span>Work through</span>
              <Select
                aria-label="Assignment"
                value={selected.templateId}
                onChange={(event) =>
                  updateQuery({
                    assignment: event.target.value,
                    compare: undefined,
                  })
                }
              >
                {assignments.map((assignment) => (
                  <option value={assignment.templateId} key={assignment.id}>
                    {assignment.title} · {dateLabel(assignment.date)}
                  </option>
                ))}
              </Select>
            </label>
            <p>
              {selected.purpose}
            </p>
            <Link
              className="text-link"
              href={assignmentHref(state, selected.templateId)}
            >
              Open assignment <ArrowRight size={15} />
            </Link>
          </div>
          <DecisionBrief
            key={selected.templateId}
            templateId={selected.templateId}
            learning={learning}
            nextStep={nextStep}
            newerTemplateId={
              selected.sequence < latest.sequence
                ? latest.templateId
                : undefined
            }
          />
          <LearningOverview learning={learning} state={state} />
          <LearningFollowUps learning={learning} state={state} />
          <details
            className="evidence-explorer"
            key={`evidence-${selected.templateId}`}
            open={
              search.has("view") ||
              search.has("compare") ||
              search.get("evidence") === "open"
            }
            onToggle={(event) => {
              if (event.currentTarget.open && search.get("evidence") !== "open")
                updateQuery({ evidence: "open" });
              else if (
                !event.currentTarget.open &&
                search.get("evidence") === "open"
              )
                updateQuery({
                  evidence: undefined,
                  view: undefined,
                  compare: undefined,
                });
            }}
          >
            <summary>
              <span>Explore the evidence</span>
              <small>Class results, student work, and question patterns</small>
            </summary>
            <AnalyticsExplorer
              state={state}
              templateId={selected.templateId}
              insights={insights}
              view={view}
              comparisonTemplateId={search.get("compare") ?? undefined}
              onComparisonChange={(templateId) =>
                updateQuery({ compare: templateId })
              }
              onViewChange={(next) =>
                updateQuery({ view: next === "class" ? undefined : next })
              }
            />
          </details>
        </>
      )}
      {(upload || search.get("upload") === "work") && (
        <UploadDialog
          initialTemplateId={
            upload
              ? selected.templateId
              : (search.get("assignment") ?? undefined)
          }
          onClose={(navigated) => {
            setUpload(false);
            if (!navigated && search.get("upload"))
              updateQuery({ upload: undefined });
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
