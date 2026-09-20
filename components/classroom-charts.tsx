"use client";

import { useId } from "react";
import { StudentAvatar } from "@/components/student-avatar";
import type {
  SkillClassSnapshot,
  UnderstandingOverview,
  UnderstandingStage,
} from "@/lib/understanding";
import { dateLabel } from "@/lib/utils";
import { stagePresentation } from "@/components/understanding-charts";

type Skill = UnderstandingOverview["skills"][number];

type Props = {
  overview: UnderstandingOverview;
  skill: Skill;
  selectedTemplateId: string;
  selectedStudentId: string;
  onSelectDate: (templateId: string) => void;
  onSelectStudent: (studentId: string, templateId: string) => void;
  onSelectSkill: (skillId: string) => void;
};

function snapshotFor(skill: Skill, templateId: string) {
  return (
    skill.snapshots.find((snapshot) => snapshot.templateId === templateId) ??
    skill.current
  );
}

function studentStage(
  overview: UnderstandingOverview,
  skillId: string,
  studentId: string,
  templateId: string,
): UnderstandingStage {
  return (
    overview.students
      .find((student) => student.studentId === studentId)
      ?.skills.find((studentSkill) => studentSkill.skillId === skillId)
      ?.cells.find((cell) => cell.templateId === templateId)?.stage ??
    "insufficient_evidence"
  );
}

function snapshotDescription(snapshot: SkillClassSnapshot) {
  return ([
    "needs_support",
    "developing",
    "independent",
    "insufficient_evidence",
  ] as UnderstandingStage[])
    .map(
      (stage) =>
        `${snapshot.counts[stage]} ${stagePresentation[stage].label.toLowerCase()}`,
    )
    .join(", ");
}

function namesFor(
  overview: UnderstandingOverview,
  ids: string[],
): string {
  const names = ids
    .map(
      (id) => overview.students.find((student) => student.studentId === id)?.name,
    )
    .filter(Boolean);
  return names.length ? names.join(", ") : "None";
}

