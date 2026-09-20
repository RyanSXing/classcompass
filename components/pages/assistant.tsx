"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUp, ArrowUpRight, LoaderCircle, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Textarea } from "@/components/ui/input";
import { AssistantAnswer } from "@/components/assistant-answer";
import { assignments } from "@/lib/assignments";
import { getAssignmentAnalytics } from "@/lib/analytics";
import { dateLabel } from "@/lib/utils";
import type {
  AssistantReplyResult,
  AssistantScope,
  TeacherGoals,
} from "@/lib/assistant-contracts";

const prompts = [
  "What should I teach next, and why?",
  "Who needs extra help? Show me the evidence.",
  "Plan a 12-minute small-group activity.",
  "What changed since the first assignment?",
];

function GoalsCard({ disabled }: { disabled: boolean }) {
  const { data, mutate, notify } = useWorkspace();
  const goals = data?.state.assistant?.goals;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftRevision, setDraftRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <section
      className="assistant-context-card"
      id="teacher-goals"
      aria-labelledby="teacher-goals-title"
    >
      <div className="teacher-goal-heading">
        <h2 id="teacher-goals-title">Your teaching goals</h2>
        {!editing && (
          <button
            className="text-link"
            disabled={disabled}
            onClick={() => {
              setDraft(goals?.text ?? "");
              setDraftRevision(goals?.revision ?? 0);
              setEditing(true);
              setError("");
            }}
          >
            {goals?.text ? "Edit goals" : "Add goals"}
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="teacher-goal-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            try {
              await mutate<TeacherGoals>(
                "/api/assistant/goals",
                { text: draft, expectedRevision: draftRevision },
                "PATCH",
              );
              setEditing(false);
              notify("Teaching goals saved.");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Couldn't save your goals.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="field">
            <span>What are you working toward?</span>
            <Textarea
              aria-label="Teaching goals"
              maxLength={4000}
              value={draft}
              disabled={saving || disabled}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="For example: Help students explain why fractions need equal-sized parts. Keep the October 2 assessment on schedule."
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="inline-actions">
            <Button size="sm" disabled={saving || disabled}>
              {saving ? "Saving…" : "Save goals"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={saving || disabled}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="teacher-goal-text">
          {goals?.text ||
            "Add your priorities so the assistant can plan around them."}
        </p>
      )}
    </section>
  );
}

