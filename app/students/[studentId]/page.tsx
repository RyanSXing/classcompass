import StudentPage from "@/components/pages/student";
export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <StudentPage studentId={studentId} />;
}
