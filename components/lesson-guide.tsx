"use client";
import { Printer, ArrowDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LessonTimeline, lessonStageId } from "@/components/lesson-timeline";
import type { GuideBlock, GuideLane, GuideTask, LessonGuide as TeacherGuide } from "@/lib/lesson-guide";
import { dateLabel } from "@/lib/utils";
import "@/app/lesson-guide.css";

function Tasks({ tasks, title = "Student task · teacher answers" }: { tasks: GuideTask[]; title?: string }) {
  if (!tasks.length) return null;
  return <div className="lg-tasks"><h4>{title}</h4><ol>{tasks.map(task => <li key={task.id}>
    <p>{task.prompt}</p><p className="lg-answer"><strong>Expected:</strong> {task.answer}</p>
  </li>)}</ol></div>;
}
function Materials({ materials, missingMaterialIds }: Pick<GuideLane, "materials" | "missingMaterialIds">) {
  if (!materials.length && !missingMaterialIds.length) return null;
  return <details className="lg-details lg-material-details"><summary>Activities and answers</summary><div className="lg-details-body">
    {materials.map(material => <div className="lg-saved-material" key={material.id}>
      <Tasks tasks={material.tasks} title={material.title} />
      {material.conditions && <p className="lg-condition">{material.conditions}</p>}
      {material.teacherPrompts.length > 0 && <p className="lg-prompt"><strong>Ask:</strong> {material.teacherPrompts.join(" ")}</p>}
    </div>)}
    {missingMaterialIds.length > 0 && <p className="lg-caution">The saved material {missingMaterialIds.join(", ")} is unavailable. Refer to the saved instructions; no replacement task has been assumed.</p>}
  </div></details>;
}
function Block({ block, index }: { block: GuideBlock; index: number }) {
  const support = block.support;
  const firstQuestion = support?.questions[0];
  const extraQuestions = support?.questions.slice(1) ?? [];
  const hasDetails = support && (support.moves.length > 0 || support.workedExample || extraQuestions.length > 0 || support.tasks.length > 0);
  return <section className="lg-block" id={lessonStageId(block.blockId)} aria-labelledby={`guide-block-${block.blockId}`} tabIndex={-1}>
    <header className="lg-block-heading">
      <span className="lg-block-number" aria-hidden="true">{index + 1}</span>
      <div><p className="lg-block-range">{block.startMinute}–{block.endMinute} min</p><h3 id={`guide-block-${block.blockId}`}>{block.title}</h3></div>
      <span className="lg-block-duration">{block.minutes} min{block.mode === "concurrent" ? " · groups" : ""}</span>
    </header>
    <div className="lg-block-content">
      <div className={`lg-teaching-cues${firstQuestion || support?.collect ? "" : " lg-do-only"}`}>
        <div className="lg-cue lg-do"><h4>Do</h4><p className="lg-saved-instructions">{block.savedInstructions}</p>
          {block.custom && <p className="lg-origin">Saved instructions{block.lanes.length ? " and groups" : ""} · unchanged</p>}
        </div>
        {firstQuestion && <div className="lg-cue lg-ask"><h4>Ask</h4><p>“{firstQuestion.prompt}”</p></div>}
        {(firstQuestion || support?.collect) && <div className="lg-cue lg-check"><h4>Check</h4>
          {firstQuestion && <p>{firstQuestion.expectedResponse}</p>}
          {support?.collect && <p className="lg-collect"><strong>Collect & notice:</strong> {support.collect}</p>}
        </div>}
      </div>
      {hasDetails && <details className="lg-details lg-teaching-details"><summary>{support.workedExample ? "Worked example & teaching notes" : "Teaching notes & practice"}</summary><div className="lg-details-body">
        {support.moves.length > 0 && <><h4>Teaching moves</h4><ul className="lg-moves">{support.moves.map(move => <li key={move}>{move}</li>)}</ul></>}
        {support.workedExample && <div className="lg-worked-example">
          <h4>Worked example</h4><p>{support.workedExample.prompt}</p>
          <ol>{support.workedExample.steps.map(step => <li key={step}>{step}</li>)}</ol>
          {support.workedExample.comparison && <p className="lg-comparison">{support.workedExample.comparison}</p>}
        </div>}
        {extraQuestions.map(question => <div className="lg-question" key={question.prompt}><p><strong>Ask:</strong> “{question.prompt}”</p><p><strong>Listen for:</strong> {question.expectedResponse}</p></div>)}
        <Tasks tasks={support.tasks} />
      </div></details>}
      {block.lanes.length > 0 && <div className="lg-lanes">{block.lanes.map(lane => <section className="lg-lane" key={lane.id}>
        <h4>{lane.title} <span>{lane.teacherLed ? "With teacher" : "Independent"} · {lane.minutes} min</span></h4>
        <p className="lg-names">{lane.students.map(student => student.name).join(", ") || "No students assigned in this saved version"}</p>
        <p>{lane.savedInstructions}</p>
        {lane.entryCheckStudents.length > 0 && <p className="lg-condition"><strong>Independent entry check:</strong> {lane.entryCheckStudents.map(student => student.name).join(", ")}. Collect an attempt before supplying hints; record any help actually given.</p>}
        <Materials materials={lane.materials} missingMaterialIds={lane.missingMaterialIds} />
      </section>)}</div>}
      <Materials materials={block.materials} missingMaterialIds={block.missingMaterialIds} />
    </div>
  </section>;
}

