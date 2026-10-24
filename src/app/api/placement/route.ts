import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireActor, AuthzError, authzResponse, audit } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlacement, collegeData, reportEvidence, sharedReport, tokenHash } from "@/lib/placement/server";
import { COMMON_CRITERIA, scoreReview } from "@/lib/placement/core";

const uuid=z.string().uuid(), text=z.string().trim();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("assessment"),institution_id:uuid,title:text.min(4).max(160),target_role:text.min(2).max(100),domain:text.min(2).max(80),scenario:text.min(100).max(20000),reference_answer:text.min(100).max(12000),examples:z.array(z.object({level:z.enum(["weak","average","strong"]),answer:text.min(30).max(4000),explanation:text.min(20).max(2000)})).length(3),closes_at:z.string().datetime().nullable()}),
  z.object({action:z.literal("assessment_status"),id:uuid,status:z.enum(["open","closed"])}),
  z.object({action:z.literal("review"),attempt_id:uuid,scores:z.record(z.number().finite()),feedback:text.min(30).max(4000),reason:text.min(10).max(2000)}),
  z.object({action:z.literal("request"),institution_id:uuid,company:text.min(2).max(160),target_role:text.min(2).max(120),requirements:text.min(20).max(4000)}),
  z.object({action:z.literal("report"),institution_id:uuid,title:text.min(3).max(160),recipient_email:z.string().email().max(254),request_id:uuid.nullable(),student_ids:z.array(uuid).min(1).max(200),assessment_ids:z.array(uuid).min(1).max(20),include_work:z.boolean(),include_feedback:z.boolean(),include_contact:z.boolean(),include_resume:z.boolean()}),
  z.object({action:z.literal("publish"),id:uuid,days:z.number().int().min(1).max(30)}),
  z.object({action:z.literal("revoke"),id:uuid}),
  z.object({action:z.literal("interview"),token:z.string().length(64),student_ids:z.array(uuid).min(1).max(200),message:text.min(10).max(3000)}),
  z.object({action:z.literal("interview_status"),id:uuid,status:z.enum(["contacted","closed"])}),
]);
export async function POST(request:Request) {
  try {
    const actor=await requireActor();
    const body=schema.parse(await request.json());
    const db=createAdminClient();
    if(body.action==="request") {
      if(actor.role!=="recruiter" && actor.role!=="admin") throw new AuthzError("Recruiter access required",403);
      const {data:college}=await db.from("institutions").select("id").eq("id",body.institution_id).eq("is_suspended",false).maybeSingle();
      if(!college) throw new AuthzError("College not found",404);
      const {count}=await db.from("placement_requests").select("id",{count:"exact",head:true}).eq("requester_id",actor.id).gte("created_at",new Date(Date.now()-86400000).toISOString());
      if((count??0)>=10) return NextResponse.json({error:"You can make up to ten requests per day."},{status:429});
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the discriminant
      const {action:_,...fields}=body;
      const {error}=await db.from("placement_requests").insert({...fields,requester_id:actor.id});
      if(error) throw error;
      await audit(actor,"placement.request","institutions",body.institution_id);
      return NextResponse.json({ok:true});
    }
    if(body.action==="interview") {
      const {report,evidence}=await sharedReport(body.token);
      if(body.student_ids.some(id=>!evidence.candidates.some(c=>c.id===id))) throw new AuthzError("Candidate unavailable",404);
      const {count}=await db.from("placement_interview_requests").select("id",{head:true,count:"exact"}).eq("requester_id",actor.id).gte("created_at",new Date(Date.now()-86400000).toISOString());
      if((count??0)>=10) return NextResponse.json({error:"Daily interview-request limit reached."},{status:429});
      const {error}=await db.from("placement_interview_requests").insert({report_id:report.id,requester_id:actor.id,student_ids:[...new Set(body.student_ids)],message:body.message});
      if(error) throw error;
      await audit(actor,"placement.interview_request","placement_reports",report.id);
      return NextResponse.json({ok:true});
    }
    if(body.action==="assessment") {
      await requirePlacement(body.institution_id);
      if(new Set(body.examples.map(e=>e.level)).size!==3) throw new Error("Include one weak, average and strong example.");
      if(body.closes_at && new Date(body.closes_at).getTime()<=Date.now()) throw new Error("Closing date must be in the future.");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the discriminant
      const {action:_,...fields}=body;
      const {data,error}=await db.from("placement_assessments").insert({...fields,criteria:COMMON_CRITERIA,created_by:actor.id}).select("id").single();
      if(error) throw error;
      await audit(actor,"placement.assessment_created","placement_assessments",data.id);
      return NextResponse.json({ok:true,id:data.id});
    }
    if(body.action==="assessment_status") {
      const {data:a}=await db.from("placement_assessments").select("*").eq("id",body.id).maybeSingle();
      if(!a) throw new AuthzError("Assessment not found",404);
      await requirePlacement(a.institution_id);
      if(body.status==="open" && a.status!=="draft") throw new Error("Only a draft can be opened. Create a new assessment for another sitting.");
      if(body.status==="open" && a.closes_at && new Date(a.closes_at).getTime()<=Date.now()) throw new Error("This assessment's closing date has passed.");
      const {error}=await db.from("placement_assessments").update({status:body.status}).eq("id",a.id);
      if(error) throw error;
      await audit(actor,`placement.assessment_${body.status}`,"placement_assessments",a.id);
      return NextResponse.json({ok:true});
    }
    if(body.action==="review") {
      const {data:attempt}=await db.from("placement_attempts").select("*").eq("id",body.attempt_id).maybeSingle();
      if(!attempt?.assessment_id || attempt.status!=="evaluated") throw new AuthzError("Evaluated assessment not found",404);
      const {data:a}=await db.from("placement_assessments").select("*").eq("id",attempt.assessment_id).single();
      if(!a) throw new AuthzError("Assessment not found",404);
      await requirePlacement(a.institution_id);
      if(actor.id===attempt.user_id) throw new AuthzError("You cannot review your own work",403);
      const percentage=scoreReview(a.criteria,body.scores);
      const {error}=await db.from("placement_reviews").insert({attempt_id:attempt.id,reviewer_id:actor.id,scores:body.scores,percentage,feedback:body.feedback,reason:body.reason});
      if(error) throw error;
      await audit(actor,"placement.review","placement_attempts",attempt.id,{percentage});
      return NextResponse.json({ok:true});
    }
    if(body.action==="report") {
      await requirePlacement(body.institution_id);
      const data=await collegeData(body.institution_id);
      if(body.student_ids.some(id=>!data.users.some(u=>u.id===id && u.open_to_opportunities))) throw new Error("Choose current students who have opted in to recruitment sharing.");
      if(body.assessment_ids.some(id=>!data.assessments.some(a=>a.id===id))) throw new AuthzError("Assessment not found",404);
      if(body.request_id && !data.requests.some(r=>r.id===body.request_id)) throw new AuthzError("Company request not found",404);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the discriminant
      const {action:_,...fields}=body;
      const {data:report,error}=await db.from("placement_reports").insert({...fields,recipient_email:body.recipient_email.toLowerCase(),student_ids:[...new Set(body.student_ids)],assessment_ids:[...new Set(body.assessment_ids)],created_by:actor.id}).select("id").single();
      if(error) throw error;
      await audit(actor,"placement.report_draft","placement_reports",report.id);
      return NextResponse.json({ok:true,id:report.id});
    }
    if(body.action==="interview_status") {
      const {data:interview}=await db.from("placement_interview_requests").select("report_id").eq("id",body.id).maybeSingle();
      if(!interview) throw new AuthzError("Request not found",404);
      const {data:report}=await db.from("placement_reports").select("institution_id").eq("id",interview.report_id).single();
      if(!report) throw new AuthzError("Report not found",404);
      await requirePlacement(report.institution_id);
      const {error}=await db.from("placement_interview_requests").update({status:body.status}).eq("id",body.id);
      if(error) throw error;
      await audit(actor,"placement.interview_status","placement_interview_requests",body.id,{status:body.status});
      return NextResponse.json({ok:true});
    }
    const {data:report}=await db.from("placement_reports").select("*").eq("id",body.id).maybeSingle();
    if(!report) throw new AuthzError("Report not found",404);
    await requirePlacement(report.institution_id);
    if(body.action==="revoke") {
      const {error}=await db.from("placement_reports").update({status:"revoked",token_hash:null}).eq("id",report.id);
      if(error) throw error;
      await audit(actor,"placement.report_revoked","placement_reports",report.id);
      return NextResponse.json({ok:true});
    }
    const evidence=await reportEvidence(report);
    if(evidence.candidates.length!==report.student_ids.length) throw new Error("Every selected student must still be opted in and have a faculty-reviewed result in the selected assessments. Create a revised draft to change the selection.");
    const token=randomBytes(32).toString("hex");
    const expires_at=new Date(Date.now()+body.days*86400000).toISOString();
    const {error}=await db.from("placement_reports").update({status:"shared",token_hash:tokenHash(token),expires_at,approved_at:new Date().toISOString()}).eq("id",report.id);
    if(error) throw error;
    if(report.request_id) await db.from("placement_requests").update({status:"fulfilled"}).eq("id",report.request_id);
    await audit(actor,"placement.report_shared","placement_reports",report.id,{recipient:report.recipient_email,expires_at});
    return NextResponse.json({ok:true,path:`/placement-report/${token}`,expires_at});
  } catch(error) {
    if(error instanceof z.ZodError) return NextResponse.json({error:error.issues[0]?.message??"Invalid request"},{status:400});
    if(error instanceof AuthzError) {const e=authzResponse(error);return NextResponse.json(e.body,{status:e.status});}
    console.error("[placement]",error);
    return NextResponse.json({error:error instanceof Error ? error.message : "Could not save. Please try again."},{status:400});
  }
}
