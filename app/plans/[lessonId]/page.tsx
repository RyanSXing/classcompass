import PlanPage from "@/components/pages/plan";
export default async function Page({params}:{params:Promise<{lessonId:string}>}){const {lessonId}=await params;return <PlanPage lessonId={lessonId}/>;}
