"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Banner } from "./shared";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select } from "./ui/input";
import type { AppState } from "@/lib/contracts";
import type {
  ClassroomBrief,
  ClassroomBriefResult,
} from "@/lib/assistant-contracts";
import type { TeachingAction } from "@/lib/insights";
import { getTemplate } from "@/lib/curriculum";
import { assignmentHref } from "@/lib/client/links";
import { dateLabel } from "@/lib/utils";

export function assistantHref(templateId: string, prompt: string) {
  return `/assistant?${new URLSearchParams({ assignment: templateId, prompt })}`;
}

function DataAction({
  action,
  state,
  templateId,
  number,
}: {
  action: TeachingAction;
  state: AppState;
  templateId: string;
  number: number;
}) {
  const names = action.studentIds
    .map(
      (id) => state.students.find((student) => student.id === id)?.displayName,
    )
    .filter(Boolean)
    .join(", ");
  const sourceLink = assignmentHref(state, templateId, {
    ...action.filters,
    ...(action.studentIds.length === 1
      ? { student: action.studentIds[0] }
      : {}),
  });
  return (
    <article className={`decision-card decision-${action.kind}`}>
      <div className="decision-card-top">
        <span className="decision-number">0{number}</span>
        <span className="decision-time">
          <Clock3 size={13} /> {action.minutes} min
        </span>
      </div>
      <h3>{action.title}</h3>
      <p className="decision-students">{names}</p>
      <Badge
        tone={
          action.status === "reviewed"
            ? "green"
            : action.status === "needs_reading"
              ? "amber"
              : "neutral"
        }
      >
        {action.status === "reviewed"
          ? "Teaching notes approved"
          : action.status === "needs_reading"
            ? "Check the source"
            : "Suggested · review first"}
      </Badge>
      <p className="decision-reason">{action.reason}</p>
      <details className="decision-instructions">
        <summary>How to teach it</summary>
        <ol>
          {action.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="decision-success">
          <CheckCircle2 size={16} />
          <p>
            <strong>Look for success:</strong> {action.successCheck}
          </p>
        </div>
      </details>
      {action.evidence.length > 0 && (
        <details className="decision-evidence">
          <summary>
            {action.evidence.length} source answer
            {action.evidence.length === 1 ? "" : "s"}
          </summary>
          <div>
            {action.evidence.map((ref) => (
              <Link
                key={`${ref.responseId}:${ref.responseRevision}`}
                href={`/review/${ref.batchId}?${new URLSearchParams({ student: ref.studentId, question: ref.questionId, response: ref.responseId, revision: String(ref.responseRevision) })}#answer-inspector`}
              >
                {
                  state.students.find((student) => student.id === ref.studentId)
                    ?.displayName
                }{" "}
                · Q
                {getTemplate(templateId).questionIds.indexOf(ref.questionId) +
                  1}
                <span>Reading {ref.responseRevision}</span>
              </Link>
            ))}
          </div>
        </details>
      )}
      <div className="decision-card-actions">
        <Link className="text-link" href={sourceLink}>
          Review the work <ArrowRight size={14} />
        </Link>
        <Link
          className="decision-ask"
          href={assistantHref(
            templateId,
            `Help me ${action.title.toLowerCase()} for ${names}. Use the current evidence, give concrete teaching steps, and explain what I should check next.`,
          )}
          aria-label={`Ask assistant about ${action.title.toLowerCase()}`}
        >
          <MessageSquare size={14} /> Ask assistant
        </Link>
      </div>
      {action.status === "reviewed" && (
        <Link
          className="decision-plan-link"
          href={`/plans/${action.recommendedLessonId}`}
        >
          Use in the lesson plan <ArrowRight size={14} />
        </Link>
      )}
    </article>
  );
}

function GeneratedBrief({
  brief,
  templateId,
}: {
  brief: ClassroomBrief;
  templateId: string;
}) {
  const paragraphs = brief.content.split(/\n\s*\n/).filter(Boolean);
  const first = paragraphs[0] ?? brief.content;
  const summary =
    first.length > 280 ? `${first.slice(0, 277).trimEnd()}…` : first;
  return (
    <div className={`generated-brief${brief.stale ? " brief-stale" : ""}`}>
      <div className="brief-provenance">
        <Badge tone={brief.provenance.mode === "live" ? "aqua" : "neutral"}>
          {brief.provenance.mode === "live"
            ? "AI-generated"
            : "Sample-mode brief"}
        </Badge>
        <span>{dateLabel(brief.createdAt)}</span>
        <span>
          {brief.contextDisclosure.responseCount} responses considered
        </span>
      </div>
      {brief.stale && (
        <Banner tone="warning">
          Work or teaching goals changed after this brief. Refresh it before
          using its suggestions.
        </Banner>
      )}
      <p className="brief-summary">{summary}</p>
      <div className="brief-action-grid">
        {brief.actions.slice(0, 3).map((action, index) => {
          const citation = brief.citations.find(
            (item) => item.id === action.citationId,
          );
          return (
            <article className="brief-action" key={action.id}>
              <span className="decision-number">0{index + 1}</span>
              <h3>{action.title}</h3>
              <p>{action.description}</p>
              {citation && (
                <div className="brief-action-source">
                  <span>Why this suggestion</span>
                  <p>{citation.excerpt}</p>
                  <Link href={citation.href}>
                    {citation.label} <ArrowRight size={13} />
                  </Link>
                </div>
              )}
              <div className="decision-card-actions">
                <Link href={action.href} className="text-link">
                  Review evidence <ArrowRight size={14} />
                </Link>
                <Link
                  href={assistantHref(
                    templateId,
                    `Expand this suggestion into a practical classroom activity: ${action.title}. ${action.description} Include time, steps, and a check for success, using the cited evidence.`,
                  )}
                  className="decision-ask"
                >
                  Ask a follow-up
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <details className="brief-full">
        <summary>Full explanation and sources</summary>
        <div className="brief-full-text">{brief.content}</div>
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
      <p className="brief-review-note">
        Suggestions are for your review. Teaching notes and lesson changes still
        need your approval.
      </p>
    </div>
  );
}

export function DecisionBrief({
  templateId,
  actions,
}: {
  templateId: string;
  actions: TeachingAction[];
}) {
  const { data, mutate } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"fixture" | "live">(
    data?.config.assistantLiveAvailable === false
      ? "fixture"
      : (data?.config.aiMode ?? "fixture"),
  );
  const retry = useRef<{
    templateId: string;
    mode: "fixture" | "live";
    requestId: string;
  } | null>(null);
  if (!data) return null;
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
  const cards = (
    <div className="decision-grid">
      {actions.map((action, index) => (
        <DataAction
          key={action.id}
          action={action}
          state={state}
          templateId={templateId}
          number={index + 1}
        />
      ))}
    </div>
  );
  return (
    <section
      className="teaching-decisions"
      aria-labelledby="teaching-decisions-title"
    >
      <div className="intelligence-heading">
        <div>
          <span className="intelligence-eyebrow">
            <Sparkles size={14} /> Your teaching brief
          </span>
          <h2 id="teaching-decisions-title">What to teach next</h2>
          <p>Turn the work in front of you into a clear next step.</p>
        </div>
        <div className="brief-generate-controls">
          <label className="field">
            <span>Insights</span>
            <Select
              aria-label="Teaching insights mode"
              value={mode}
              disabled={busy}
              onChange={(event) =>
                setMode(event.target.value as "fixture" | "live")
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
          </label>
          <Button disabled={busy} onClick={() => void generate()}>
            {busy ? <LoaderCircle className="spin" /> : <Sparkles />}
            {busy
              ? "Reading the evidence…"
              : brief
                ? "Refresh teaching insights"
                : "Generate teaching insights"}
          </Button>
        </div>
      </div>
      {state.assistant?.goals.text && (
        <div className="teaching-goal">
          <span>Your focus</span>
          <p>{state.assistant.goals.text}</p>
          <Link href="/assistant">Edit teaching goals</Link>
        </div>
      )}
      {error && (
        <div className="mb-16">
          <Banner tone="error">
            {error} You can still inspect the data-based suggestions below.
          </Banner>
        </div>
      )}
      {busy && (
        <p className="brief-loading" role="status">
          Connecting the selected work, reviewed notes, and your teaching goals.
          This may take a moment.
        </p>
      )}
      {brief ? (
        <>
          <GeneratedBrief brief={brief} templateId={templateId} />
          <details className="data-starting-points">
            <summary>
              Data-based starting points · {actions.length} suggested actions
            </summary>
            {cards}
          </details>
        </>
      ) : (
        <>
          <div className="starting-points-label">
            <span>Data-based starting points</span>
            <p>
              These follow the saved results. Generate a teaching brief to
              connect the evidence to a more specific approach.
            </p>
          </div>
          {cards}
        </>
      )}
    </section>
  );
}
