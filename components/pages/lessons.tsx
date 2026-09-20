"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading, StatusBadge } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/upload-dialog";
import { dateLabel } from "@/lib/utils";
import { assignments } from "@/lib/assignments";
import { assignmentHref } from "@/lib/client/links";
function Content() {
  const { data } = useWorkspace();
  const [upload, setUpload] = useState(false);
  if (!data) return null;
  const { state } = data;
  return (
    <div className="page">
      <PageHeading
        title="Lessons"
        description="Ready-to-teach fraction lessons with worked examples, practice, and exit checks."
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
      <div className="assignment-list">
        {[...state.plans]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((plan) => {
            const version = state.planVersions.find(
              (v) => v.id === plan.currentVersionId,
            );
            const proposal = state.proposals
              .filter((p) => p.lessonId === plan.id)
              .at(-1);
            const assignment = assignments.find(
              (a) => a.targetLessonId === plan.id,
            );
            return (
              <Card key={plan.id} className="assignment-row">
                <div>
                  <h2>
                    <Link href={`/plans/${plan.id}`}>{plan.title}</Link>
                  </h2>
                  <p>
                    {dateLabel(plan.date)} ·{" "}
                    {version?.snapshot.totalMinutes ?? 45} minutes
                  </p>
                </div>
                <div>
                  <StatusBadge
                    status={
                      proposal?.status === "draft"
                        ? "draft"
                        : version?.proposalId
                          ? "saved"
                          : "original"
                    }
                  />
                  {assignment && (
                    <p>
                      Work:{" "}
                      <Link
                        className="text-link"
                        href={assignmentHref(state, assignment.templateId)}
                      >
                        {assignment.title}
                      </Link>
                    </p>
                  )}
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/plans/${plan.id}`}>Open lesson plan</Link>
                </Button>
              </Card>
            );
          })}
      </div>
      <p className="help-note mt-16">
        Unit assessment: October 2. This date is fixed.
      </p>
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
