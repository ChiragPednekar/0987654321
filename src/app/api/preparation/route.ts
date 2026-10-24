import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor, AuthzError, authzResponse } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSubmission } from "@/lib/ai/evaluate";
import { recordUsage } from "@/lib/usage";
import { COMMON_CRITERIA, DEFENSE_CRITERIA, DIAGNOSTIC, DIAGNOSTIC_KEY, FOLLOW_UP, TARGET_ROLES, weekStart } from "@/lib/placement/core";
import type { Domain } from "@/lib/types/database";
import type { AttemptIntegrity, PlacementAssessment, PlacementAttempt } from "@/lib/placement/types";
import { hasProctoringProof, signalsSchema } from "@/lib/integrity-request";
import { assessIntegrity } from "@/lib/integrity";
import { lockoutResponse } from "@/lib/exam-lockouts";

export const maxDuration=120;
const text=z.string().trim();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("profile"),target_role:z.enum(TARGET_ROLES),specialisation:text.min(2).max(100),programme:text.min(2).max(100),graduation_year:z.number().int().min(2000).max(2100).nullable(),placement_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),resume_url:text.max(2000).refine(v=>!v || /^https:\/\//.test(v),"Use an HTTPS résumé link."),share_contact:z.boolean(),share_resume:z.boolean()}),
  z.object({action:z.literal("task"),task_key:z.enum(["case","spoken","skills","gd"]),completed:z.boolean()}),
  z.object({action:z.literal("diagnostic"),answer:text.min(200).max(12000)}),
  z.object({action:z.literal("assessment_start"),assessment_id:z.string().uuid()}),
  // signals is absent only on a retry of a failed evaluation, which re-grades
  // the answer already saved under proctoring.
  z.object({action:z.literal("assessment"),assessment_id:z.string().uuid(),answer:text.min(200).max(20000),signals:signalsSchema.optional()}),
  z.object({action:z.literal("defense"),submission_id:z.string().uuid().nullable(),topic:text.min(10).max(1500),answer:text.min(100).max(6000),response:text.min(100).max(6000),input_mode:z.enum(["spoken","typed"])}),
]);
export async function POST(request:Request) {
  let running:{table:"placement_attempts"|"practice_defenses";id:string}|null=null;
  const db=createAdminClient();
  try {
    const actor=await requireActor();
    const body=schema.parse(await request.json());
    if(body.action==="profile") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the discriminant
      const {action:_,...fields}=body;
      if(fields.resume_url) { const url=new URL(fields.resume_url); if(url.username || url.password) throw new Error("Use a public HTTPS résumé link without credentials."); }
      const {error}=await db.from("preparation_profiles").upsert({...fields,user_id:actor.id,updated_at:new Date().toISOString()});
      if(error) throw error;
      return NextResponse.json({ok:true});
    }
    if(body.action==="task") {
      const query=body.completed
        ? db.from("preparation_tasks").upsert({user_id:actor.id,week_start:weekStart(),task_key:body.task_key})
        : db.from("preparation_tasks").delete().eq("user_id",actor.id).eq("week_start",weekStart()).eq("task_key",body.task_key);
      const {error}=await query; if(error) throw error;
      return NextResponse.json({ok:true});
    }
    if(body.action==="assessment_start") {
      const a=await openAssessmentFor(actor.id,body.assessment_id);
      const locked=await lockoutResponse(actor.id,assessmentPath(a.id));
      if(locked) return locked;
      const {data:done}=await db.from("placement_attempts").select("id").eq("assessment_id",a.id).eq("user_id",actor.id).neq("status","failed").maybeSingle();
      if(done) return NextResponse.json({error:"You have already submitted this assessment."},{status:409});
      // First start wins: reopening after a reload keeps the original clock.
      const {error}=await db.from("placement_sittings").upsert({assessment_id:a.id,user_id:actor.id},{onConflict:"assessment_id,user_id",ignoreDuplicates:true});
      if(error) throw error;
      const {data:sitting}=await db.from("placement_sittings").select("started_at").eq("assessment_id",a.id).eq("user_id",actor.id).single();
      return NextResponse.json({scenario:a.scenario,started_at:sitting?.started_at});
    }
    let title:string=DIAGNOSTIC.title, scenario:string=DIAGNOSTIC.scenario, reference:string=DIAGNOSTIC.reference;
    let criteria:Record<string,number>=COMMON_CRITERIA;
    let gradingAnswer=body.answer;
    let attempt:PlacementAttempt|null=null;
    if(body.action==="defense") {
      // Two short speaking exercises per day, free to every signed-in student.
      // The advisory lock in reserve_defense prevents concurrent quota bypass.
      if(body.submission_id) {
        const {data:s}=await db.from("submissions").select("id").eq("id",body.submission_id).eq("user_id",actor.id).maybeSingle();
        if(!s) throw new AuthzError("Submission not found",404);
      }
      const {data:id,error}=await db.rpc("reserve_practice_defense",{p_user:actor.id,p_topic:body.topic,p_answer:body.answer,p_response:body.response,p_follow_up:FOLLOW_UP,p_input_mode:body.input_mode,p_submission:body.submission_id});
      if(error) throw error;
      if(!id) return NextResponse.json({error:"You have used today's two spoken-practice sessions. Come back tomorrow."},{status:429});
      running={table:"practice_defenses",id};
      title="Defend a business recommendation";
      scenario=`Topic: ${body.topic}\nExplain a recommendation, support it with evidence, then answer: ${FOLLOW_UP}`;
      reference="Evaluate clarity, structure, evidence and the response to the changed assumption. This is a transcript, possibly edited or typed. Do not infer accent, delivery, personality or spoken fluency. Make no recruitment recommendation.";
      criteria=DEFENSE_CRITERIA;
      gradingAnswer=`Recommendation:\n${body.answer}\nFollow-up response:\n${body.response}`;
    } else {
      let proctoring:{integrity:AttemptIntegrity;elapsed_seconds:number}|null=null;
      if(body.action==="assessment") {
        const a=await openAssessmentFor(actor.id,body.assessment_id);
        const locked=await lockoutResponse(actor.id,assessmentPath(a.id));
        if(locked) return locked;
        title=a.title;scenario=a.scenario;reference=a.reference_answer+"\nFaculty calibration examples:\n"+JSON.stringify(a.examples);criteria=a.criteria;
        if(body.signals) proctoring=await proctoringRecord(actor.id,a.id,body.signals,body.answer);
      }
      const key=body.action==="diagnostic" ? {diagnostic_key:DIAGNOSTIC_KEY,assessment_id:null} : {assessment_id:body.assessment_id,diagnostic_key:null};
      let existingQuery=db.from("placement_attempts").select("*").eq("user_id",actor.id);
      existingQuery=key.assessment_id ? existingQuery.eq("assessment_id",key.assessment_id) : existingQuery.eq("diagnostic_key",DIAGNOSTIC_KEY);
      const {data:existing,error:readError}=await existingQuery.maybeSingle();
      if(readError) throw readError;
      if(existing?.status==="evaluated") return NextResponse.json({ok:true,id:existing.id,result:existing.result});
      if(existing?.status==="processing") return NextResponse.json({error:"Your answer is still being evaluated. Refresh shortly."},{status:409});
      if(existing) {
        const {data,error}=await db.from("placement_attempts").update({status:"processing"}).eq("id",existing.id).eq("status","failed").select("*").maybeSingle();
        if(error) throw error;
        if(!data) return NextResponse.json({error:"Evaluation already started."},{status:409});
        attempt=data;gradingAnswer=existing.answer;
      } else {
        // A new common-assessment answer must arrive from a proctored sitting.
        if(body.action==="assessment" && !proctoring) return NextResponse.json({error:"Start the assessment from its page; it runs under exam conditions."},{status:403});
        const {data,error}=await db.from("placement_attempts").insert({...key,user_id:actor.id,answer:body.answer,...(proctoring??{})}).select("*").single();
        if(error?.code==="23505") return NextResponse.json({error:"Your answer has already been received."},{status:409});
        if(error) throw error;attempt=data;
      }
      running={table:"placement_attempts",id:attempt!.id};
    }
    const result=await evaluateSubmission({title,domain:"finance" as Domain,difficulty:"medium",scenario,instructions:"Evaluate the reasoning against the supplied rubric. Explain each deduction using the student's actual words or a specific omission.",supporting_data:{},expected_framework:null,model_answer:reference},{criteria,descriptors:{},max_score:Object.values(criteria).reduce((a,b)=>a+b,0)},gradingAnswer);
    const publicResult={breakdown:result.breakdown,percentage:result.percentage,feedback:result.feedback};
    const {error}=running.table==="placement_attempts"
      ? await db.from("placement_attempts").update({result:publicResult,status:"evaluated",evaluated_at:new Date().toISOString()}).eq("id",running.id)
      : await db.from("practice_defenses").update({result:publicResult,status:"evaluated"}).eq("id",running.id);
    if(error) throw error;
    await recordUsage(db,{userId:actor.id,operation:"grading",model:result.model,inputTokens:result.inputTokens,outputTokens:result.outputTokens,cachedTokens:result.cachedTokens,totalTokens:result.tokensUsed});
    return NextResponse.json({ok:true,id:running.id,result:publicResult});
  } catch(error) {
    if(running) await db.from(running.table).update({status:"failed"}).eq("id",running.id);
    if(error instanceof AuthzError) {const r=authzResponse(error);return NextResponse.json(r.body,{status:r.status});}
    if(error instanceof z.ZodError) return NextResponse.json({error:error.issues[0]?.message},{status:400});
    console.error("[preparation]",error);
    return NextResponse.json({error:"Could not complete this request. Your submitted answer is kept; retry the evaluation shortly."},{status:500});
  }
}

