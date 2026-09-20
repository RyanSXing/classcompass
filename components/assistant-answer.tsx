"use client";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { TeachingAction } from "./teaching-action";
import type {
  AssistantAction,
  AssistantCitation,
} from "@/lib/assistant-contracts";

function InlineText({ text }: { text: string }) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}
function AnswerBlock({ text }: { text: string }) {
  const lines = text.replace(/^#{1,4}\s+/gm, "").split("\n");
  if (lines.every((line) => /^\s*[-•]\s+/.test(line))) return <ul>{lines.map((line, i) => <li key={i}><InlineText text={line.replace(/^\s*[-•]\s+/, "")} /></li>)}</ul>;
  if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) return <ol>{lines.map((line, i) => <li key={i}><InlineText text={line.replace(/^\s*\d+[.)]\s+/, "")} /></li>)}</ol>;
  return <p><InlineText text={text.replace(/^#{1,4}\s+/gm, "")} /></p>;
}
export function AssistantAnswer({
  content,
  citations,
  actions,
}: {
  content: string;
  citations: AssistantCitation[];
  actions: AssistantAction[];
}) {
  return (
    <>
      <div className="chat-turn-content">
        {content.split(/\n\s*\n/).map((paragraph, index) => (
          <AnswerBlock key={index} text={paragraph} />
        ))}
      </div>
      {actions.length > 0 && (
        <div className="chat-actions">
          {actions.map((action) => (
            <div className="chat-action" key={action.id}>
              <h3>{action.title}</h3>
              <TeachingAction description={action.description} />
              <Link href={action.href} className="text-link">
                {citations.find((source) => source.id === action.citationId)
                  ?.kind === "lesson"
                  ? "Open lesson"
                  : "Open supporting work"}{" "}
                <ArrowUpRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      )}
      {citations.length > 0 && (
        <details className="chat-citations">
          <summary>Sources · {citations.length}</summary>
          <div className="chat-citation-links">
            {citations.map((citation) => (
              <Link
                key={citation.id}
                href={citation.href}
                title={citation.excerpt}
              >
                <FileText size={12} />
                {citation.label}
              </Link>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
