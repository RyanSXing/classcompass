"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SampleLoader } from "@/components/sample-loader";
import { ResultCounts } from "@/components/analytics";
import { assignments } from "@/lib/assignments";
import { getAssignmentAnalytics } from "@/lib/analytics";
import { assignmentHref } from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";
function Content() {
  const { data } = useWorkspace();
  if (!data) return null;
  return (
    <div className="page">
      <PageHeading
        title="Assignments"
        description="Student work across the fraction unit."
      >
        <SampleLoader />
      </PageHeading>
      <div className="assignment-list">
        {assignments.map((a) => {
          const stats = getAssignmentAnalytics(data.state, a.templateId);
          return (
            <Card className="assignment-row" key={a.id}>
              <div>
                <h2>
                  <Link href={assignmentHref(data.state, a.templateId)}>
                    {a.title}
                  </Link>
                </h2>
                <p>
                  {dateLabel(a.date)} ·{" "}
                  {
                    data.curriculum.templates.find((t) => t.id === a.templateId)
                      ?.questionIds.length
                  }{" "}
                  questions
                </p>
                <div className="assignment-meta">
                  {stats.submittedStudents} of {stats.expectedStudents} students
                  · {a.purpose}
                </div>
              </div>
              <div>
                <Link className="text-link" href={`/classroom?assignment=${a.templateId}`}>View skill picture</Link>
                <details className="student-work-details"><summary>Answer details</summary><ResultCounts
                  counts={stats.counts}
                  href={(result) =>
                    assignmentHref(data.state, a.templateId, { result })
                  }
                /></details>
                {stats.totalAttempts > stats.submittedStudents && (
                  <p className="help-note">
                    Latest upload per student shown. Earlier uploads are kept.
                  </p>
                )}
              </div>
              <Button variant="outline" asChild>
                <Link href={assignmentHref(data.state, a.templateId)}>
                  {stats.submittedStudents ? "Open results" : "Add work"}
                </Link>
              </Button>
            </Card>
          );
        })}
      </div>
      {data.config.sampleToolsEnabled !== false && <p className="help-note mt-16">
        Sample results are prepared from fictional work. Loading again keeps
        saved corrections and reviews.
      </p>}
    </div>
  );
}
export default function AssignmentsPage() {
  return (
    <PageGate>
      <Content />
    </PageGate>
  );
}
