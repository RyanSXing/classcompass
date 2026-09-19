import ReviewPage from "@/components/pages/review";
export default async function Page({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  return <ReviewPage batchId={batchId} />;
}