/** A teacher copy; existing Materials screens remain the student-printing surface. */
export function LessonGuide({ guide }: { guide: TeacherGuide }) {
  return <article className="lesson-guide" aria-labelledby="lesson-guide-title">
    <header className="lg-header">
      <div><p className="lg-eyebrow">Teacher copy · Grade 5 mathematics</p><h2 id="lesson-guide-title">Lesson plan</h2><p className="lg-print-title">{guide.title}</p><p className="lg-meta">{dateLabel(guide.date, { weekday: "long", month: "long", day: "numeric" })} · {guide.totalMinutes} minutes · Saved version {guide.versionNumber}</p></div>
      <div className="lg-actions no-print"><Button variant="outline" onClick={() => window.print()}><Printer />Print teacher plan</Button><a className="text-link" href="#lesson-suggestions">Review suggestions <ArrowDown size={14} /></a></div>
    </header>
    <LessonTimeline blocks={guide.sequence} totalMinutes={guide.totalMinutes} />
    <section className="lg-intention"><h3>Learning intention</h3><ul>{guide.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul></section>
    <details className="lg-details lg-preparation"><summary>Success criteria & preparation</summary><div className="lg-details-body">
      <div className="lg-overview">
        <section>{guide.successCriteria.length > 0 && <><h3>Success criteria</h3><ul>{guide.successCriteria.map(criterion => <li key={criterion}>{criterion}</li>)}</ul></>}</section>
        <section><h3>Before the lesson</h3><ul>{guide.preparation.map(item => <li key={item}>{item}</li>)}</ul>{guide.materials.length > 0 && <p className="lg-material-list"><strong>Have ready:</strong> {guide.materials.join("; ")}.</p>}
          {guide.studentDownloads.map(download => <a className="text-link no-print" href={download.href} key={download.href} target="_blank" rel="noreferrer">{download.title} <ExternalLink size={13} /></a>)}
          {guide.materialsHref && <p className="no-print"><Link className="text-link" href={guide.materialsHref}>Open separate student activities and teacher keys</Link></p>}
        </section>
      </div>
      {guide.vocabulary.length > 0 && <dl className="lg-vocabulary">{guide.vocabulary.map(word => <div key={word.term}><dt>{word.term}</dt><dd>{word.meaning}</dd></div>)}</dl>}
    </div></details>
    <p className="lg-source-note">Saved instructions with authored teaching notes. Teacher copy includes answers and saved group names.</p>
    <div className="lg-sequence">{guide.sequence.map((block, index) => <Block key={block.blockId} block={block} index={index} />)}</div>
    {guide.nextSteps.length > 0 && <details className="lg-details lg-next"><summary>After the exit check</summary><div className="lg-details-body"><p>Use the observed step and the help given to decide what to check next.</p><dl>{guide.nextSteps.map(item => <div key={item.observation}><dt>{item.observation}</dt><dd>{item.action}</dd></div>)}</dl><p className="lg-deadline">Unit assessment remains {dateLabel(guide.assessmentDate, { month: "long", day: "numeric" })}. A short support check does not automatically delay the class.</p></div></details>}
    <details className="lg-provenance no-print"><summary>Sources and evidence for this version</summary><p>{guide.disclosure}</p>
      {guide.source ? <p><a className="text-link" href={guide.source.href} target="_blank" rel="noreferrer">{guide.source.label} <ExternalLink size={14} /></a></p> : <p>No original source file is attached to this version.</p>}
      {guide.rationale.length > 0 ? <><h3>Why these changes were saved</h3>{guide.rationale.map((item, index) => <p key={index}>{item.text} <span className="lg-origin">({item.mode === "fixture" ? "Prepared sample suggestion" : "Live model suggestion"}{item.teacherEdited ? ", edited by teacher" : ""}; saved by teacher)</span></p>)}</> : <p>No model-suggested changes were saved in this version.</p>}
      {guide.evidence.length > 0 && <><h3>Evidence used for this saved version</h3><p>Open the exact reading retained with the saved lesson.</p><div className="lg-evidence-links">{guide.evidence.map(item => item.href ? <Link className="text-link" href={item.href} key={`${item.ref.responseId}:${item.ref.responseRevision}`}>{item.label}</Link> : <span key={`${item.ref.responseId}:${item.ref.responseRevision}`}>{item.label} · unavailable</span>)}</div></>}
    </details>
    <footer className="lg-footer">ClassCompass · Teacher plan · Version {guide.versionNumber} · Authored guidance and saved instructions</footer>
  </article>;
}
