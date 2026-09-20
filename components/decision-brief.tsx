"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
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
import { LearningEvidence } from "./learning-evidence";
import { TeachingAction } from "./teaching-action";

export function assistantHref(templateId: string, prompt: string) {
  return `/assistant?${new URLSearchParams({ assignment: templateId, prompt })}`;
}

function GeneratedBrief({
  brief,
  templateId,
  handoff,
}: {
  brief: ClassroomBrief;
  templateId: string;
  handoff: React.ReactNode;
}) {
  const paragraphs = brief.content.split(/\n\s*\n/).filter(Boolean);
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
      <p className="brief-summary">{paragraphs[0] ?? brief.content}</p>
      {handoff}
      <div className="brief-action-grid">
        {brief.actions.slice(0, 3).map((action) => {
          const citation = brief.citations.find(
            (item) => item.id === action.citationId,
          );
          return (
            <article className="brief-action" key={action.id}>
              <h3>{action.title}</h3>
              <TeachingAction description={action.description} />
              <details className="learning-evidence">
                <summary>Show me why</summary>
                {citation && (
                  <>
                    <p>{citation.excerpt}</p>
                    <Link href={citation.href}>
                      {citation.label} <ArrowRight size={13} />
                    </Link>
                  </>
                )}
              </details>
              <Link
                href={assistantHref(
                  templateId,
                  `Plan this activity: ${action.title}. ${action.description} Use short steps, a time limit, and one check for understanding. Base it on the saved work.`,
                )}
                className="decision-ask"
              >
                Plan this activity <ArrowRight size={13} />
              </Link>
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
            <Sparkles size={14} /> Your teaching brief
          </span>
          <h2 id="teaching-decisions-title">
            {newerTemplateId
              ? "Teaching picture at this point"
              : "Your next lesson"}
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
          Refresh this briefing for the current learning insights and evidence.
        </Banner>
      )}
      {brief && !brief.stale ? (
        <GeneratedBrief
          brief={brief}
          templateId={templateId}
          handoff={handoff}
        />
      ) : (
        <div className="lesson-starting-point">
          <span className="starting-point-label">Based on the saved work</span>
          <h3>
            {saved
              ? "Your reviewed changes are saved"
              : (direction?.title ??
                "Check the work before changing the lesson")}
          </h3>
          <p>
            {saved ? nextStep.detail : (direction?.reason ?? learning.summary)}
          </p>
          {handoff}
          {direction && !saved && (
            <>
              <p className="lesson-direction-next">
                <strong>Try next:</strong> {direction.nextStep}
              </p>
              <details className="followup-steps">
                <summary>Teaching steps · {direction.minutes} min</summary>
                <ol>
                  {direction.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p>
                  <strong>Look for:</strong> {direction.successCheck}
                </p>
              </details>
              <LearningEvidence evidence={direction.evidence} state={state} />
            </>
          )}
        </div>
      )}
      {state.assistant?.goals.text && (
        <details className="brief-goal-details">
          <summary>Your teaching goal</summary>
          <p>{state.assistant.goals.text}</p>
          <Link href="/assistant" className="text-link">
            Edit goal
          </Link>
        </details>
      )}
      {brief?.stale && (
        <details className="brief-full">
          <summary>Earlier briefing</summary>
          <p className="brief-full-text">{brief.content}</p>
        </details>
      )}
    </section>
  );
}
