import type { Metadata } from "next";
import "./globals.css";
import "./revamp.css";
import "./review-plan.css";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "ClassCompass · Classroom overview",
    template: "%s · ClassCompass",
  },
  description:
    "Connect student work to your next teaching decision. A teacher-controlled Grade 5 lesson planning workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
