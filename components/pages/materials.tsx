"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Printer,
  FileText,
  ArrowLeft,
  Sprout,
  ClipboardCheck,
  KeyRound,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import {
  PageGate,
  PageHeading,
  EmptyState,
  Banner,
  FractionBars,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { dateLabel } from "@/lib/utils";
function MaterialsContent({ planVersionId }: { planVersionId: string }) {
  const { data } = useWorkspace();
  const [selected, setSelected] = useState("");
  const [keys, setKeys] = useState(false);
  if (!data) return null;
  const { state } = data;
  const version = state.planVersions.find((v) => v.id === planVersionId);
  const materialSet = state.materialSets.find(
    (m) => m.planVersionId === planVersionId,
  );
  const material =
    materialSet?.materials.find((m) => m.id === selected) ??
    materialSet?.materials[0];
  const newer =
    version &&
    state.plans.find((p) => p.id === version.lessonId)?.currentVersionId !==
      version.id;
  const stale = version?.evidence.some(
    (ref) =>
      state.responses.find((r) => r.id === ref.responseId)?.revision !==
      ref.responseRevision,
  );
  if (!version || !materialSet || !material)
    return (
      <div className="page">
        <PageHeading
          title="Teaching materials"
          description="Choose a saved lesson to print its activities and answer keys."
        />
        <Card>
          <EmptyState
            title="Save lesson changes first"
            text="Save your chosen lesson changes to prepare student activities and answer keys."
            action={
              <Button asChild>
                <Link
                  href={`/plans/${version?.lessonId ?? "lesson-2026-09-23"}`}
                >
                  Open lesson plan
                </Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  return (
    <div className="page">
      <PageHeading
        title="Teaching materials"
        description={`Materials for ${dateLabel(version.snapshot.date)} · Saved lesson version ${version.versionNumber}`}
        breadcrumb="Teaching materials"
      >
        <Button variant="outline" asChild>
          <Link href={`/plans/${version.lessonId}`}>
            <ArrowLeft />
            Back to lesson
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          {keys ? "Print teacher key" : "Print student activity"}
        </Button>
      </PageHeading>
      {(newer || stale) && (
        <div className="mb-16 no-print">
          <Banner tone="warning">
            {newer
              ? "A newer saved lesson version is available."
              : "New evidence has changed since this lesson was accepted."}{" "}
            These historical materials stay attached to version{" "}
            {version.versionNumber}. Review the current lesson before teaching.
          </Banner>
        </div>
      )}
      <div className="material-layout">
        <aside className="material-selector">
          {materialSet.materials.map((m) => {
            const Icon = m.id.includes("extension")
              ? Sprout
              : m.id.includes("followup")
                ? ClipboardCheck
                : FileText;
            return (
              <button
                className={`material-tab ${m.id === material.id && !keys ? "active" : ""}`}
                key={m.id}
                aria-pressed={m.id === material.id && !keys}
                onClick={() => {
                  setSelected(m.id);
                  setKeys(false);
                }}
              >
                <Icon />
                <span>
                  <strong>{m.title}</strong>
                  <small>{m.suggestedMinutes} minutes · Student activity</small>
                </span>
              </button>
            );
          })}
          <button
            className={`material-tab ${keys ? "active" : ""}`}
            onClick={() => setKeys(true)}
            aria-pressed={keys}
          >
            <KeyRound />
            <span>
              <strong>Teacher guidance</strong>
              <small>Answers and teaching notes</small>
            </span>
          </button>
          <div
            className="material-context"
            style={{ gridColumn: "1/-1", padding: "12px 4px" }}
          >
            <p className="text-small muted">
              Student pages leave out names, diagnostic labels and answer keys.
              Printing opens your browser’s Print / Save PDF window.
            </p>
            <Badge tone="green" style={{ marginTop: 13 }}>
              Saved version {version.versionNumber}
            </Badge>
          </div>
        </aside>
        <div className="print-preview">
          <article className="print-sheet">
            <div className="sheet-brand">
              CLASSCOMPASS{" "}
              <span style={{ float: "right" }}>GRADE 5 · MATHEMATICS</span>
            </div>
            <h1>{keys ? `${material.title} · Teacher key` : material.title}</h1>
            <div className="sheet-name">
              <span>{keys ? "Teacher copy" : "Name: "}</span>
              <span>Date: </span>
            </div>
            <p className="directions">
              {keys
                ? "Use these answers and prompts alongside the activity. Equivalent fractions and valid alternative methods are welcome."
                : `${/followup|entry-check|exit/.test(material.id) ? "Work independently. " : ""}Show your thinking with a drawing or a calculation. Use equal-sized wholes and label the parts.`}
            </p>
            {keys && (material.scaffolds || material.conditions) && (
              <section className="print-question">
                <h3>Preparation and support</h3>
                {material.scaffolds && (
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    {material.scaffolds}
                  </p>
                )}
                {material.conditions && (
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    {material.conditions}
                  </p>
                )}
              </section>
            )}
            {material.id.includes("targeted") && !keys && (
              <div>
                <p style={{ fontSize: 12 }}>
                  Equal-sized wholes. What do you notice about the shaded parts?
                </p>
                <div className="fraction-visual">
                  <FractionBars a={1} b={2} />
                  <span>=</span>
                  <FractionBars a={3} b={6} />
                </div>
              </div>
            )}
            {material.prompts.map((q, index) => (
              <section className="print-question" key={q.id}>
                <h3>
                  {index + 1}. {q.prompt}
                </h3>
                {keys ? (
                  <div className="print-key">
                    <strong>Teacher answer: </strong>
                    {q.answerKey}
                    {q.requiresTeacherReview && (
                      <p style={{ marginTop: 7 }}>
                        Review the explanation; valid methods may differ from
                        this example.
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    className="working-space"
                    aria-label="Space for student working"
                  />
                )}
              </section>
            ))}
            {keys && material.teacherPrompts && (
              <div className="print-question">
                <h3>Prompts for discussion</h3>
                <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
                  {material.teacherPrompts.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {keys && material.note && (
              <p style={{ fontSize: 12, marginTop: 15 }}>{material.note}</p>
            )}
            <footer className="sheet-footer">
              {keys
                ? "Teacher guidance · Keep separate from student pages"
                : "Make your thinking visible. Different valid methods are welcome."}
              <span style={{ float: "right" }}>ClassCompass</span>
            </footer>
          </article>
        </div>
      </div>
      {keys && (
        <div className="no-print inline-actions mt-24">
          <span className="text-small muted">Answer key for:</span>
          {materialSet.materials.map((m) => (
            <Button
              size="sm"
              variant={m.id === material.id ? "secondary" : "outline"}
              key={m.id}
              onClick={() => setSelected(m.id)}
            >
              {m.title}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
export default function MaterialsPage({
  planVersionId,
}: {
  planVersionId: string;
}) {
  return (
    <PageGate>
      <MaterialsContent planVersionId={planVersionId} />
    </PageGate>
  );
}
