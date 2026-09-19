import type { AppState } from "@/lib/contracts";
export function assignmentHref(state: AppState, templateId: string, filters: Record<string, string | undefined> = {}) {
  const batch = state.batches.filter(b => b.templateId === templateId && (!filters.student || state.submissions.some(s=>s.batchId===b.id && s.studentId===filters.student))).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  if (!batch) return `/classroom?upload=work&assignment=${encodeURIComponent(templateId)}`;
  const params = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string,string] => !!entry[1]));
  return `/review/${batch.id}${params.size ? `?${params}` : ""}`;
}
export const supportLabels = { independent: "Independent", supported: "With help", unknown: "Help not recorded" };
export const nextStepLabels: Record<string,string> = {targeted_equal_parts:"Practice equal-sized parts",extension:"Try an extension task",independent_application:"Continue independent practice",independent_check:"Check without help",gather_evidence:"Collect more work"};
