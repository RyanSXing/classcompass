import type { Metadata } from "next";
import { AssistantPage } from "@/components/pages/assistant";

export const metadata: Metadata = { title: "Assistant" };
export default function Page() {
  return <AssistantPage />;
}
