"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, Clock3, LoaderCircle, Sparkles, UsersRound } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Banner } from "./shared";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select } from "./ui/input";
import type {
  ClassroomBrief,
  ClassroomBriefResult,
} from "@/lib/assistant-contracts";
import type { getLearningInsights } from "@/lib/learning-insights";
import type { teacherNextStep } from "@/lib/teacher-workflow";
import { dateLabel } from "@/lib/utils";
import type { AppState } from "@/lib/contracts";
import { getPriorityActions, type PriorityAction } from "@/lib/priority-actions";

export function assistantHref(templateId: string, prompt: string) {
  return `/assistant?${new URLSearchParams({ assignment: templateId, prompt })}`;
}

function GeneratedBrief({
  brief,
  templateId,
  handoff,
  state,
  priorityActions,
}: {
  brief: ClassroomBrief;
  templateId: string;
  handoff: React.ReactNode;
  state: AppState;
  priorityActions: PriorityAction[];
}) {
  return (
    <div className="generated-brief">
      <div className="brief-provenance">
        <Badge tone={brief.provenance.mode === "live" ? "aqua" : "neutral"}>
          {brief.provenance.mode === "live"
            ? "AI-generated"
            : "Sample-mode brief"}
        </Badge>
        <span>{dateLabel(brief.createdAt)}</span>
      </div>
      <PriorityActionCards
        actions={priorityActions}
        state={state}
        templateId={templateId}
      />
      {handoff}
      <details className="brief-full">
        <summary>Details</summary>
        <div className="brief-full-text">{brief.content}</div>
        {brief.actions.length > 0 && (
          <>
            <h3>All actions</h3>
            <ul>
              {brief.actions.map((action) => (
                <li key={action.id}>
                  <strong>{action.title}</strong>
                  <p>{action.description}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <ul>
          {brief.citations.map((citation) => (
            <li key={citation.id}>
              <Link href={citation.href}>{citation.label}</Link>
              <p>{citation.excerpt}</p>
            </li>
          ))}
        </ul>
        <p className="brief-disclosure">{brief.contextDisclosure.text}</p>
      </details>
    </div>
  );
}

function sourceLabel(source: PriorityAction["source"]) {
  if (source === "live") return "AI recommendation";
  if (source === "sample") return "Sample recommendation";
  return "From classroom evidence";
}

function PriorityEvidence({
  action,
  state,
}: {
  action: PriorityAction;
  state: AppState;
}) {
  return (
    <details className="learning-evidence">
      <summary>Evidence</summary>
      {action.reason && <p>{action.reason}</p>}
      {action.citation ? (
        <>
          <p>{action.citation.excerpt}</p>
          <Link href={action.citation.href}>
            {action.citation.label} <ArrowRight size={13} />
          </Link>
        </>
      ) : action.evidence?.length ? (
        <ul>
          {action.evidence.map((evidence) => (
            <li
              key={`${evidence.responseId}:${evidence.responseRevision}:${evidence.observationId ?? "current"}`}
            >
              <Link href={evidence.href}>
                {state.students.find((student) => student.id === evidence.studentId)
                  ?.displayName ?? "Student"}{" "}
                · {dateLabel(evidence.activityDate)} · Q{evidence.questionNumber}{" "}
                <ArrowRight size={13} />
              </Link>
              <span>
                {evidence.support.level === "independent"
                  ? "Without help"
                  : evidence.support.level === "supported"
                    ? "With help"
                    : "Help not recorded"}
                {!evidence.readingReviewed ? " · Reading not checked" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Collect and read the work before drawing a conclusion.</p>
      )}
    </details>
  );
}

function PriorityActionCards({
  actions,
  state,
  templateId,
}: {
  actions: PriorityAction[];
  state: AppState;
  templateId: string;
}) {
  if (!actions.length) return null;
  return (
    <div className="priority-actions" aria-label="Top teaching actions">
      {actions.map((action, index) => (
        <article className="priority-action brief-action" key={action.id}>
          <div className="priority-action-head">
            <span className="priority-action-number">{index + 1}</span>
            <Badge tone={action.source === "live" ? "aqua" : "neutral"}>
              {sourceLabel(action.source)}
            </Badge>
          </div>
          <h3>{action.title}</h3>
          {(action.who || action.time) && (
            <div className="priority-action-meta">
              {action.who && (
                <span>
                  <UsersRound size={14} aria-hidden="true" /> Who: {action.who}
                </span>
              )}
              {action.time && (
                <span>
                  <Clock3 size={14} aria-hidden="true" /> Time: {action.time}
                </span>
              )}
            </div>
          )}
          <div className="priority-action-next">
            <span>Next step</span>
            <p>{action.nextStep}</p>
          </div>
          {action.check && (
            <div className="priority-action-check">
              <strong>Check for</strong>
              <p>{action.check}</p>
            </div>
          )}
          <PriorityEvidence action={action} state={state} />
          <div className="priority-action-links">
            <Link
              href={assistantHref(
                templateId,
                `Plan this activity: ${action.title}. ${action.description} Use the saved steps, time, and success check. Base it on the saved work.`,
              )}
              className="decision-ask"
            >
              Plan activity <ArrowRight size={13} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DecisionBrief({
  templateId,
  learning,
  nextStep,
  newerTemplateId,
}: {
  templateId: string;
  learning: ReturnType<typeof getLearningInsights>;
  nextStep: ReturnType<typeof teacherNextStep>;
  newerTemplateId?: string;
}) {
  const { data, mutate } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chosenMode, setChosenMode] = useState<"fixture" | "live" | null>(null);
  const retry = useRef<{
    templateId: string;
    mode: "fixture" | "live";
    requestId: string;
  } | null>(null);
  if (!data) return null;
  const mode = chosenMode ?? data.config.aiMode;
  const aiUnavailable = mode === "live" && data.config.assistantLiveAvailable === false;
  const { state } = data;
  const brief = [
    ...(state.assistant?.briefs ??
      (state.assistant?.brief ? [state.assistant.brief] : [])),
  ]
    .reverse()
    .find(
      (item) =>
        item.scope.templateId === templateId &&
        !item.scope.studentId &&
        !item.scope.lessonId,
    );
  const lesson = state.plans.find(
    (item) => `/plans/${item.id}` === nextStep.lessonHref,
  );
  const lessonVersion = state.planVersions.find(
    (item) => item.id === lesson?.currentVersionId,
  );
  const direction = learning.lessonDirection;
  const priorityActions = getPriorityActions({
    brief: brief && !brief.stale ? brief : undefined,
    learning,
    students: state.students,
  });
  const saved = nextStep.kind === "saved";
  const handoff = newerTemplateId ? (
    <div className="lesson-decision-footer">
      <Button asChild>
        <Link
          href={`/classroom?assignment=${encodeURIComponent(newerTemplateId)}`}
        >
          Use the latest work to plan <ArrowRight size={16} />
        </Link>
      </Button>
    </div>
  ) : (
    <div
      className="lesson-decision-footer"
      aria-label="Next step"
      role="region"
    >
      <div>
        <p>
          {saved
            ? "Ready to teach"
            : nextStep.kind === "plan"
              ? "Review a draft before saving it."
              : nextStep.detail}
        </p>
        <div className="inline-actions">
          <Button asChild>
            <Link href={nextStep.href}>
              {nextStep.label}
              <ArrowRight size={16} />
            </Link>
          </Button>
          {nextStep.kind !== "plan" && !saved && (
            <Link className="text-link" href={nextStep.lessonHref}>
              Open lesson plan <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
      <span className="lesson-approval-note">You choose what changes.</span>
    </div>
  );
  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    if (
      retry.current?.templateId !== templateId ||
      retry.current?.mode !== mode
    )
      retry.current = { templateId, mode, requestId: crypto.randomUUID() };
    try {
      await mutate<ClassroomBriefResult>("/api/assistant/brief", {
        requestId: retry.current.requestId,
        scope: { templateId },
        mode,
      });
      retry.current = null;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The teaching brief could not be generated. Your work is saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="teaching-decisions lesson-decision"
      aria-labelledby="teaching-decisions-title"
    >
      <div className="intelligence-heading">
        <div>
          <span className="intelligence-eyebrow">
            <Sparkles size={14} /> Teaching priorities
          </span>
          <h2 id="teaching-decisions-title">
            {newerTemplateId
              ? "Earlier actions"
              : "Actions"}
          </h2>
          {lesson && !newerTemplateId && (
            <p>
              {dateLabel(lesson.date, { month: "short", day: "numeric" })} ·{" "}
              {lessonVersion?.snapshot.blocks.reduce(
                (total, block) => total + block.minutes,
                0,
              ) ?? 45}{" "}
              minutes
            </p>
          )}
        </div>
        <div className="brief-generate-controls">
          {data.config.sampleToolsEnabled !== false && <label className="field">
            <span>Insights</span>
            <Select
              aria-label="Teaching insights mode"
              value={mode}
              disabled={busy}
              onChange={(event) =>
                setChosenMode(event.target.value as "fixture" | "live")
              }
            >
              <option value="fixture">Sample</option>
              <option
                value="live"
                disabled={data.config.assistantLiveAvailable === false}
              >
                Live AI
                {data.config.assistantLiveAvailable === false
                  ? " · unavailable"
                  : ""}
              </option>
            </Select>
          </label>}
          <Button
            variant="outline"
            disabled={busy || aiUnavailable}
            onClick={() => void generate()}
          >
            {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
            {busy
              ? "Reading the evidence…"
              : brief
                ? "Refresh teaching insights"
                : "Generate teaching insights"}
          </Button>
        </div>
      </div>
      {aiUnavailable && <Banner>AI is not connected. Your saved work and lesson plans are still available.</Banner>}
      {newerTemplateId && (
        <Banner>
          These insights use work through {dateLabel(learning.throughDate)}.
          Newer work is available.
        </Banner>
      )}
      {error && (
        <Banner tone="error">
          {error} The evidence and starting point below are still available.
        </Banner>
      )}
      {busy && (
        <p role="status" className="brief-loading">
          Connecting learning over time with your next lesson.
        </p>
      )}
      {brief?.stale && (
        <Banner tone="warning">
          Work has changed. Refresh AI insights.
        </Banner>
      )}
      {brief && !brief.stale ? (
        <GeneratedBrief
          brief={brief}
          templateId={templateId}
          handoff={handoff}
          state={state}
          priorityActions={priorityActions}
        />
      ) : (
        <div className="lesson-starting-point">
          <span className="starting-point-label">Based on the saved work</span>
          <PriorityActionCards
            actions={priorityActions}
            state={state}
            templateId={templateId}
          />
          <h3>{saved ? "Saved lesson" : "Lesson focus"}</h3>
          <p>
            {saved ? nextStep.detail : (direction?.reason ?? learning.summary)}
          </p>
          {handoff}
        </div>
      )}
      {state.assistant?.goals.text && (
        <details className="brief-goal-details">
          <summary>Teaching goal</summary>
          <p>{state.assistant.goals.text}</p>
          <Link href="/assistant" className="text-link">
            Edit goal
          </Link>
        </details>
      )}
      {brief?.stale && (
        <details className="brief-full">
          <summary>Earlier insights</summary>
          <p className="brief-full-text">{brief.content}</p>
        </details>
      )}
    </section>
  );
}
