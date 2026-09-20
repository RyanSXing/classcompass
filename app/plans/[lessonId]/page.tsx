import PlanPage from "@/components/pages/plan";
export default async function Page({ params, searchParams }: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const version = Array.isArray(query.version) ? query.version[0] : query.version;
  return <PlanPage lessonId={lessonId} initialVersionId={version} />;
}
