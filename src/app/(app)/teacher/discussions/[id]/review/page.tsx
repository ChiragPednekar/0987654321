import {notFound} from "next/navigation";
import {requireTeacherActor} from "@/lib/authz";
import {createAdminClient} from "@/lib/supabase/admin";
import {GdReviewForm} from "@/components/teacher/gd-review-form";
export default async function GdReviewPage({params}:{params:Promise<{id:string}>}) {
  const actor=await requireTeacherActor();const {id}=await params;const db=createAdminClient();
  const {data:s}=await db.from("gd_sessions").select("id,status,gd_topics(title)").eq("id",id).eq("host_id",actor.id).maybeSingle();if(!s)notFound();
  const {data:p,error}=await db.from("gd_participants").select("user_id").eq("session_id",id).eq("admission_status","approved").neq("user_id",actor.id);if(error)throw error;
  const {data:users}=p?.length?await db.from("users").select("id,full_name").in("id",p.map(x=>x.user_id)):{data:[]};
  const {data:reviews}=await db.from("gd_faculty_reviews").select("*").eq("session_id",id).order("created_at",{ascending:false});
  return <div className="space-y-5"><h1 className="text-2xl font-medium">Discussion feedback</h1><p className="text-sm text-muted-foreground">Feedback is based on your observations. There is no recording, proctoring or automatic GD score. Reviews appear in each student&apos;s preparation plan.</p>{s.status!=="completed"&&<p>End the discussion before reviewing participants.</p>}{users?.map(u=><article key={u.id} className="rounded-xl border p-5"><h2 className="font-medium">{u.full_name??"Student"}</h2>{s.status==="completed"&&<GdReviewForm sessionId={id} userId={u.id}/>}<details className="mt-3"><summary className="cursor-pointer text-sm">Previous feedback</summary>{reviews?.filter(r=>r.user_id===u.id).map(r=><p key={r.id} className="mt-2 whitespace-pre-wrap text-sm">{new Date(r.created_at).toLocaleString()} — {r.feedback}</p>)}</details></article>)}</div>;
}