const assessmentPath=(id:string)=>`/preparation/assessments/${id}`;

/** An assessment this student may sit right now, or 404. */
async function openAssessmentFor(userId:string,assessmentId:string):Promise<PlacementAssessment> {
  const db=createAdminClient();
  const {data:a}=await db.from("placement_assessments").select("*").eq("id",assessmentId).maybeSingle();
  if(!a || a.status!=="open" || (a.closes_at && new Date(a.closes_at).getTime()<=Date.now())) throw new AuthzError("This assessment is not accepting answers",404);
  const {data:m}=await db.from("institution_members").select("user_id").eq("institution_id",a.institution_id).eq("user_id",userId).eq("role","student").maybeSingle();
  if(!m) throw new AuthzError("This assessment belongs to another college",404);
  return a;
}

/**
 * What the proctor saw, for the faculty reviewer. Refuses a submission that
 * shows no proctoring at all or was never started. The verdict is recorded,
 * not applied: on a one-sitting assessment the reviewer weighs it with the
 * photos, and the AI-authorship guess is left out because it is too noisy to
 * stand as evidence.
 */
async function proctoringRecord(userId:string,assessmentId:string,signals:z.infer<typeof signalsSchema>,answer:string) {
  if(!hasProctoringProof(signals)) throw new AuthzError("Submission rejected: this assessment must be sat with exam mode and the camera running.",403);
  const {data:sitting}=await createAdminClient().from("placement_sittings").select("started_at").eq("assessment_id",assessmentId).eq("user_id",userId).maybeSingle();
  if(!sitting) throw new AuthzError("No sitting found. Start the assessment from its page.",403);
  const elapsed_seconds=Math.max(0,Math.round((Date.now()-new Date(sitting.started_at).getTime())/1000));
  const verdict=assessIntegrity({signals,answerChars:answer.length,elapsedSeconds:elapsed_seconds,aiLikelihood:null});
  const camera:AttemptIntegrity["camera"]=signals.cameraDenied?"denied":signals.cameraUnavailable?"unavailable":signals.detectorFailed?"failed":"on";
  return {elapsed_seconds,integrity:{severity:verdict.severity,flags:verdict.flags.map(f=>({code:f.code,label:f.label,points:f.points})),camera}};
}
