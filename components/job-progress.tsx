"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play, Pause, X, RefreshCw } from "lucide-react";
import type { Job } from "@/lib/contracts";
import { useWorkspace } from "@/components/workspace-provider";
import { api, ApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared";

export function JobProgress({
  job,
  autoStart = false,
}: {
  job: Job;
  autoStart?: boolean;
}) {
  const { refresh, notify } = useWorkspace();
  const [running, setRunning] = useState(autoStart);
  const [localError, setLocalError] = useState("");
  const active = useRef(false);
  const current = useRef(job);
  current.current = job;
  useEffect(() => {
    if (!running) return;
    let stopped = false;
    active.current = true;
    async function advance() {
      while (!stopped && active.current) {
        const j = current.current;
        if (
          ["completed", "failed", "cancelled", "blocked"].includes(j.status)
        ) {
          setRunning(false);
          break;
        }
        try {
          await api(`/api/jobs/${j.id}/run-next`, {});
          await refresh();
        } catch (e) {
          if (e instanceof ApiError && e.retryAfterSeconds) {
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                Math.min(e.retryAfterSeconds ?? 5, 15) * 1000,
              ),
            );
            continue;
          }
          setLocalError(e instanceof Error ? e.message : "Analysis paused.");
          setRunning(false);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    void advance();
    return () => {
      stopped = true;
      active.current = false;
    };
  }, [running, job.id, refresh]);
  const done = job.steps.filter((s) => s.status === "completed").length;
  const step = job.steps.find((s) => s.status !== "completed");
  const labels = {
    extract: "Reading worksheet responses",
    analyze: "Connecting evidence to findings",
    propose: "Preparing your lesson changes",
  };
  if (job.status === "completed") return null;
  return (
    <div className="job-panel" aria-live="polite">
      <div className="job-title">
        <div>
          <h3>
            {running ? (
              <>
                <LoaderCircle
                  size={18}
                  className="spin"
                  style={{ display: "inline", marginRight: 8 }}
                />
                {step ? labels[step.kind] : "Finishing up"}
              </>
            ) : (
              "Your analysis is saved"
            )}
          </h3>
          <p className="text-small muted" style={{ marginTop: 6 }}>
            {running
              ? "Keep this page open while the remaining steps run."
              : "Resume here whenever you’re ready. Completed work stays saved."}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className="progress-track">
        <div
          style={{ width: `${(done / Math.max(1, job.steps.length)) * 100}%` }}
        />
      </div>
      <div className="job-meta">
        <span>
          {done} of {job.steps.length} steps complete
        </span>
        <span>{step?.attempts ? `Attempt ${step.attempts}` : ""}</span>
      </div>
      {(job.error || localError) && (
        <div className="job-error">{job.error || localError}</div>
      )}
      <div className="inline-actions mt-16">
        {running ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              active.current = false;
              setRunning(false);
            }}
          >
            <Pause />
            Pause after this step
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={job.status === "cancelled"}
            onClick={async () => {
              setLocalError("");
              if (["failed", "blocked"].includes(job.status)) {
                try {
                  await api(`/api/jobs/${job.id}/retry`, {});
                  await refresh();
                } catch (e) {
                  notify(
                    e instanceof Error ? e.message : "Retry unavailable",
                    true,
                  );
                  return;
                }
              }
              setRunning(true);
            }}
          >
            {["failed", "blocked"].includes(job.status) ? (
              <RefreshCw />
            ) : (
              <Play />
            )}
            {["failed", "blocked"].includes(job.status)
              ? "Retry analysis"
              : "Resume analysis"}
          </Button>
        )}
        {!["cancelled", "failed"].includes(job.status) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              active.current = false;
              setRunning(false);
              await api(`/api/jobs/${job.id}/cancel`, {});
              await refresh();
            }}
          >
            <X />
            Cancel processing
          </Button>
        )}
      </div>
    </div>
  );
}
