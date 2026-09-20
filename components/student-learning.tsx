"use client";
import { useState } from "react";
import Link from "next/link";
import { dateLabel } from "@/lib/utils";
import type { AppState } from "@/lib/contracts";
import { getUnderstandingOverview } from "@/lib/understanding";
import { StudentUnderstandingChart } from "./understanding-charts";
import { Select } from "./ui/input";
import { Card } from "./ui/card";

export function StudentLearning({state, studentId, templateId}: {state: AppState; studentId: string; templateId: string}) {
  const [skillId, setSkillId] = useState("obj-add-unlike-fractions");
  const overview = getUnderstandingOverview(state, templateId);
  const student = overview.students.find(item => item.studentId === studentId);
  const skill = overview.skills.find(item => item.id === skillId) ?? overview.skills[0];
  if (!student || !skill) return null;
  return <Card className="student-visual-progress">
    <div className="student-progress-header">
      <div><h2>Understanding over time</h2><p className="student-progress-scope">
        <span>Work through {dateLabel(overview.throughDate)}</span>
        {state.batches.some(batch => batch.activityDate > overview.throughDate) && <Link className="text-link" href={`/students/${studentId}`}>View all dates</Link>}
      </p></div>
      <label className="field"><span>Skill</span><Select aria-label="Understanding skill" value={skill.id} onChange={event => setSkillId(event.target.value)}>
        {overview.skills.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
      </Select></label>
    </div>
    <StudentUnderstandingChart student={student} skill={skill} showProfileLink={false} />
    <details className="learning-limits"><summary>How stages are decided</summary><ul>{overview.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></details>
  </Card>;
}
