import ReviewPage from "@/components/pages/review";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{
    run?: string | string[];
    student?: string | string[];
  }>;
}) {
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  return (
    <ReviewPage
      key={batchId}
      batchId={batchId}
      startAnalysis={query.run === "1"}
    />
  );
}
