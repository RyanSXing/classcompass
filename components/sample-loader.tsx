"use client";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/shared";
import { useWorkspace } from "@/components/workspace-provider";
import { assignments } from "@/lib/assignments";
import { api } from "@/lib/client/api";
export function SampleLoader() {
  const { refresh, notify } = useWorkspace();
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      for (const [index, assignment] of assignments.entries()) {
        setProgress(
          `${index + 1} of ${assignments.length}: ${assignment.title} — loading work…`,
        );
        const result = await api<{ batchId: string; prepared: boolean }>(
          "/api/demo/load",
          { templateId: assignment.templateId },
        );
        setProgress(
          `${index + 1} of ${assignments.length}: ${assignment.title} — adding prepared results…`,
        );
        if (result.prepared)
          await api("/api/demo/analyze", { batchId: result.batchId });
        await refresh();
      }
      notify("Sample assignments loaded. Existing work kept.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Loading stopped. Try again to continue.",
      );
      await refresh();
    } finally {
      setProgress("");
    }
  }
  return (
    <div>
      {progress ? (
        <div className="loading-progress" role="status">
          <LoaderCircle size={18} className="spin" />
          {progress}
        </div>
      ) : (
        <Button variant="outline" onClick={() => void load()}>
          Load sample class
        </Button>
      )}
      {error && (
        <div className="mt-16">
          <Banner tone="error">
            {error} Saved work is kept. Load again to continue.
          </Banner>
        </div>
      )}
    </div>
  );
}