function StudentStageBars({
  overview,
  skill,
  snapshot,
  selectedStudentId,
  onSelectStudent,
}: {
  overview: UnderstandingOverview;
  skill: Skill;
  snapshot: SkillClassSnapshot;
  selectedStudentId: string;
  onSelectStudent: Props["onSelectStudent"];
}) {
  const barsId = useId();
  const heightByStage: Record<UnderstandingStage, number> = {
    needs_support: 35,
    developing: 68,
    independent: 100,
    insufficient_evidence: 0,
  };
  return (
    <section className="classroom-chart-card classroom-stage-bars" aria-labelledby={`${barsId}-heading`}>
      <div className="classroom-chart-heading">
        <div>
          <span className="classroom-chart-kicker">Selected check</span>
          <h3 id={`${barsId}-heading`}>What this work shows</h3>
          <p>{dateLabel(snapshot.date)} · {snapshot.title}</p>
        </div>
        <span className="classroom-chart-note">Choose a student</span>
      </div>
      <div className="stage-bars-plot" role="group" aria-label={`${skill.label}: students by stage on ${dateLabel(snapshot.date)}`}>
        <div className="stage-bars-axis" aria-hidden="true">
          <span>Works independently</span>
          <span>Getting there</span>
          <span>Needs support</span>
        </div>
        <div className="stage-bars-list">
          {overview.students.map((student) => {
            const stage = studentStage(
              overview,
              skill.id,
              student.studentId,
              snapshot.templateId,
            );
            const isGap = stage === "insufficient_evidence";
            return (
              <button
                className={`stage-bar-person stage-bar-${stage}`}
                key={student.studentId}
                aria-pressed={student.studentId === selectedStudentId}
                aria-label={`${student.name}: ${stagePresentation[stage].label}. Select ${student.name}'s work from ${dateLabel(snapshot.date)}.`}
                onClick={() => onSelectStudent(student.studentId, snapshot.templateId)}
              >
                <span className="stage-bar-column" aria-hidden="true">
                  {isGap ? (
                    <span className="stage-bar-gap">?</span>
                  ) : (
                    <span
                      className="stage-bar-fill"
                      style={{ height: `${heightByStage[stage]}%` }}
                    />
                  )}
                </span>
                <StudentAvatar studentId={student.studentId} size={30} />
                <span className="stage-bar-name">{student.name}</span>
                <span className="stage-bar-stage">{stagePresentation[stage].label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="classroom-chart-caption">
        Select a student to see the work. Dashed columns need more evidence.
      </p>
    </section>
  );
}

function SkillRadar({
  overview,
  selectedTemplateId,
  skill,
  onSelectSkill,
}: {
  overview: UnderstandingOverview;
  selectedTemplateId: string;
  skill: Skill;
  onSelectSkill: Props["onSelectSkill"];
}) {
  const radarId = useId();
  const points = overview.skills.map((item, index) => {
    const snapshot = snapshotFor(item, selectedTemplateId);
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / overview.skills.length;
    const radius = 66;
    const unavailable =
      overview.students.length === 0 ||
      snapshot.counts.insufficient_evidence === overview.students.length;
    const ratio = overview.students.length && !unavailable
      ? snapshot.counts.independent / overview.students.length
      : 0;
    return {
      item,
      snapshot,
      x: 100 + Math.cos(angle) * radius * ratio,
      y: 100 + Math.sin(angle) * radius * ratio,
      outerX: 100 + Math.cos(angle) * radius,
      outerY: 100 + Math.sin(angle) * radius,
      unavailable,
      shortLabel:
        item.id === "obj-equivalent-fractions"
          ? "Equivalent"
          : item.id === "obj-add-unlike-fractions"
            ? "Addition"
            : "Explain & apply",
    };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  const allAssessed = points.every((point) => !point.unavailable);
  const connections = points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length];
    return point.unavailable || next.unavailable ? [] : [{ point, next }];
  });
  const selectedSnapshot = snapshotFor(skill, selectedTemplateId);
  return (
    <section className="classroom-chart-card classroom-radar" aria-labelledby={`${radarId}-heading`}>
      <div className="classroom-chart-heading">
        <div>
          <span className="classroom-chart-kicker">Across skills</span>
          <h3 id={`${radarId}-heading`}>Skills at a glance</h3>
          <p>Students working independently · {dateLabel(selectedSnapshot.date)}</p>
        </div>
      </div>
      <div className="radar-visual">
        <svg viewBox="0 0 200 200" role="img" aria-labelledby={`${radarId}-title ${radarId}-desc`}>
          <title id={`${radarId}-title`}>Students working independently by skill</title>
          <desc id={`${radarId}-desc`}>The three axes show the number of students whose work supports independent use of each skill. The list below gives the exact students and evidence gaps.</desc>
          {[.33, .66, 1].map((ratio) => (
            <polygon
              key={ratio}
              points={points.map((point) => `${100 + (point.outerX - 100) * ratio},${100 + (point.outerY - 100) * ratio}`).join(" ")}
              className="radar-grid"
            />
          ))}
          {points.map((point) => (
            <line key={point.item.id} x1="100" y1="100" x2={point.outerX} y2={point.outerY} className="radar-axis" />
          ))}
          {allAssessed && <polygon points={path} className="radar-area" />}
          {connections.map(({ point, next }) => (
            <line
              key={`${point.item.id}:${next.item.id}`}
              x1={point.x}
              y1={point.y}
              x2={next.x}
              y2={next.y}
              className="radar-connection"
            />
          ))}
          {points.map((point) =>
            point.unavailable ? (
              <rect
                key={point.item.id}
                x={point.outerX - 4.5}
                y={point.outerY - 4.5}
                width="9"
                height="9"
                rx="2"
                className="radar-gap"
                data-skill={point.item.id}
              />
            ) : (
              <circle key={point.item.id} cx={point.x} cy={point.y} r="4" className="radar-point" />
            ),
          )}
          <text x="100" y="97" textAnchor="middle" className="radar-count">0–{overview.students.length}</text>
          {points.map((point) => (
            <g key={`${point.item.id}-label`}>
              <text x={100 + (point.outerX - 100) * 1.13} y={100 + (point.outerY - 100) * 1.13} textAnchor="middle" className="radar-label">
                {point.unavailable ? "—" : point.snapshot.counts.independent}
              </text>
              <text x={100 + (point.outerX - 100) * 1.34} y={100 + (point.outerY - 100) * 1.34} textAnchor="middle" className="radar-skill-label">
                {point.shortLabel}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="radar-details" aria-label="Skill evidence details">
        {points.map(({ item, snapshot }) => {
          const independent = snapshot.studentIds.independent;
          const gaps = snapshot.studentIds.insufficient_evidence;
          const independentNames = namesFor(overview, independent);
          const gapNames = namesFor(overview, gaps);
          const unavailable =
            overview.students.length === 0 ||
            gaps.length === overview.students.length;
          return (
            <button
              key={item.id}
              className="radar-detail"
              aria-pressed={item.id === skill.id}
              aria-label={
                unavailable
                  ? `${item.label}: Not enough evidence for ${gaps.length} students. ${gapNames}.`
                  : `${item.label}: ${independent.length} of ${overview.students.length} students work independently (${independentNames}). ${gaps.length} need evidence (${gapNames}).`
              }
              title={
                unavailable
                  ? `${item.label}. Not enough evidence: ${gapNames}.`
                  : `${item.label}. Independently: ${independentNames}. Need evidence: ${gapNames}.`
              }
              onClick={() => onSelectSkill(item.id)}
            >
              <strong>{item.label}</strong>
              {unavailable ? (
                <span>Not enough evidence: {gaps.length}</span>
              ) : (
                <span>{independent.length} of {overview.students.length} independently</span>
              )}
              {!unavailable && gaps.length > 0 && <span>{gaps.length} need evidence</span>}
            </button>
          );
        })}
      </div>
      <p className="classroom-chart-caption">The shape is a quick comparison. Unassessed skills leave a gap.</p>
    </section>
  );
}

function LearningTrend({
  overview,
  skill,
  selectedTemplateId,
  onSelectDate,
}: {
  overview: UnderstandingOverview;
  skill: Skill;
  selectedTemplateId: string;
  onSelectDate: Props["onSelectDate"];
}) {
  const trendId = useId();
  const snapshots = skill.snapshots;
  const activeStudents = overview.students.length;
  const width = 680;
  const height = 210;
  const padding = { top: 24, right: 24, bottom: 34, left: 37 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const time = (snapshot: SkillClassSnapshot) => new Date(`${snapshot.date}T12:00:00Z`).getTime();
  const firstDate = time(snapshots[0]);
  const lastDate = time(snapshots.at(-1)!);
  const x = (index: number) =>
    snapshots.length === 1 || firstDate === lastDate
      ? padding.left + chartWidth / 2
      : padding.left + (chartWidth * (time(snapshots[index]) - firstDate)) / (lastDate - firstDate);
  const y = (count: number) => padding.top + chartHeight - (activeStudents ? (count / activeStudents) * chartHeight : 0);
  const known = (snapshot: SkillClassSnapshot) => snapshot.counts.insufficient_evidence < activeStudents;
  const segments: Array<{ from: SkillClassSnapshot; to: SkillClassSnapshot; fromIndex: number; toIndex: number }> = [];
  snapshots.slice(1).forEach((snapshot, index) => {
    const previous = snapshots[index];
    if (known(previous) && known(snapshot)) segments.push({ from: previous, to: snapshot, fromIndex: index, toIndex: index + 1 });
  });
  const selected = snapshotFor(skill, selectedTemplateId);
  return (
    <section className="classroom-chart-card classroom-trend" aria-labelledby={`${trendId}-heading`}>
      <div className="classroom-chart-heading">
        <div>
          <span className="classroom-chart-kicker">Across the unit</span>
          <h3 id={`${trendId}-heading`}>Learning over time</h3>
          <p>{skill.label} · students working independently</p>
        </div>
        <strong className="trend-current">
          {selected.counts.insufficient_evidence === activeStudents
            ? "Needs evidence"
            : `${selected.counts.independent} of ${activeStudents}`}
        </strong>
      </div>
      <div className="trend-visual">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${trendId}-title ${trendId}-desc`}>
          <title id={`${trendId}-title`}>{skill.label}: students working independently over time</title>
          <desc id={`${trendId}-desc`}>{snapshots.map((snapshot) => `${dateLabel(snapshot.date)}: ${known(snapshot) ? `${snapshot.counts.independent} of ${activeStudents} students work independently` : "not enough evidence for the class"}`).join(". ")}. Gaps are not treated as zero.</desc>
          {[0, activeStudents].map((value) => (
            <g key={value}>
              <line x1={padding.left} y1={y(value)} x2={width - padding.right} y2={y(value)} className="trend-grid" />
              <text x={padding.left - 8} y={y(value) + 4} textAnchor="end" className="trend-axis-label">{value}</text>
            </g>
          ))}
          {segments.map(({ from, to, fromIndex, toIndex }) => (
            <path
              key={`${from.templateId}:${to.templateId}`}
              d={`M ${x(fromIndex)} ${y(from.counts.independent)} L ${x(toIndex)} ${y(to.counts.independent)} L ${x(toIndex)} ${height - padding.bottom} L ${x(fromIndex)} ${height - padding.bottom} Z`}
              className="trend-area"
              data-from-date={from.templateId}
              data-to-date={to.templateId}
            />
          ))}
          {segments.map(({ from, to, fromIndex, toIndex }) => (
            <line key={`${from.templateId}:${to.templateId}:line`} x1={x(fromIndex)} y1={y(from.counts.independent)} x2={x(toIndex)} y2={y(to.counts.independent)} className="trend-line" data-from-date={from.templateId} data-to-date={to.templateId} />
          ))}
          {snapshots.map((snapshot, index) => (
            <g key={snapshot.templateId}>
              {known(snapshot) ? (
                <circle cx={x(index)} cy={y(snapshot.counts.independent)} r={snapshot.templateId === selected.templateId ? 7 : 5} className={`trend-point${snapshot.templateId === selected.templateId ? " trend-point-selected" : ""}`} />
              ) : (
                <rect x={x(index) - 6} y={height - padding.bottom - 13} width="12" height="12" rx="2" className="trend-gap" />
              )}
              <text x={x(index)} y={height - 10} textAnchor="middle" className="trend-date">{dateLabel(snapshot.date)}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="trend-date-buttons" role="group" aria-label="Class understanding by date">
        {snapshots.map((snapshot) => {
          const isGap = !known(snapshot);
          return (
            <button
              key={snapshot.templateId}
              aria-pressed={snapshot.templateId === selected.templateId}
              aria-label={`${dateLabel(snapshot.date)} · ${snapshot.title}: ${snapshotDescription(snapshot)}`}
              onClick={() => onSelectDate(snapshot.templateId)}
            >
              <strong>{dateLabel(snapshot.date)}</strong>
              <span>{isGap ? "Evidence gap" : `${snapshot.counts.independent} independent`}</span>
            </button>
          );
        })}
      </div>
      <p className="classroom-chart-caption">Select a date to see the work. Gaps mean more evidence is needed.</p>
    </section>
  );
}

export function ClassroomCharts({
  overview,
  skill,
  selectedTemplateId,
  selectedStudentId,
  onSelectDate,
  onSelectStudent,
  onSelectSkill,
}: Props) {
  const snapshot = snapshotFor(skill, selectedTemplateId);
  return (
    <div className="classroom-charts">
      <div className="classroom-charts-top">
        <StudentStageBars overview={overview} skill={skill} snapshot={snapshot} selectedStudentId={selectedStudentId} onSelectStudent={onSelectStudent} />
        <SkillRadar overview={overview} selectedTemplateId={snapshot.templateId} skill={skill} onSelectSkill={onSelectSkill} />
      </div>
      <LearningTrend overview={overview} skill={skill} selectedTemplateId={snapshot.templateId} onSelectDate={onSelectDate} />
    </div>
  );
}
