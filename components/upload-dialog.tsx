"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Trash2,
  LoaderCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Modal, Banner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client/api";
import { inspectFile, uploadFile } from "@/lib/client/uploads";
import type {
  Batch,
  LessonImport,
  LessonSnapshot,
  SupportContext,
} from "@/lib/contracts";

type UploadItem = {
  file: File;
  preview: string;
  normalized?: Blob;
  studentId: string;
  support: SupportContext["level"];
  note: string;
};
export function UploadDialog({
  onClose,
  initialTab = "work",
}: {
  onClose: (navigated?: boolean) => void;
  initialTab?: "work" | "lesson";
}) {
  const { data, refresh, notify } = useWorkspace();
  const router = useRouter();
  const previewURLs = useRef<string[]>([]);
  const [tab, setTab] = useState(initialTab);
  const [phase, setPhase] = useState<"baseline" | "followup">("baseline");
  const [date, setDate] = useState("2026-09-22");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [lessonImport, setLessonImport] = useState<LessonImport | null>(null);
  const [lesson, setLesson] = useState<LessonSnapshot | null>(null);
  useEffect(
    () => () => {
      previewURLs.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  if (!data) return null;
  const { state, curriculum } = data;
  const template = curriculum.templates.find(
    (t) => t.id === `${phase}-template-v1`,
  )!;
  async function filesAdded(files: FileList | null) {
    if (!files) return;
    setError("");
    if (items.length + files.length > 8) {
      setError("Choose up to eight worksheets, one for each student.");
      return;
    }
    setBusy("Checking your files…");
    try {
      const added: UploadItem[] = [];
      for (const [index, file] of Array.from(files).entries()) {
        if (file.type === "application/json")
          throw new Error(
            "Student worksheets must be PNG, JPEG, or one-page PDF.",
          );
        const inspected = await inspectFile(file, "worksheet");
        previewURLs.current.push(inspected.preview);
        const match = state.students.find(
          (s) =>
            file.name.toLowerCase().includes(s.displayName.toLowerCase()) ||
            file.name.includes(s.id),
        );
        added.push({
          file,
          preview: inspected.preview,
          normalized: inspected.normalized,
          studentId:
            match?.id ?? state.students[items.length + index]?.id ?? "",
          support: "unknown",
          note: "",
        });
      }
      setItems((old) => [...old, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read these files.");
    } finally {
      setBusy("");
    }
  }
  async function submitWork() {
    if (new Set(items.map((i) => i.studentId)).size !== items.length) {
      setError(
        "Each student can have one worksheet in this batch. Please check the mapping.",
      );
      return;
    }
    setError("");
    try {
      const submissions = [];
      for (const [i, item] of items.entries()) {
        setBusy(`Uploading worksheet ${i + 1} of ${items.length}…`);
        const assetId = await uploadFile(
          item.file,
          "worksheet",
          template.id,
          item.studentId,
          item.normalized,
        );
        submissions.push({
          studentId: item.studentId,
          assetId,
          support: {
            level: item.support,
            source:
              item.support === "unknown" ? "not-recorded" : "teacher-recorded",
            note: item.note,
          },
        });
      }
      setBusy("Saving your assignment…");
      const prior = state.batches.filter((b) => b.kind === "baseline").at(-1);
      const plan = state.plans.find((p) => p.id === "lesson-2026-09-23");
      const batch = await api<Batch>("/api/batches", {
        templateId: template.id,
        activityDate: date,
        kind: phase,
        submissions,
        ...(phase === "followup" && prior ? { previousBatchId: prior.id } : {}),
        ...(phase === "followup" && plan
          ? { sourcePlanVersionId: plan.currentVersionId }
          : {}),
      });
      await api(`/api/batches/${batch.id}/analyze`, {
        expectedRevision: batch.revision,
      });
      await refresh();
      router.push(`/review/${batch.id}?run=1`);
      onClose(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Upload paused. Please try again.",
      );
    } finally {
      setBusy("");
    }
  }
  async function loadSample() {
    setBusy("Loading the fictional worksheets…");
    try {
      const result = await api<{ batchId: string }>("/api/demo/load", {
        phase,
      });
      await refresh();
      router.push(`/review/${result.batchId}`);
      onClose(true);
      notify("Sample work loaded. Review the context, then start analysis.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sample.");
    } finally {
      setBusy("");
    }
  }
  async function importLesson(file: File) {
    setError("");
    setBusy("Reading your lesson plan…");
    try {
      const inspected = await inspectFile(file, "lesson");
      previewURLs.current.push(inspected.preview);
      setSource(file);
      setPreview(inspected.preview);
      const assetId = await uploadFile(
        file,
        "lesson",
        undefined,
        undefined,
        inspected.normalized,
      );
      const isJSON =
        file.type === "application/json" || file.name.endsWith(".json");
      const result = await api<LessonImport>("/api/lesson-imports", {
        assetId,
        ...(isJSON
          ? { lesson: JSON.parse(inspected.text) }
          : { extractedText: inspected.text }),
      });
      setLessonImport(result);
      setLesson(
        result.draft ?? {
          schemaVersion: 1,
          lessonId: "lesson-2026-09-23",
          unitId: curriculum.unit.id,
          date: "2026-09-23",
          title: "",
          objectiveIds: curriculum.unit.learningObjectiveIds,
          totalMinutes: 45,
          blocks: ["warmup", "model", "practice", "application", "exit"].map(
            (id, i) => ({
              id,
              title: id,
              minutes: [5, 8, 12, 15, 5][i],
              instructions: "",
              mode: "whole_class" as const,
            }),
          ),
        },
      );
      if (result.errors.length) setError(result.errors.join(" "));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This lesson could not be read.",
      );
    } finally {
      setBusy("");
    }
  }
  async function confirmLesson() {
    if (!lesson || !lessonImport) return;
    setBusy("Saving your lesson…");
    setError("");
    try {
      const current = state.plans.find((p) => p.id === lesson.lessonId);
      await api(`/api/lesson-imports/${lessonImport.id}/confirm`, {
        expectedRevision: lessonImport.revision,
        lesson,
        ...(current ? { expectedPlanVersionId: current.currentVersionId } : {}),
      });
      await refresh();
      router.push(`/plans/${lesson.lessonId}`);
      notify("Lesson imported as a saved version.");
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this lesson.");
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal
      title="Bring your classroom into focus"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
      footer={
        <>
          <span className="muted text-small" style={{ marginRight: "auto" }}>
            {busy && (
              <>
                <LoaderCircle
                  size={14}
                  className="spin"
                  style={{ display: "inline", marginRight: 6 }}
                />
                {busy}
              </>
            )}
          </span>
          <Button variant="ghost" onClick={() => onClose()} disabled={!!busy}>
            Cancel
          </Button>
          {tab === "work" ? (
            <Button
              disabled={!items.length || !!busy}
              onClick={() => void submitWork()}
            >
              Analyze {items.length || ""} worksheet
              {items.length === 1 ? "" : "s"}
              <ArrowRight />
            </Button>
          ) : (
            <Button
              disabled={
                !lesson ||
                !!busy ||
                lesson.blocks.reduce((n, b) => n + b.minutes, 0) !== 45
              }
              onClick={() => void confirmLesson()}
            >
              Confirm lesson import
              <ArrowRight />
            </Button>
          )}
        </>
      }
    >
      <div className="segmented mb-16">
        <button
          className={tab === "work" ? "active" : ""}
          onClick={() => setTab("work")}
        >
          <Upload size={15} />
          Student work
        </button>
        <button
          className={tab === "lesson" ? "active" : ""}
          onClick={() => setTab("lesson")}
        >
          <BookOpen size={15} />
          Lesson plan
        </button>
      </div>
      {error && (
        <div className="mb-16">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
      {tab === "work" ? (
        <div className="spaced">
          <div className="form-grid">
            <label className="field">
              <span>Known assignment</span>
              <Select
                aria-label="Known assignment"
                value={phase}
                onChange={(e) => {
                  const p = e.target.value as "baseline" | "followup";
                  setPhase(p);
                  setDate(p === "baseline" ? "2026-09-22" : "2026-09-24");
                }}
              >
                <option value="baseline">Fraction addition · Baseline</option>
                <option value="followup">
                  A fresh fraction check · Follow-up
                </option>
              </Select>
            </label>
            <label className="field">
              <span>Work completed on</span>
              <Input
                aria-label="Work completed on"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <div className="upload-questions">
            <strong>
              {template.questionIds.length} questions · Grade 5 · Unlike
              denominators
            </strong>
            {template.questionIds.map((id) => (
              <p key={id}>
                {curriculum.questions.find((q) => q.id === id)?.prompt}
              </p>
            ))}
            <p style={{ marginTop: 9 }}>
              Look for equivalent fractions, a common unit, and an explanation.
              Correct unreduced fractions are welcome.
            </p>
          </div>
          <label className="drop-zone">
            <Upload size={30} />
            <strong>Drop worksheets here, or choose files</strong>
            <p>
              PNG, JPEG or one-page PDF · Up to 5 MB each · One page per student
            </p>
            <input
              aria-label="Choose student worksheets"
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              multiple
              onChange={(e) => void filesAdded(e.target.files)}
              disabled={!!busy}
            />
          </label>
          {items.length > 0 && (
            <>
              <div className="inline-actions">
                <strong className="text-small">
                  Map students & record help
                </strong>
                <span className="muted text-small">
                  Applies to every answer on that page.
                </span>
              </div>
              {items.map((item, index) => (
                <div className="upload-row" key={`${item.file.name}-${index}`}>
                  <img
                    className="upload-thumb"
                    src={item.preview}
                    alt={`Preview of ${item.file.name}`}
                  />
                  <div>
                    <div className="upload-file-name">{item.file.name}</div>
                    <div className="upload-file-meta">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <Select
                    aria-label={`Student for ${item.file.name}`}
                    value={item.studentId}
                    onChange={(e) =>
                      setItems((old) =>
                        old.map((x, i) =>
                          i === index ? { ...x, studentId: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {state.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={`Help provided for ${item.file.name}`}
                    value={item.support}
                    onChange={(e) =>
                      setItems((old) =>
                        old.map((x, i) =>
                          i === index
                            ? {
                                ...x,
                                support: e.target
                                  .value as SupportContext["level"],
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    <option value="unknown">Help unknown</option>
                    <option value="independent">Independent</option>
                    <option value="supported">With support</option>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() =>
                      setItems((old) => old.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </>
          )}
          <div className="banner">
            <FileText />
            <div>
              <strong>Taking a look around?</strong>
              <p>
                Load eight fictional, synthetically handwritten worksheets
                through the same review flow.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-16"
                onClick={() => void loadSample()}
                disabled={!!busy}
              >
                Load fictional {phase} work
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="spaced">
          <p className="muted text-small">
            Import your 45-minute lesson. You’ll review and edit every block
            before saving.
          </p>
          <div className="inline-actions">
            <a
              className="text-link text-small"
              href="/demo/lesson-2026-09-23-original.pdf"
              download
            >
              Download sample lesson PDF
            </a>
            <a
              className="text-link text-small"
              href="/demo/lesson-2026-09-23-original.json"
              download
            >
              Download sample JSON
            </a>
          </div>
          <label className="drop-zone">
            <BookOpen size={29} />
            <strong>{source ? source.name : "Choose a lesson plan"}</strong>
            <p>
              Text PDF, up to 3 pages, or ClassCompass lesson JSON · 5 MB max
            </p>
            <input
              aria-label="Choose lesson plan"
              type="file"
              accept="application/pdf,application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importLesson(f);
              }}
              disabled={!!busy}
            />
          </label>
          {lesson && (
            <>
              <div className="form-grid">
                <label className="field">
                  <span>Lesson title</span>
                  <Input
                    aria-label="Lesson title"
                    value={lesson.title}
                    onChange={(e) =>
                      setLesson({ ...lesson, title: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Teaching date</span>
                  <Input
                    aria-label="Teaching date"
                    type="date"
                    value={lesson.date}
                    onChange={(e) =>
                      setLesson({ ...lesson, date: e.target.value })
                    }
                  />
                </label>
              </div>
              {preview && (
                <details>
                  <summary className="text-link text-small">
                    View original lesson
                  </summary>
                  <img
                    src={preview}
                    alt="Original uploaded lesson plan"
                    style={{ maxWidth: "100%", marginTop: 12 }}
                  />
                </details>
              )}
              {lesson.blocks.map((block, index) => (
                <div className="lesson-import-block" key={block.id}>
                  <label className="field">
                    <span>Block title</span>
                    <Input
                      aria-label="Block title"
                      value={block.title}
                      onChange={(e) =>
                        setLesson({
                          ...lesson,
                          blocks: lesson.blocks.map((b, i) =>
                            i === index ? { ...b, title: e.target.value } : b,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Minutes</span>
                    <Input
                      aria-label="Minutes"
                      type="number"
                      min={1}
                      value={block.minutes}
                      onChange={(e) =>
                        setLesson({
                          ...lesson,
                          blocks: lesson.blocks.map((b, i) =>
                            i === index
                              ? { ...b, minutes: Number(e.target.value) }
                              : b,
                          ),
                        })
                      }
                    />
                  </label>
                  <Textarea
                    aria-label={`${block.title} instructions`}
                    value={block.instructions}
                    onChange={(e) =>
                      setLesson({
                        ...lesson,
                        blocks: lesson.blocks.map((b, i) =>
                          i === index
                            ? { ...b, instructions: e.target.value }
                            : b,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <Banner
                tone={
                  lesson.blocks.reduce((n, b) => n + b.minutes, 0) === 45
                    ? "success"
                    : "error"
                }
              >
                Lesson time:{" "}
                <strong>
                  {lesson.blocks.reduce((n, b) => n + b.minutes, 0)} / 45
                  minutes
                </strong>
                . Required objectives and the assessment date are preserved.
              </Banner>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
