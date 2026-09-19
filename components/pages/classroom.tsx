"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Upload,
  FileStack,
  ListChecks,
  CalendarCheck2,
  BookOpen,
  ClipboardCheck,
  Sprout,
  ChevronRight,
  Plus,
  Check,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading, StatusBadge, Modal } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UploadDialog } from "@/components/upload-dialog";
import { currentFindings } from "@/lib/client/derived";
import { dateLabel } from "@/lib/utils";

function Cover({ kind }: { kind: "lesson" | "baseline" | "followup" }) {
  const Icon =
    kind === "lesson"
      ? BookOpen
      : kind === "baseline"
        ? ClipboardCheck
        : Sprout;
  return (
    <div
      className={`library-cover ${kind === "baseline" ? "teal" : kind === "followup" ? "peach" : ""}`}
    >
      <div className="cover-shape" />
      <div className="cover-shape two" />
      <div className="cover-dots">
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <Icon className="cover-icon" />
      <span className="cover-fraction">
        {kind === "lesson" ? "½ + ⅓" : kind === "baseline" ? "⅔" : "¾"}
      </span>
    </div>
  );
}
function ClassroomContent() {
  const { data, mutate, notify } = useWorkspace();
  const router = useRouter();
  const search = useSearchParams();
  const [upload, setUpload] = useState<"work" | "lesson" | null>(null);
  const shownUpload =
    upload ?? (search.get("upload") === "work" ? "work" : null);
  const [reset, setReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  if (!data) return null;
  const { state } = data;
  const baseline = state.batches.filter((b) => b.kind === "baseline").at(-1);
  const followup = state.batches.filter((b) => b.kind === "followup").at(-1);
  const plan =
    state.plans.find(
      (p) => p.id === (followup ? "lesson-2026-09-25" : "lesson-2026-09-23"),
    ) ?? state.plans[0];
  const version = state.planVersions.find(
    (v) => v.id === plan?.currentVersionId,
  );
  const awaiting = currentFindings(state.findings).filter(
    (f) => f.status === "candidate" || f.status === "stale",
  );
  const drafts = state.proposals.filter((p) => p.status === "draft");
  const confirmed = state.findings.filter((f) => f.status === "confirmed");
  const latest = followup ?? baseline;
  const nextHref =
    awaiting.length && latest
      ? `/review/${latest.id}`
      : confirmed.length
        ? `/plans/${plan.id}`
        : baseline
          ? `/review/${baseline.id}`
          : "";
  return (
    <div className="page">
      <PageHeading
        title="Your classroom"
        description="A little evidence. A clearer next step."
      >
        <Button variant="outline" onClick={() => setUpload("lesson")}>
          <Plus />
          Import lesson
        </Button>
      </PageHeading>
      <div className="workflow">
        {[
          "Upload work",
          "Review findings",
          "Adjust instruction",
          "Check progress",
        ].map((x, i) => (
          <div key={x} style={{ display: "contents" }}>
            {i > 0 && <span className="workflow-line" />}
            <span
              className={`workflow-step ${i === (followup ? 3 : confirmed.length ? 2 : baseline ? 1 : 0) ? "active" : ""}`}
            >
              <span className="step-number">{i + 1}</span>
              {x}
            </span>
          </div>
        ))}
      </div>
      <section className="hero">
        <div className="hero-text">
          <div className="eyebrow">FROM STUDENT WORK TO WHAT’S NEXT</div>
          <h2>
            {awaiting.length
              ? "Their work is in. Let’s look closer."
              : confirmed.length
                ? "You know more. Teach what’s next."
                : "Every worksheet tells you something."}
          </h2>
          <p>
            {awaiting.length
              ? `${awaiting.length} findings are ready for your review. See the original work, add your classroom context, and decide what should change.`
              : confirmed.length
                ? "Turn the evidence you’ve confirmed into a practical lesson adjustment. Every student gets a next step, within the time you already have."
                : "See what students are showing you, review the evidence, and shape a lesson that meets them where they are."}
          </p>
          {nextHref ? (
            <Button asChild>
              <Link href={nextHref}>
                {awaiting.length
                  ? "Review student evidence"
                  : confirmed.length
                    ? "Shape the next lesson"
                    : "Open student work"}
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setUpload("work")}>
              <Upload />
              Add your first worksheets
            </Button>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <Sparkles className="art-star" size={24} />
          <div className="paper-art">
            <div className="fraction-bar">
              <i />
              <i />
              <i className="empty" />
            </div>
            <div className="fraction-bar">
              <i />
              <i />
              <i />
              <i className="empty" />
              <i className="empty" />
              <i className="empty" />
            </div>
            <div className="paper-lines" />
            <div className="paper-lines" style={{ width: 64 }} />
          </div>
          <div className="art-badge">
            <Check size={28} strokeWidth={3} />
          </div>
        </div>
      </section>
      <div className="stats-grid">
        <Card className="stat">
          <div className="stat-icon">
            <FileStack size={23} />
          </div>
          <div>
            <div className="stat-number">{state.submissions.length}</div>
            <div className="stat-label">Worksheets received</div>
          </div>
        </Card>
        <Card className="stat">
          <div className="stat-icon amber">
            <ListChecks size={23} />
          </div>
          <div>
            <div className="stat-number">{awaiting.length}</div>
            <div className="stat-label">Findings to review</div>
          </div>
        </Card>
        <Card className="stat">
          <div className="stat-icon aqua">
            <CalendarCheck2 size={23} />
          </div>
          <div>
            <div className="stat-number">
              {drafts.reduce((n, p) => n + p.changes.length, 0)}
            </div>
            <div className="stat-label">Changes to consider</div>
          </div>
        </Card>
      </div>
      <div className="section-title">
        <h2>Your fraction addition unit</h2>
        <span className="text-small muted">Sep 21 – Oct 2</span>
      </div>
      <div className="library-grid">
        <Card className="library-card">
          <Cover kind="lesson" />
          <div className="library-body">
            <div>
              <Badge tone="violet">LESSON PLAN</Badge>
            </div>
            <h3>{plan?.title ?? "Apply fraction addition"}</h3>
            <p>
              Keep the goal. Make room for the next step each student needs.
            </p>
            <div className="library-footer">
              <small>
                {plan ? dateLabel(plan.date) : "Sep 23"} · 45 min · v
                {version?.versionNumber ?? 1}
              </small>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/plans/${plan?.id ?? "lesson-2026-09-23"}`}>
                  Open plan
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
        {(["baseline", "followup"] as const).map((kind) => {
          const batch = kind === "baseline" ? baseline : followup;
          return (
            <Card className="library-card" key={kind}>
              <Cover kind={kind} />
              <div className="library-body">
                <div>
                  <Badge tone={kind === "baseline" ? "aqua" : "amber"}>
                    {kind === "baseline"
                      ? "STUDENT EVIDENCE"
                      : "FOLLOW-UP CHECK"}
                  </Badge>
                </div>
                <h3>
                  {kind === "baseline"
                    ? "Let’s add fractions"
                    : "A fresh fraction check"}
                </h3>
                <p>
                  {kind === "baseline"
                    ? "Four questions. Eight perspectives. Start with the work in front of you."
                    : "Two new questions to see what changed after your lesson."}
                </p>
                <div className="library-footer">
                  <small>
                    {batch
                      ? `${batch.submissionIds.length} worksheets`
                      : `${kind === "baseline" ? "Sep 22" : "Sep 24"} · ${kind === "baseline" ? 4 : 2} questions`}
                  </small>
                  {batch ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/review/${batch.id}`}>
                        Review
                        <ArrowRight />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUpload("work")}
                    >
                      Add work
                      <Plus />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {state.batches.length > 0 && (
        <>
          <div className="section-title">
            <h2>Recent work</h2>
            <Button variant="ghost" size="sm" onClick={() => setUpload("work")}>
              <Plus />
              Add work
            </Button>
          </div>
          <Card>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Assignment</th>
                    <th>Completed</th>
                    <th>Students</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...state.batches].reverse().map((batch) => {
                    const job = state.jobs.find(
                      (j) => j.id === batch.latestJobId,
                    );
                    return (
                      <tr key={batch.id}>
                        <td>
                          <strong>{batch.title}</strong>
                          <small>
                            {batch.kind === "baseline"
                              ? "Baseline evidence"
                              : "Follow-up evidence"}
                          </small>
                        </td>
                        <td>{dateLabel(batch.activityDate)}</td>
                        <td>{batch.submissionIds.length} of 8</td>
                        <td>
                          <StatusBadge status={job?.status ?? "ready"} />
                        </td>
                        <td>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/review/${batch.id}`}>
                              Open
                              <ChevronRight />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <div className="section-title">
        <h2>Meet your classroom</h2>
        <small>8 fictional students</small>
      </div>
      <div className="roster">
        {state.students.map((student) => (
          <Link
            href={`/students/${student.id}`}
            className="student-card"
            key={student.id}
          >
            <div className="student-avatar">{student.displayName[0]}</div>
            <div>
              <strong>{student.displayName}</strong>
              <small>
                {
                  state.observations.filter(
                    (o) => o.studentId === student.id && !o.superseded,
                  ).length
                }{" "}
                reviewed observations
              </small>
            </div>
            <ChevronRight />
          </Link>
        ))}
      </div>
      <div
        style={{
          marginTop: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15,
        }}
      >
        <p className="text-small muted">
          You review the evidence. You make the teaching decisions.
        </p>
        {data.config.aiMode === "fixture" &&
          data.config.dataBackend === "local" && (
            <Button variant="ghost" size="sm" onClick={() => setReset(true)}>
              <RotateCcw />
              Reset demo
            </Button>
          )}
      </div>
      {shownUpload && (
        <UploadDialog
          initialTab={shownUpload}
          onClose={(navigated) => {
            setUpload(null);
            if (search.get("upload") && !navigated)
              router.replace("/classroom", { scroll: false });
          }}
        />
      )}{" "}
      {reset && (
        <Modal
          title="Start a fresh demonstration?"
          onClose={() => setReset(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setReset(false)}>
                Keep my work
              </Button>
              <Button
                variant="destructive"
                disabled={resetting}
                onClick={async () => {
                  setResetting(true);
                  try {
                    await mutate("/api/demo/reset", { confirm: true });
                    setReset(false);
                    notify("Fictional classroom reset. Ready for a fresh run.");
                  } finally {
                    setResetting(false);
                  }
                }}
              >
                Reset fictional work
              </Button>
            </>
          }
        >
          <p>
            This clears uploaded demo work, reviews and saved adjustments in
            this local workspace. The authored lessons and sample files remain
            available.
          </p>
        </Modal>
      )}
    </div>
  );
}
export default function ClassroomPage() {
  return (
    <Suspense
      fallback={<div className="loading-page">Opening your classroom…</div>}
    >
      <PageGate>
        <ClassroomContent />
      </PageGate>
    </Suspense>
  );
}
