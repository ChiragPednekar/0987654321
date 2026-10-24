import { notFound } from "next/navigation";
import {requirePlacement,collegeData} from "@/lib/placement/server";
import {ReportForm} from "@/components/placement/forms";
export default async function NewReport({searchParams}:{searchParams:Promise<{institution?:string;request?:string}>}) {
  const q=await searchParams;if(!q.institution)notFound();await requirePlacement(q.institution);const data=await collegeData(q.institution);
  if(q.request&&!data.requests.some(r=>r.id===q.request))notFound();
  return <section className="space-y-5"><h1 className="text-2xl font-semibold">Company report builder</h1><ReportForm institutionId={q.institution} requestId={q.request??null} students={data.users.map(u=>({id:u.id,name:u.full_name??u.email,consent:u.open_to_opportunities}))} assessments={data.assessments}/></section>;
}
