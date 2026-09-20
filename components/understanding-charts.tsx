"use client";
import { StudentAvatar } from "@/components/student-avatar";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type {
  UnderstandingOverview,
  UnderstandingStage,
} from "@/lib/understanding";
import { dateLabel } from "@/lib/utils";

type Skill = UnderstandingOverview["skills"][number];
type Student = UnderstandingOverview["students"][number];
type Cell = Student["skills"][number]["cells"][number];

export const stagePresentation: Record<
  UnderstandingStage,
  { label: string; symbol: string }
> = {
  needs_support: { label: "Needs support", symbol: "◇" },
  developing: { label: "Getting there", symbol: "◐" },
  independent: { label: "Works independently", symbol: "✓" },
  insufficient_evidence: { label: "Not enough evidence", symbol: "—" },
};

export function UnderstandingStageBadge({
  stage,
}: {
  stage: UnderstandingStage;
}) {
  return (
    <span className="understanding-stage-badge">
      <span className={`stage-mark stage-${stage}`} aria-hidden="true">
        {stagePresentation[stage].symbol}
      </span>
      <span>{stagePresentation[stage].label}</span>
    </span>
  );
}

export function ClassUnderstandingBars({
  skill,
  selectedTemplateId,
  onSelectDate,
}: {
  skill: Skill;
  selectedTemplateId: string;
  onSelectDate: (templateId: string) => void;
}) {
  const stages = Object.keys(stagePresentation) as UnderstandingStage[];
  return (
    <div>
      <div className="understanding-section-heading">
        <h3>How learning is developing</h3>
      </div>
      <div
        className="understanding-bars"
        role="group"
        aria-label="Class understanding by date"
      >
        {skill.snapshots.map((snapshot) => {
          const total = stages.reduce(
            (sum, stage) => sum + snapshot.counts[stage],
            0,
          );
          const description = stages
            .map(
              (stage) =>
                `${snapshot.counts[stage]} ${stagePresentation[stage].label.toLowerCase()}`,
            )
            .join(", ");
          return (
            <button
              key={snapshot.templateId}
              className="understanding-bar-row"
              aria-pressed={selectedTemplateId === snapshot.templateId}
              aria-label={`${dateLabel(snapshot.date)} · ${snapshot.title}: ${description}`}
              onClick={() => onSelectDate(snapshot.templateId)}
            >
              <span className="understanding-bar-date">
                {dateLabel(snapshot.date)}
              </span>
              <span className="understanding-bar" aria-hidden="true">
                {stages
                  .filter((stage) => snapshot.counts[stage] > 0)
                  .map((stage) => (
                    <span
                      key={stage}
                      className={`understanding-segment stage-${stage}`}
                      style={{ flexGrow: snapshot.counts[stage], flexBasis: 0 }}
                    >
                      {stagePresentation[stage].symbol} {snapshot.counts[stage]}
                    </span>
                  ))}
                {!total && <span>No students</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="understanding-chart-caption">
        Each bar is the class on that date. Numbers count students, not marks.
        Select a date to inspect the work.
      </p>
    </div>
  );
}

export function UnderstandingHeatmap({
  overview,
  skill,
  selectedStudentId,
  selectedTemplateId,
  onSelect,
}: {
  overview: UnderstandingOverview;
  skill: Skill;
  selectedStudentId: string;
  selectedTemplateId: string;
  onSelect: (studentId: string, templateId: string) => void;
}) {
  return (
    <div>
      <div className="understanding-section-heading">
        <h3>Every student, every check</h3>
        <p>Select a square</p>
      </div>
      <div className="understanding-heatmap-scroll">
        <table className="understanding-heatmap">
          <caption className="sr-only">
            {skill.label}: student understanding by date
          </caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              {skill.snapshots.map((snapshot) => (
                <th scope="col" key={snapshot.templateId}>
                  {dateLabel(snapshot.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overview.students.map((student) => {
              const cells =
                student.skills.find((item) => item.skillId === skill.id)
                  ?.cells ?? [];
              return (
                <tr key={student.studentId}>
                  <th scope="row"><span className="student-name-with-avatar"><StudentAvatar studentId={student.studentId} size={28} />{student.name}</span></th>
                  {skill.snapshots.map((snapshot) => {
                    const cell = cells.find(
                      (item) => item.templateId === snapshot.templateId,
                    );
                    const stage = cell?.stage ?? "insufficient_evidence";
                    return (
                      <td key={snapshot.templateId}>
                        <button
                          className={`understanding-cell stage-${stage}`}
                          aria-label={`${student.name}, ${dateLabel(snapshot.date)}: ${stagePresentation[stage].label}`}
                          aria-pressed={
                            selectedStudentId === student.studentId &&
                            selectedTemplateId === snapshot.templateId
                          }
                          onClick={() =>
                            onSelect(student.studentId, snapshot.templateId)
                          }
                        >
                          <span aria-hidden="true">
                            {stagePresentation[stage].symbol}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ObservationEvidence({
  cell,
  studentName,
}: {
  cell: Cell;
  studentName: string;
}) {
  const groups = [
    { label: "What supports this stage", evidence: cell.supportingEvidence },
    { label: "What still needs attention", evidence: cell.counterEvidence },
    { label: "Other work to check", evidence: cell.otherEvidence },
  ].filter((group) => group.evidence.length > 0);
  return (
    <details className="learning-evidence">
      <summary>Show me why</summary>
      {groups.length ? (
        groups.map((group) => (
          <div key={group.label} className="understanding-evidence-group">
            <h4>{group.label}</h4>
            <ul>
              {group.evidence.map((ref) => (
                <li
                  key={`${ref.responseId}:${ref.responseRevision}:${ref.observationId ?? "current"}`}
                >
                  <Link href={ref.href}>
                    {studentName} · {dateLabel(ref.activityDate)} · Q
                    {ref.questionNumber} <ArrowRight size={12} />
                  </Link>
                  <span>
                    {ref.support.level === "independent"
                      ? "Without help"
                      : ref.support.level === "supported"
                        ? "With help"
                        : "Help not recorded"}
                    {" · "}
                    {ref.readingReviewed
                      ? "Reading checked"
                      : "Reading not checked"}
                  </span>
                  <p>{ref.note}</p>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p>
          No usable work for this skill on this date. Collect a response before
          drawing a conclusion.
        </p>
      )}
    </details>
  );
}

export function StudentUnderstandingChart({
  student,
  skill,
  selectedTemplateId,
  onSelectDate,
  showProfileLink = true,
}: {
  student: Student;
  skill: Skill;
  selectedTemplateId?: string;
  showProfileLink?: boolean;
  onSelectDate?: (templateId: string) => void;
}) {
  const chartId = useId();
  const [chosenDate, setChosenDate] = useState<string>();
  const studentSkill = student.skills.find((item) => item.skillId === skill.id);
  if (!studentSkill) return null;
  const cells = studentSkill.cells;
  const selected =
    cells.find(
      (cell) => cell.templateId === (selectedTemplateId ?? chosenDate),
    ) ?? studentSkill.current;
  const selectDate = (templateId: string) => {
    setChosenDate(templateId);
    onSelectDate?.(templateId);
  };
  const width = 500;
  const start = 105;
  const end = 475;
  const x = (index: number) =>
    cells.length === 1
      ? (start + end) / 2
      : start + (index * (end - start)) / (cells.length - 1);
  const ys: Record<UnderstandingStage, number> = {
    independent: 28,
    developing: 78,
    needs_support: 128,
    insufficient_evidence: 184,
  };
  const description = cells
    .map(
      (cell) =>
        `${dateLabel(cell.date)}: ${stagePresentation[cell.stage].label}.`,
    )
    .join(" ");
  const title = `${student.name} · ${skill.label}`;
  return (
    <section
      className="understanding-student-detail"
      aria-labelledby={`${chartId}-heading`}
      tabIndex={-1}
    >
      <div className="understanding-student-heading">
        <div>
          <h3 id={`${chartId}-heading`} className="student-name-with-avatar"><StudentAvatar studentId={student.studentId} size={36} />{title}</h3>
          <p>Dated work, with the help conditions kept alongside it.</p>
        </div>
        {showProfileLink && <Link href={`/students/${student.studentId}`} className="text-link">
          Student profile <ArrowRight size={13} />
        </Link>}
      </div>
      <div className="understanding-path-layout">
        <div className="understanding-path">
          <svg
            viewBox={`0 0 ${width} 210`}
            role="img"
            aria-labelledby={`${chartId}-title ${chartId}-desc`}
          >
            <title id={`${chartId}-title`}>
              {student.name}’s understanding over time
            </title>
            <desc id={`${chartId}-desc`}>
              {description} Missing or unclear evidence is shown separately,
              with gaps in the line. Stages are not scores.
            </desc>
            {(
              [
                "independent",
                "developing",
                "needs_support",
              ] as UnderstandingStage[]
            ).map((stage) => (
              <g key={stage}>
                <line
                  x1={start}
                  x2={end}
                  y1={ys[stage]}
                  y2={ys[stage]}
                  className="understanding-gridline"
                />
                <text
                  x={94}
                  y={ys[stage] + 4}
                  textAnchor="end"
                  className="stage-axis"
                >
                  {stage === "independent"
                    ? "Independent"
                    : stagePresentation[stage].label}
                </text>
              </g>
            ))}
            <line
              x1={start}
              x2={end}
              y1={156}
              y2={156}
              className="understanding-gridline"
              strokeDasharray="4 4"
            />
            <text x={94} y={188} textAnchor="end" className="stage-axis">
              Not enough evidence
            </text>
            {cells.slice(1).map((cell, index) => {
              const previous = cells[index];
              if (
                cell.stage === "insufficient_evidence" ||
                previous.stage === "insufficient_evidence"
              )
                return null;
              return (
                <path
                  key={`${previous.id}:${cell.id}`}
                  d={`M ${x(index)} ${ys[previous.stage]} H ${x(index + 1)} V ${ys[cell.stage]}`}
                  className="understanding-line"
                  data-from-date={previous.templateId}
                  data-to-date={cell.templateId}
                />
              );
            })}
            {cells.map((cell, index) => (
              <g key={cell.id}>
                <circle
                  cx={x(index)}
                  cy={ys[cell.stage]}
                  r={cell.templateId === selected.templateId ? 8 : 6}
                  className={`understanding-point understanding-point-${cell.stage}${cell.templateId === selected.templateId ? " understanding-point-selected" : ""}`}
                />
                {cell.stage === "insufficient_evidence" && (
                  <text
                    x={x(index)}
                    y={ys[cell.stage] + 4}
                    textAnchor="middle"
                    style={{ fill: "white", fontWeight: 900 }}
                  >
                    –
                  </text>
                )}
              </g>
            ))}
          </svg>
          <div
            className="understanding-date-controls"
            role="group"
            aria-label={`${student.name}: select work date`}
          >
            {cells.map((cell) => (
              <button
                key={cell.id}
                aria-pressed={cell.templateId === selected.templateId}
                aria-label={`${student.name}, ${dateLabel(cell.date)}: inspect ${stagePresentation[cell.stage].label.toLowerCase()}`}
                onClick={() => selectDate(cell.templateId)}
              >
                {dateLabel(cell.date)}
              </button>
            ))}
          </div>
          <p className="understanding-chart-caption">
            The line links recorded stages, not a score. Different tasks and
            help can change what the work demonstrates.
          </p>
        </div>
        <div
          className="understanding-observation"
          role="region"
          aria-label={`${student.name}: selected work`}
        >
          <div className="understanding-observation-heading">
            <UnderstandingStageBadge stage={selected.stage} />
          </div>
          <div className="understanding-observation-meta">
            <span>{dateLabel(selected.date)}</span>
            <span>
              {selected.reviewStatus === "reviewed"
                ? "Readings checked"
                : selected.reviewStatus === "partly_reviewed"
                  ? "Some readings checked"
                  : "Readings not checked"}
            </span>
          </div>
          <p>{selected.reason}</p>
          <p className="understanding-next">
            <strong>Next:</strong> {selected.nextStep}
          </p>
          <ObservationEvidence
            key={`${selected.id}:${skill.id}`}
            cell={selected}
            studentName={student.name}
          />
          {selected.currentEvidenceCount > 0 && <Link className="text-link understanding-plan-check" href={`/assistant?${new URLSearchParams({student: student.studentId, assignment: selected.templateId, prompt: `Help me plan this check for ${student.name}: ${selected.nextStep} Use short steps and one way to check understanding. Use the saved work and explain if later work changes this suggestion.`})}`}>
            Plan this check <ArrowRight size={13} />
          </Link>}
        </div>
      </div>
    </section>
  );
}
