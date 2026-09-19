"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading } from "@/components/shared";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ResultCounts } from "@/components/analytics";
import { getAssignmentAnalytics } from "@/lib/analytics";
import { assignments } from "@/lib/assignments";
import { assignmentHref, supportLabels } from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";
function Content() {
  const { data } = useWorkspace();
  const search = useSearchParams();
  if (!data) return null;
  const selected =
    assignments.find((a) => a.templateId === search.get("assignment")) ??
    [...assignments]
      .reverse()
      .find((a) =>
        data.state.batches.some((b) => b.templateId === a.templateId),
      ) ??
    assignments[0];
  const name = search.get("name") ?? "";
  function filter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    window.history.replaceState(null, "", `/students?${params}`);
  }
  return (
    <div className="page">
      <PageHeading
        title="Students"
        description="Eight fictional students · Grade 5"
      />
      <div className="analytics-toolbar">
        <label className="field">
          <span>Assignment</span>
          <Select
            aria-label="Assignment"
            value={selected.templateId}
            onChange={(e) => filter("assignment", e.target.value)}
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.templateId}>
                {a.title} · {dateLabel(a.date)}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>Find a student</span>
          <Input
            aria-label="Find a student"
            type="search"
            value={name}
            onChange={(e) => filter("name", e.target.value)}
            placeholder="Name"
          />
        </label>
      </div>
      <div className="student-grid">
        {data.state.students
          .filter(
            (s) =>
              s.active &&
              s.displayName.toLowerCase().includes(name.toLowerCase()),
          )
          .map((student) => {
            const stats = getAssignmentAnalytics(
              data.state,
              selected.templateId,
              { studentId: student.id },
            );
            const levels = [
              ...new Set(
                stats.slots
                  .filter((s) => s.submission)
                  .map((s) => s.supportLevel),
              ),
            ];
            return (
              <Card className="student-summary" key={student.id}>
                <div className="student-summary-head">
                  <div className="student-avatar">{student.displayName[0]}</div>
                  <div>
                    <h2>
                      <Link href={`/students/${student.id}`}>
                        {student.displayName}
                      </Link>
                    </h2>
                    <small>
                      {levels.length
                        ? levels.map((l) => supportLabels[l]).join(" · ")
                        : "No work received"}
                    </small>
                  </div>
                  <Link
                    style={{ marginLeft: "auto" }}
                    className="text-link text-small"
                    href={`/students/${student.id}`}
                  >
                    View student
                  </Link>
                </div>
                <ResultCounts
                  counts={stats.counts}
                  href={(result) =>
                    assignmentHref(data.state, selected.templateId, {
                      student: student.id,
                      result,
                    })
                  }
                />
              </Card>
            );
          })}
      </div>
      {!data.state.students.some((s) =>
        s.displayName.toLowerCase().includes(name.toLowerCase()),
      ) && <p className="empty-inline">No students match that name.</p>}
    </div>
  );
}
export default function StudentsPage() {
  return (
    <PageGate>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </PageGate>
  );
}
