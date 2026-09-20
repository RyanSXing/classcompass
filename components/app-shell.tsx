"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutGrid,
  BookOpen,
  Upload,
  Menu,
  LogOut,
  School,
  X,
  Files,
  Users,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";

const teacherDisplayName = "Ms. Verity";

export function CompassMark() {
  return (
    <svg
      className="brand-symbol"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="16.5" stroke="currentColor" strokeWidth="2.5" />
      <path d="M26.5 10.5 22.8 24 10.5 29.5 15.6 16Z" fill="currentColor" />
      <path d="m26.5 10.5-10.9 5.5 7.2 8Z" fill="var(--brand-sun)" />
      <circle cx="20" cy="20" r="2.1" fill="var(--brand-paper)" />
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/classroom" className="brand">
      <CompassMark />
      <span className="brand-copy">
        <span className="brand-name">ClassCompass</span>
        <span className="brand-caption">Teaching workspace</span>
      </span>
    </Link>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { data, signOut } = useWorkspace();
  const sampleToolsEnabled =
    data?.config.sampleToolsEnabled ??
    (data?.config.dataBackend !== "supabase");
  if (path === "/login") return <>{children}</>;
  const links = [
    {
      href: "/classroom",
      label: "Overview",
      icon: LayoutGrid,
      active: path === "/classroom",
    },
    {
      href: "/assignments",
      label: "Assignments",
      icon: Files,
      active: path.startsWith("/assignments") || path.startsWith("/review"),
    },
    {
      href: "/students",
      label: "Students",
      icon: Users,
      active: path.startsWith("/students"),
    },
    {
      href: "/plans",
      label: "Lessons",
      icon: BookOpen,
      active:
        path.startsWith("/plans") ||
        path.startsWith("/materials"),
    },
    {
      href: "/calendar",
      label: "Calendar",
      icon: CalendarDays,
      active: path === "/calendar",
    },
    {
      href: "/assistant",
      label: "Assistant",
      icon: Sparkles,
      active: path === "/assistant",
    },
  ];
  const navigation = (
    <>
      <Brand />
      <Button variant="aqua" className="sidebar-upload" asChild>
        <Link href="/classroom?upload=work" onClick={() => setOpen(false)}>
          <Upload size={19} />
          Upload work
        </Link>
      </Button>
      <p className="nav-label">Your classroom</p>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <Link
            key={link.href}
            className={`nav-item ${link.active ? "active" : ""}`}
            href={link.href}
            onClick={() => setOpen(false)}
            aria-current={link.active ? "page" : undefined}
          >
            <link.icon size={20} />
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="teacher">
          <div className="teacher-avatar" aria-hidden="true">M</div>
          <div>
            <strong>{teacherDisplayName}</strong>
            <small>Grade 5 mathematics</small>
          </div>
          {data?.config.dataBackend === "supabase" && (
            <button
              aria-label="Sign out"
              className="button button-ghost button-icon sign-out"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await signOut();
                } finally {
                  setSigningOut(false);
                }
              }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar desktop-sidebar">{navigation}</aside>
      <div className="workspace">
        <header className="utility-bar">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="mobile-menu-button"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="navigation-overlay" />
              <Dialog.Content className="sidebar navigation-drawer">
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Classroom sections
                </Dialog.Description>
                <Dialog.Close asChild>
                  <Button
                    className="drawer-close"
                    variant="ghost"
                    size="icon"
                    aria-label="Close navigation"
                  >
                    <X />
                  </Button>
                </Dialog.Close>
                {navigation}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <div className="utility-class">
            <School size={18} />
            <span>Grade 5</span>
            <span className="utility-divider" aria-hidden="true" />
            <span>Fractions</span>
          </div>
          <div className="utility-tags">
            <Link className="assistant-quick-link" href="/assistant">
              <Sparkles size={15} />
              Ask assistant
            </Link>
            <details className="info-disclosure">
              <summary>About this classroom</summary>
              <div className="info-panel">
                <strong>Classroom workspace</strong>
                <p>
                  Grade 5 fraction addition. Teaching decisions stay under your
                  control.
                </p>
                <p>
                  {sampleToolsEnabled
                    ? "This preview uses fictional student work."
                    : "Student work is stored in your private classroom."}
                </p>
              </div>
            </details>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
