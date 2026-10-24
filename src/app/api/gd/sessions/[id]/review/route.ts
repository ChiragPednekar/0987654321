import {z} from "zod";
import {requireTeacherActor,AuthzError,authzResponse,audit} from "@/lib/authz";
import {createAdminClient} from "@/lib/supabase/admin";
const schema=z.object({user_id:z.string().uuid(),scores:z.object({contribution:z.number().int().min(0).max(5),listening:z.number().int().min(0).max(5),collaboration:z.number().int().min(0).max(5),clarity:z.number().int().min(0).max(5)}),feedback:z.string().trim().min(30).max(4000)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try{const actor=await requireTeacherActor();const {id}=await params;const body=schema.parse(await request.json());const db=createAdminClient();
    const {data:s}=await db.from("gd_sessions").select("id,status").eq("id",id).eq("host_id",actor.id).maybeSingle();
    if(!s||s.status!=="completed")throw new AuthzError("Only the teacher who hosted this completed discussion can review it",403);
    const {data:p}=await db.from("gd_participants").select("user_id").eq("session_id",id).eq("user_id",body.user_id).eq("admission_status","approved").maybeSingle();
    if(!p||body.user_id===actor.id)throw new AuthzError("Participant not found",404);
    const {error}=await db.from("gd_faculty_reviews").insert({...body,session_id:id,reviewer_id:actor.id});if(error)throw error;
    await audit(actor,"gd.faculty_review","gd_sessions",id,{student_id:body.user_id});
    return Response.json({ok:true});
  }catch(e){if(e instanceof z.ZodError)return Response.json({error:e.issues[0]?.message},{status:400});const r=authzResponse(e);return Response.json(r.body,{status:r.status});}
}
