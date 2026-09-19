"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutGrid,
  BookOpen,
  Upload,
  ChevronDown,
  Menu,
  LogOut,
  School,
  X,
  Files,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace-provider";
import { api } from "@/lib/client/api";

export function CompassMark() {
  return (
    <svg
      className="brand-symbol"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2.5" />
      <path d="M26 11 23 24 11 29 16 16Z" fill="currentColor" />
      <path d="m26 11-10 5 7 8Z" fill="#58d3d8" />
      <circle cx="20" cy="20" r="2" fill="#6b3db8" />
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/classroom" className="brand">
      <CompassMark />
      <span className="brand-name">ClassCompass</span>
    </Link>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useWorkspace();
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
        path.startsWith("/materials") ||
        path === "/calendar",
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
          <div className="teacher-avatar">T</div>
          <div>
            <strong>{data?.config.teacher || "Teacher"}</strong>
            <small>Grade 5 · Mathematics</small>
          </div>
          {data?.config.dataBackend === "supabase" && (
            <button
              aria-label="Sign out"
              className="button button-ghost button-icon sign-out"
              onClick={async () => {
                await api("/api/auth/logout", {});
                router.push("/login");
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
            Grade 5 <span className="muted">/</span> Fractions
          </div>
          <div className="utility-tags">
            <details className="info-disclosure">
              <summary>
                <Badge
                  tone={data?.config.aiMode === "live" ? "aqua" : "violet"}
                >
                  {data?.config.aiMode === "live" ? "Live AI" : "Sample mode"}
                  <ChevronDown size={12} />
                </Badge>
              </summary>
              <div className="info-panel">
                <strong>
                  {data?.config.aiMode === "live"
                    ? "Live AI"
                    : "Prepared sample results"}
                </strong>
                <p>
                  {data?.config.aiMode === "live"
                    ? "Uploads use OpenRouter. Sample work uses prepared readings."
                    : "Sample results are prepared, not live model output."}
                </p>
                <p>
                  Eight fictional students. Files are saved{" "}
                  {data?.config.dataBackend === "supabase"
                    ? "privately in Supabase"
                    : "in this local workspace"}
                  .
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
