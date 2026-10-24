import {redirect} from "next/navigation";
import {requireActor} from "@/lib/authz";
import {createAdminClient} from "@/lib/supabase/admin";
import {allRows} from "@/lib/placement/server";
import {CompanyRequestForm} from "@/components/placement/forms";
export const metadata={title:"Recruiter dashboard"};
export default async function RecruiterPage(){
  const actor=await requireActor();if(actor.role!=="recruiter"&&actor.role!=="admin")redirect("/dashboard");
  const db=createAdminClient();
  const colleges=await allRows((a,b)=>db.from("institutions").select("id,name").eq("is_suspended",false).order("name").range(a,b));
  const {data:requests,error}=await db.from("placement_requests").select("*").eq("requester_id",actor.id).order("created_at",{ascending:false});if(error)throw error;
  return <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8"><h1 className="font-editorial text-4xl">Find evidence for your next hire.</h1><p className="text-muted-foreground">Ask a college for a role-specific report. Its placement team reviews candidates and shares approved assessment evidence with you. Private practice history and activity points are not recruitment rankings.</p><CompanyRequestForm institutions={colleges}/><section className="space-y-3"><h2 className="text-xl font-medium">Your requests</h2>{!requests?.length&&<p className="text-sm text-muted-foreground">You have not requested a report yet.</p>}{requests?.map(r=><article key={r.id} className="rounded-lg border p-4"><p className="font-medium">{r.company} · {r.target_role}</p><p className="mt-2 text-sm">{r.requirements}</p><p className="mt-2 text-xs text-muted-foreground">{colleges.find(c=>c.id===r.institution_id)?.name} · {r.status}</p></article>)}</section><p className="text-sm text-muted-foreground">Open the report link supplied by the placement cell using the email on your account: {actor.email}.</p></div>;
}
