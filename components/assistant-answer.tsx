"use client";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
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
          <p key={index}>
            <InlineText text={paragraph.replace(/^#{1,4}\s+/gm, "")} />
          </p>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="chat-actions">
          {actions.map((action) => (
            <div className="chat-action" key={action.id}>
              <h3>{action.title}</h3>
              <p>{action.description}</p>
              <Link href={action.href} className="text-link">
                Open supporting work <ArrowUpRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      )}
      {citations.length > 0 && (
        <div className="chat-citations">
          <strong>Sources</strong>
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
        </div>
      )}
    </>
  );
}
