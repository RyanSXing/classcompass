"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LockKeyhole,
  CalendarDays,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Clock3,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageGate, PageHeading, Banner, Modal } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { dateLabel } from "@/lib/utils";
import type { CalendarEntry } from "@/lib/contracts";

function CalendarContent() {
  const { data } = useWorkspace();
  const [view, setView] = useState<"unit" | "wider">("unit");
  const search = useSearchParams();
  const router = useRouter();
  const [entry, setEntry] = useState<CalendarEntry | null>(null);
  if (!data) return null;
  const { state, curriculum } = data;
  const proposals = state.proposals.filter(
    (p) => p.status === "draft" || p.status === "stale",
  );
  const selected = proposals.find((p) => p.id === search.get("proposal"));
  const stale =
    selected &&
    (selected.status === "stale" ||
      selected.evidenceRevision !== state.classroom.evidenceRevision ||
      selected.calendarRevision !== state.classroom.calendarRevision);
  const events = state.calendarEntries.filter(
    (c) => c.unitId === curriculum.unit.id && !c.endDate,
  );
  const wider = state.calendarEntries.filter(
    (c) => c.endDate || c.unitId !== curriculum.unit.id,
  );
  const changes =
    selected?.changes.filter((c) => c.operation === "schedule_checkpoint") ??
    [];
  return (
    <div className="page">
      <PageHeading
        title="Unit calendar"
        description="Saved lessons, fixed dates and suggested follow-up checks."
        breadcrumb="Unit calendar"
      >
        <div className="segmented">
          <button
            className={view === "unit" ? "active" : ""}
            onClick={() => setView("unit")}
            aria-pressed={view === "unit"}
          >
            <CalendarDays size={15} />
            This unit
          </button>
          <button
            className={view === "wider" ? "active" : ""}
            onClick={() => setView("wider")}
            aria-pressed={view === "wider"}
          >
            Wider calendar
          </button>
        </div>
      </PageHeading>
      <div className="review-toolbar">
        <h2 style={{ fontSize: 23 }}>
          {view === "unit"
            ? "September 21 – October 2, 2026"
            : "Later units and dates"}
        </h2>
        <Select
          aria-label="Suggested schedule preview"
          value={selected?.id ?? ""}
          onChange={(e) => {
            router.replace(
              e.target.value
                ? `/calendar?proposal=${e.target.value}`
                : "/calendar",
              { scroll: false },
            );
          }}
          style={{ maxWidth: 320 }}
        >
          <option value="">Saved schedule only</option>
          {proposals.map((p) => (
            <option key={p.id} value={p.id}>
              Preview:{" "}
              {dateLabel(
                state.plans.find((l) => l.id === p.lessonId)?.date ??
                  "2026-09-23",
              )}{" "}
              lesson changes{p.status === "stale" ? " (needs updating)" : ""}
            </option>
          ))}
        </Select>
      </div>
      {selected && (
        <div className="mb-16">
          <Banner tone={stale ? "warning" : "info"}>
            <strong>
              {stale
                ? "This preview needs updating."
                : "Suggested schedule — not saved."}
            </strong>{" "}
            Dashed events show suggested checks. Save selected changes from the
            lesson page.
            <Link
              className="text-link"
              style={{ marginLeft: 8 }}
              href={`/plans/${selected.lessonId}`}
            >
              Review changes →
            </Link>
          </Banner>
        </div>
      )}
      <div className="calendar-layout">
        <div>
          {view === "unit" ? (
            <div className="calendar-grid">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(
                (day) => (
                  <div className="calendar-day-name" key={day}>
                    {day}
                  </div>
                ),
              )}
              {curriculum.unit.availableTeachingDates.map((date) => {
                const dayEvents = events.filter((e) => e.date === date);
                return (
                  <div className="calendar-cell" key={date}>
                    <div
                      className="calendar-date"
                      data-day={dateLabel(date, { weekday: "short" })}
                    >
                      {dateLabel(date)}
                    </div>
                    {dayEvents.map((e) => (
                      <button
                        key={e.id}
                        className={`calendar-event ${e.locked ? "amber" : e.checkpoint ? "teal" : ""}`}
                        onClick={() => setEntry(e)}
                      >
                        {e.locked && (
                          <LockKeyhole
                            size={11}
                            style={{ display: "inline", marginRight: 4 }}
                          />
                        )}
                        {e.title}
                        <small>
                          {e.minutes} minutes{e.locked ? " · Fixed date" : ""}
                        </small>
                        {e.checkpoint && (
                          <small>
                            <CheckCircle2
                              size={9}
                              style={{ display: "inline", marginRight: 3 }}
                            />
                            {e.checkpoint.title} · {e.checkpoint.minutes} min
                            within session
                          </small>
                        )}
                      </button>
                    ))}
                    {changes
                      .filter(
                        (c) =>
                          state.calendarEntries.find(
                            (e) => e.id === c.payload.calendarEntryId,
                          )?.date === date,
                      )
                      .map((c) => (
                        <div key={c.id} className="calendar-event preview">
                          <Badge
                            tone="violet"
                            style={{
                              fontSize: 9,
                              padding: "2px 5px",
                              marginBottom: 5,
                            }}
                          >
                            PREVIEW
                          </Badge>
                          <br />
                          {c.payload.title}
                          <small>
                            {c.payload.minutes} min within the existing {45}-min
                            lesson
                          </small>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="wider-unit current">
                <div>
                  <Badge tone="violet">CURRENT UNIT</Badge>
                  <p>Sep 21 – Oct 2</p>
                </div>
                <div>
                  <h3>{curriculum.unit.title}</h3>
                  <p>
                    Equivalent fractions → common units → word problems.
                    Targeted support takes place within scheduled lessons.
                  </p>
                </div>
                <Badge tone="green">On schedule</Badge>
              </div>
              {wider.map((e) => (
                <div className="wider-unit" key={e.id}>
                  <div className="text-small muted">
                    {dateLabel(e.date)}
                    {e.endDate ? ` – ${dateLabel(e.endDate)}` : ""}
                  </div>
                  <div>
                    <h3>{e.title}</h3>
                    <p>{e.instructions}</p>
                  </div>
                  <Badge tone={e.locked ? "amber" : "neutral"}>
                    {e.locked ? "Fixed" : "Sequence kept"}
                  </Badge>
                </div>
              ))}
              <Banner>
                Later units stay in order. This preview does not move their dates.
              </Banner>
            </>
          )}
        </div>
        <Card>
          <div className="card-content">
            <h3 style={{ fontSize: 18 }}>Fixed dates and lesson time</h3>
            <div className="constraint-grid">
              <div className="constraint-item">
                <LockKeyhole />
                <div>
                  <strong>Fixed assessment</strong>October 2 is a fixed
                  assessment date.
                </div>
              </div>
              <div className="constraint-item">
                <Clock3 />
                <div>
                  <strong>45-minute lessons</strong>Groups work at the same
                  time. Follow-up checks use time within an existing lesson.
                </div>
              </div>
              <div className="constraint-item">
                <BookOpen />
                <div>
                  <strong>Required learning goals</strong>Required skills and
                  the order of topics stay in the plan.
                </div>
              </div>
            </div>
            <div
              className="banner success"
              style={{ marginTop: 17, padding: 13, fontSize: 12 }}
            >
              <CheckCircle2 size={17} />
              <div>Targeted support does not delay the whole class.</div>
            </div>
          </div>
        </Card>
      </div>
      <div className="inline-actions mt-24">
        <span className="text-small muted">Solid = saved schedule</span>
        <span className="text-small muted">Dashed = suggested change</span>
      </div>
      {entry && (
        <Modal
          title={entry.title}
          onClose={() => setEntry(null)}
          footer={
            <>
              {entry.lessonId && (
                <Button asChild>
                  <Link href={`/plans/${entry.lessonId}`}>
                    <BookOpen />
                    Open lesson
                    <ArrowRight />
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => setEntry(null)}>
                Close
              </Button>
            </>
          }
        >
          <div className="spaced">
            <div className="inline-actions">
              <Badge tone="violet">
                {dateLabel(entry.date, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Badge>
              <Badge>{entry.minutes} minutes</Badge>
              {entry.locked && (
                <Badge tone="amber">
                  <LockKeyhole />
                  Fixed date
                </Badge>
              )}
            </div>
            <p>{entry.instructions}</p>
            {entry.checkpoint && (
              <Banner tone="success">
                <strong>{entry.checkpoint.title}</strong> uses{" "}
                {entry.checkpoint.minutes} minutes starting at minute{" "}
                {entry.checkpoint.offsetMinutes} of this session. The remaining{" "}
                {entry.minutes - entry.checkpoint.minutes} minutes follow the
                planned lesson.
              </Banner>
            )}
            <div>
              <h4>Learning objectives</h4>
              {entry.objectiveIds.map((id) => (
                <p
                  className="text-small muted"
                  style={{ marginTop: 8 }}
                  key={id}
                >
                  {curriculum.objectives.find((o) => o.id === id)?.description}
                </p>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function CalendarPage() {
  return (
    <Suspense
      fallback={<div className="loading-page">Opening the calendar…</div>}
    >
      <PageGate>
        <CalendarContent />
      </PageGate>
    </Suspense>
  );
}
