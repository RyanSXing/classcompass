import type { Metadata } from "next";
import { AssistantPage } from "@/components/pages/assistant";

export const metadata: Metadata = { title: "Classroom assistant" };
export default function Page() {
  return <AssistantPage />;
}
