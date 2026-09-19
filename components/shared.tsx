"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  AlertCircle,
  ChevronRight,
  LoaderCircle,
  X,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace-provider";
import { humanize } from "@/lib/utils";

export function PageGate({ children }: { children: React.ReactNode }) {
  const { loading, error, data, refresh } = useWorkspace();
  if (loading)
    return (
      <div className="loading-page">
        <div className="loading-inner">
          <LoaderCircle className="spin" size={31} />
          <strong>Opening your classroom…</strong>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="page">
        <Card>
          <EmptyState
            title="We couldn't open your classroom"
            text={error ?? "Please try again."}
            action={<Button onClick={() => void refresh()}>Try again</Button>}
          />
        </Card>
      </div>
    );
  return <>{children}</>;
}
export function PageHeading({
  title,
  description,
  children,
  breadcrumb,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  breadcrumb?: string;
}) {
  return (
    <>
      {title !== "Overview" && (
        <div className="breadcrumb">
          <Link href="/classroom">Overview</Link>
          <ChevronRight size={12} />
          <span>{breadcrumb ?? title}</span>
        </div>
      )}
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {children && <div className="heading-actions">{children}</div>}
      </div>
    </>
  );
}
export function EmptyState({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <Inbox size={29} />}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Banner({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error" | "success" | "warning";
}) {
  return (
    <div
      className={`banner ${tone === "info" ? "" : tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <AlertCircle />
      <div>{children}</div>
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone = [
    "confirmed",
    "completed",
    "saved",
    "correct",
    "resolved",
    "applied",
    "ready",
  ].includes(status)
    ? "green"
    : ["stale", "failed", "incorrect", "cancelled"].includes(status)
      ? "red"
      : [
            "candidate",
            "pending",
            "queued",
            "unreviewed",
            "uncertain",
            "blocked",
            "waiting_retry",
          ].includes(status)
        ? "amber"
        : "neutral";
  return (
    <Badge tone={tone}>
      {status === "candidate"
        ? "Needs approval"
        : status === "stale"
          ? "Needs updating"
          : status === "resolved"
            ? "Reviewed"
            : status === "uncertain"
              ? "Unclear"
              : status === "blocked"
                ? "Needs a check"
                : status === "cancelled"
                  ? "Stopped"
                  : humanize(status)}
    </Badge>
  );
}
export function Modal({
  title,
  children,
  onClose,
  footer,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const target = ref.current;
    target?.querySelector<HTMLElement>("button,input,select,textarea")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && target) {
        const items = Array.from(
          target.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        );
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
export function FractionBars({ a = 3, b = 6 }: { a?: number; b?: number }) {
  return (
    <svg
      viewBox="0 0 240 30"
      aria-label={`${a} of ${b} equal parts shaded`}
      role="img"
    >
      {Array.from({ length: b }, (_, i) => (
        <rect
          key={i}
          x={(i * 238) / b + 1}
          y="1"
          width={238 / b}
          height="27"
          fill={i < a ? "#d0bce8" : "#fff"}
          stroke="#81639e"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
