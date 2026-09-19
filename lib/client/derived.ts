import type { Finding } from "@/lib/contracts";

/** A later analysis retains old candidates as history; surface the current review set. */
export function currentFindings(findings: Finding[]) {
  return findings.filter(
    (f, index) =>
      f.status !== "stale" ||
      !findings.slice(index + 1).some(
        (next) =>
          next.id !== f.id &&
          next.batchId === f.batchId &&
          next.studentId === f.studentId &&
          next.objectiveId === f.objectiveId &&
          ["candidate", "confirmed"].includes(next.status),
      ),
  );
}
export function blockingWarnings(finding: Finding) {
  return finding.eligibilityWarnings.filter(
    (warning) =>
      warning !== "Acknowledge these source readings before confirmation.",
  );
}