function Conversation({
  initialPrompt,
  initialScope,
}: {
  initialPrompt: string;
  initialScope: AssistantScope;
}) {
  const { data, mutate, refresh } = useWorkspace();
  const [message, setMessage] = useState(initialPrompt);
  const [scope, setScope] = useState(initialScope);
  // Follow refreshed configuration until the teacher explicitly chooses a mode.
  const [selectedMode, setMode] = useState<"fixture" | "live" | null>(null);
  const mode = selectedMode ?? data?.config.aiMode ?? "fixture";
  const [busy, setBusy] = useState(false);
  const [observedAt, setObservedAt] = useState(() => Date.now());
  const [pendingMessage, setPendingMessage] = useState("");
  const [error, setError] = useState("");
  const [failedRequest, setFailedRequest] = useState<{
    requestId: string;
    message: string;
    scope: AssistantScope;
    mode: "fixture" | "live";
  } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const turns = data?.state.assistant?.turns ?? [];
  const pendingRequests =
    data?.state.assistant?.requests.some((r) => r.status === "pending") ??
    false;
  useEffect(() => {
    if (!pendingRequests) return;
    const timer = setInterval(() => setObservedAt(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [pendingRequests]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, busy]);
  if (!data) return null;
  const { state } = data;
  const totals = assignments.map((a) =>
    getAssignmentAnalytics(state, a.templateId),
  );
  const assignmentCount = totals.filter((a) => a.submittedStudents > 0).length;
  const responseCount = totals.reduce(
    (sum, a) => sum + a.slots.filter((s) => !!s.response).length,
    0,
  );
  const focusedAssignment = assignments.find(a => a.templateId === scope.templateId)
    ?? [...assignments].reverse().find(a => totals.find(result => result.assignment.templateId === a.templateId)?.submittedStudents)
    ?? assignments[0];
  const lessonId = scope.lessonId ?? focusedAssignment.targetLessonId;
  const lesson = state.plans.find(plan => plan.id === lessonId);
  const busyRequestVisible =
    pendingMessage &&
    !turns.some(
      (turn) =>
        turn.role === "user" && turn.requestId === failedRequest?.requestId,
    );
  async function send(retry = false) {
    if (busy || (!retry && !message.trim())) return;
    const input =
      retry && failedRequest
        ? failedRequest
        : {
            message: message.trim(),
            requestId: crypto.randomUUID(),
            scope,
            mode,
          };
    setBusy(true);
    setError("");
    setPendingMessage(input.message);
    setFailedRequest(input);
    if (retry) {
      setMode(input.mode);
      setScope(input.scope);
    }
    try {
      await mutate<AssistantReplyResult>("/api/assistant/chat", input);
      setMessage("");
      setFailedRequest(null);
      setPendingMessage("");
    } catch (e) {
      await refresh();
      setError(
        e instanceof Error
          ? e.message
          : "The assistant couldn't finish. Try again.",
      );
    } finally {
      setBusy(false);
      composer.current?.focus();
    }
  }
  function focusPrompt(prompt: string) {
    setMessage(prompt);
    setError("");
    composer.current?.focus();
  }
  const setFocus = (key: keyof AssistantScope, value: string) =>
    setScope((previous) => ({ ...previous, [key]: value || undefined }));
  return (
    <div className="page assistant-page">
      <div className="page-heading">
        <div>
          <h1>Classroom assistant</h1>
          <p>Ask about student work, your lessons, or what to teach next.</p>
        </div>
      </div>
      <div className="assistant-layout">
        <div className="assistant-main">
          <section
            className="assistant-conversation"
            aria-label="Classroom conversation"
          >
            <div className="assistant-conversation-head">
              <strong>Ask ClassCompass</strong>
              <label className="field">
                <span>Replies</span>
                <Select
                  aria-label="Assistant mode"
                  value={mode}
                  disabled={busy}
                  onChange={(e) => {
                    setMode(e.target.value as "fixture" | "live");
                    setError("");
                  }}
                >
                  <option value="fixture">Sample · no model call</option>
                  <option
                    value="live"
                    disabled={data.config.assistantLiveAvailable === false}
                  >
                    Live AI
                  </option>
                </Select>
              </label>
            </div>
            <div
              className="assistant-messages"
              role="log"
              aria-label="Messages"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {turns.length === 0 && !busy && (
                <div className="assistant-empty">
                  <div className="assistant-empty-icon">
                    <Sparkles size={23} />
                  </div>
                  <h2>Start with a teaching question.</h2>
                  <p>
                    I can use your classroom work, saved lessons, calendar and
                    goals. Answers include sources you can check.
                  </p>
                  <div className="assistant-prompts">
                    {prompts.map((prompt) => (
                      <button key={prompt} onClick={() => focusPrompt(prompt)}>
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map((turn) => {
                const request = state.assistant?.requests.find(
                  (item) => item.requestId === turn.requestId,
                );
                const expired =
                  request?.status === "pending" &&
                  Date.parse(request.startedAt) + 120000 <= observedAt;
                return (
                  <article
                    key={turn.id}
                    className={`chat-turn chat-turn-${turn.role}`}
                    aria-label={
                      turn.role === "user" ? "Your question" : "Assistant reply"
                    }
                  >
                    {turn.role === "assistant" && (
                      <div className="chat-turn-head">
                        <Sparkles size={15} />
                        <strong>ClassCompass</strong>
                        <Badge
                          tone={
                            turn.provenance?.mode === "live"
                              ? "aqua"
                              : "neutral"
                          }
                        >
                          {turn.provenance?.mode === "live"
                            ? "Live AI"
                            : "Sample reply"}
                        </Badge>
                      </div>
                    )}
                    <AssistantAnswer
                      content={turn.content}
                      citations={turn.citations}
                      actions={turn.actions}
                    />
                    {turn.role === "user" &&
                      (request?.status === "failed" || expired) && (
                        <p className="chat-request-status">
                          No answer was saved.{" "}
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() => {
                              setScope(turn.scope);
                              focusPrompt(turn.content);
                            }}
                          >
                            Ask again
                          </button>
                        </p>
                      )}
                    {turn.role === "user" &&
                      !busy &&
                      request?.status === "pending" &&
                      !expired && (
                        <p className="chat-request-status">
                          Answer pending.{" "}
                          <button
                            className="text-link"
                            onClick={() => void refresh()}
                          >
                            Check for answer
                          </button>
                        </p>
                      )}
                    {turn.role === "assistant" && (
                      <details className="chat-provenance">
                        <summary>Context used</summary>
                        <p>{turn.contextDisclosure?.text}</p>
                        <p>
                          {turn.provenance?.mode === "live"
                            ? turn.provenance.modelId
                            : "Sample reply based on the saved classroom. No live model call."}
                        </p>
                        <p>
                          Answered {new Date(turn.createdAt).toLocaleString()}.
                        </p>
                      </details>
                    )}
                  </article>
                );
              })}
              {busy && (
                <>
                  {busyRequestVisible && (
                    <article className="chat-turn chat-turn-user">
                      <div className="chat-turn-content">{pendingMessage}</div>
                    </article>
                  )}
                  <div className="assistant-wait" role="status">
                    <LoaderCircle className="spin" size={16} />
                    {mode === "live" ? "Asking Live AI and checking its sources…" : "Preparing a sample reply from saved data…"}
                  </div>
                </>
              )}
              <div ref={end} />
            </div>
            {error && (
              <div className="assistant-error" role="alert">
                <p>{error}</p>
                {failedRequest && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void send(true)}
                  >
                    Retry {failedRequest.mode === "live" ? "Live AI" : "sample"} answer
                  </Button>
                )}
              </div>
            )}
            <form
              className="assistant-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="assistant-message">
                Ask about your classroom
              </label>
              <textarea
                ref={composer}
                id="assistant-message"
                value={message}
                disabled={busy}
                maxLength={4000}
                placeholder="What should I do with Casey in the next lesson?"
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="assistant-composer-footer">
                <p>
                  {mode === "fixture"
                    ? "Sample replies use saved data. Choose Live AI to ask the model."
                    : "Live AI uses your classroom data. Review suggestions before using them."}
                </p>
                <Button disabled={busy || !message.trim()} type="submit">
                  <ArrowUp size={16} />
                  {busy ? "Thinking…" : mode === "live" ? "Ask Live AI" : "Get sample reply"}
                </Button>
              </div>
            </form>
          </section>
        </div>
        <aside className="assistant-side" aria-label="Assistant context">
          <GoalsCard disabled={busy} />
          <section
            className="assistant-context-card"
            aria-labelledby="assistant-context-title"
          >
            <h2 id="assistant-context-title">Classroom context</h2>
            <div className="assistant-context-stats">
              <div>
                <strong>{state.students.filter((s) => s.active).length}</strong>
                <span>students</span>
              </div>
              <div>
                <strong>{assignmentCount}</strong>
                <span>assignments</span>
              </div>
            </div>
            <p>
              {responseCount} answers, saved lessons, teacher reviews and the
              unit calendar.
            </p>
            <label className="field">
              <span>Focus on a student</span>
              <Select
                aria-label="Assistant student focus"
                disabled={busy}
                value={scope.studentId ?? ""}
                onChange={(e) => setFocus("studentId", e.target.value)}
              >
                <option value="">Whole class</option>
                {state.students
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="field">
              <span>Assignment</span>
              <Select
                aria-label="Assistant assignment focus"
                disabled={busy}
                value={scope.templateId ?? ""}
                onChange={(e) => setFocus("templateId", e.target.value)}
              >
                <option value="">All assignments</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.templateId}>
                    {a.title} · {dateLabel(a.date)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span>Lesson</span>
              <Select
                aria-label="Assistant lesson focus"
                disabled={busy}
                value={scope.lessonId ?? ""}
                onChange={(e) => setFocus("lessonId", e.target.value)}
              >
                <option value="">Next lesson</option>
                {state.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {dateLabel(p.date)} ·{" "}
                    {
                      state.planVersions.find(
                        (v) => v.id === p.currentVersionId,
                      )?.snapshot.title
                    }
                  </option>
                ))}
              </Select>
            </label>
            {lesson && (
              <p className="mt-16">
                <Link className="text-link" href={`/plans/${lesson.id}`}>
                  Open {dateLabel(lesson.date)} lesson <ArrowUpRight size={12} />
                </Link>
              </p>
            )}
            {lesson && (
              <p className="mt-16">
                <Link className="text-link" href={`/plans/${lesson.id}#lesson-suggestions`}>
                  Review lesson changes <ArrowUpRight size={12} />
                </Link>
              </p>
            )}
          </section>
          <p className="assistant-context-note">
            Suggestions stay in this conversation. You choose which teaching
            notes and lesson changes to approve.
          </p>
        </aside>
      </div>
    </div>
  );
}

function AssistantWithContext() {
  const search = useSearchParams();
  const initialPrompt = search.get("prompt")?.slice(0, 4000) ?? "";
  const initialScope: AssistantScope = {
    ...(search.get("student") ? { studentId: search.get("student")! } : {}),
    ...(search.get("assignment")
      ? { templateId: search.get("assignment")! }
      : {}),
    ...(search.get("lesson") ? { lessonId: search.get("lesson")! } : {}),
  };
  return (
    <Conversation
      key={search.toString()}
      initialPrompt={initialPrompt}
      initialScope={initialScope}
    />
  );
}
export function AssistantPage() {
  return (
    <PageGate>
      <Suspense
        fallback={<div className="loading-page">Opening the assistant…</div>}
      >
        <AssistantWithContext />
      </Suspense>
    </PageGate>
  );
}
