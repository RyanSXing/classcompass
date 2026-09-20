import type { GuideBlock } from "@/lib/lesson-guide";

export function lessonStageId(blockId: string) {
  return `lesson-stage-${encodeURIComponent(blockId)}`;
}

/** The widths and ranges come from the selected saved lesson, including edits. */
export function LessonTimeline({
  blocks,
  totalMinutes,
}: {
  blocks: GuideBlock[];
  totalMinutes: number;
}) {
  return (
    <nav className="lg-timeline" aria-label="Lesson schedule">
      <div className="lg-timeline-heading">
        <h3>Your {totalMinutes}-minute lesson</h3>
        <span>Choose a stage to jump in</span>
      </div>
      <ol className="lg-timeline-stages">
        {blocks.map((block, index) => (
          <li key={block.blockId} style={{ flexGrow: block.minutes }}>
            <a href={`#${lessonStageId(block.blockId)}`}>
              <span className="lg-stage-number">{index + 1}</span>
              <strong>{block.title}</strong>
              <span className="lg-stage-duration">{block.minutes} min</span>
              <span className="lg-stage-range">
                {block.startMinute}–{block.endMinute} min
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
