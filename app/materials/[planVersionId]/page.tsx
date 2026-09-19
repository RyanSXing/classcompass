import MaterialsPage from "@/components/pages/materials";
export default async function Page({
  params,
}: {
  params: Promise<{ planVersionId: string }>;
}) {
  const { planVersionId } = await params;
  return <MaterialsPage planVersionId={planVersionId} />;
}
