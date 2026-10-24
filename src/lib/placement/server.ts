import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor, AuthzError, type Actor } from "@/lib/authz";
import { latestReviews } from "./core";
import type { PlacementReport, PlacementAttempt, PlacementReview } from "./types";
import type { UserRow } from "@/lib/types/database";

export async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
export async function placementInstitutions(actor: Actor) {
  const db = createAdminClient();
  if (actor.role === "admin") {
    return allRows((a,b) => db.from("institutions").select("id,name").order("name").range(a,b));
  }
  const { data, error } = await db.from("institution_members").select("institution_id").eq("user_id", actor.id).in("role", ["owner","staff"]);
  if (error) throw new Error(error.message);
  if (!data?.length) return [];
  const result = await db.from("institutions").select("id,name").in("id", data.map(r=>r.institution_id)).order("name");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}
export async function requirePlacement(institutionId: string) {
  const actor = await requireActor();
  const institutions = await placementInstitutions(actor);
  const institution = institutions.find(i => i.id === institutionId);
  if (!institution) throw new AuthzError("College access not found",404);
  return { actor, institution, institutions };
}
export async function collegeData(institutionId: string) {
  const db = createAdminClient();
  const [members, assessments, requests, reports] = await Promise.all([
    allRows((a,b)=>db.from("institution_members").select("user_id").eq("institution_id",institutionId).eq("role","student").order("user_id").range(a,b)),
    allRows((a,b)=>db.from("placement_assessments").select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).order("id").range(a,b)),
    allRows((a,b)=>db.from("placement_requests").select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).order("id").range(a,b)),
    allRows((a,b)=>db.from("placement_reports").select("*").eq("institution_id",institutionId).order("created_at",{ascending:false}).order("id").range(a,b)),
  ]);
  // Batch IN filters to avoid long URLs for whole-college rosters.
  const users: Pick<UserRow,"id"|"full_name"|"email"|"open_to_opportunities"|"deactivated_at">[] = [];
  const attempts: PlacementAttempt[] = [], reviews: PlacementReview[] = [];
  const profiles = [], batches = [];
  for (let offset=0; offset<members.length; offset+=150) {
    const ids=members.slice(offset,offset+150).map(m=>m.user_id);
    const [u,p,b] = await Promise.all([
      allRows((a,c)=>db.from("users").select("id,full_name,email,open_to_opportunities,deactivated_at").in("id",ids).order("id").range(a,c)),
      allRows((a,c)=>db.from("preparation_profiles").select("*").in("user_id",ids).order("user_id").range(a,c)),
      allRows((a,c)=>db.from("classroom_members").select("user_id,classroom_id,classrooms(name)").in("user_id",ids).eq("role","student").order("classroom_id").order("user_id").range(a,c)),
    ]);
    users.push(...u.filter(x=>!x.deactivated_at)); profiles.push(...p); batches.push(...b);
  }
  for (const assessment of assessments) {
    const rows=await allRows((a,b)=>db.from("placement_attempts").select("*").eq("assessment_id",assessment.id).order("id").range(a,b));
    attempts.push(...rows.filter(a=>users.some(u=>u.id===a.user_id)));
  }
  for (let i=0;i<attempts.length;i+=150) {
    reviews.push(...await allRows((a,b)=>db.from("placement_reviews").select("*").in("attempt_id",attempts.slice(i,i+150).map(x=>x.id)).order("created_at",{ascending:false}).order("id").range(a,b)));
  }
  const interviewRequests = [];
  for (let i=0;i<reports.length;i+=150) {
    interviewRequests.push(...await allRows((a,b)=>db.from("placement_interview_requests").select("*").in("report_id",reports.slice(i,i+150).map(x=>x.id)).order("created_at",{ascending:false}).order("id").range(a,b)));
  }
  return { users, profiles, batches, assessments, attempts, reviews, requests, reports, interviewRequests };
}
export type CollegeData = Awaited<ReturnType<typeof collegeData>>;
export function tokenHash(token:string) { return createHash("sha256").update(token).digest("hex"); }

/** Only reviewed common assessments, current college membership and current opt-in.
 * No private practice, diagnostic, raw AI verdicts, camera evidence or hidden contacts.
 */
export async function reportEvidence(report: PlacementReport) {
  const data = await collegeData(report.institution_id);
  const latest = latestReviews(data.reviews);
  const assessments = data.assessments.filter(a=>report.assessment_ids.includes(a.id));
  const candidates = data.users.filter(u=>report.student_ids.includes(u.id) && u.open_to_opportunities).map(user=>{
    const profile = data.profiles.find(p=>p.user_id===user.id);
    const evidence = data.attempts.filter(a=>a.user_id===user.id && a.assessment_id && report.assessment_ids.includes(a.assessment_id) && a.status==="evaluated" && latest.has(a.id)).map(a=>{
      const review=latest.get(a.id)!;
      return { assessment_id:a.assessment_id!, date:a.evaluated_at, reviewed_at:review.created_at,
        scores:review.scores, percentage:review.percentage,
        feedback:report.include_feedback ? review.feedback : null,
        work:report.include_work ? a.answer : null };
    });
    return { id:user.id, name:user.full_name??"Student", target_role:profile?.target_role??"", specialisation:profile?.specialisation??"",
      programme:profile?.programme??"", graduation_year:profile?.graduation_year??null,
      email:report.include_contact && profile?.share_contact ? user.email : null,
      resume_url:report.include_resume && profile?.share_resume && profile.resume_url.startsWith("https://") ? profile.resume_url : null,
      evidence };
  }).filter(c=>c.evidence.length>0);
  return { candidates, assessments:assessments.map(a=>({id:a.id,title:a.title,target_role:a.target_role,criteria:a.criteria})),
    cohortSize:data.users.length };
}
export async function sharedReport(token:string) {
  const actor=await requireActor();
  if(!/^[a-f0-9]{64}$/.test(token)) throw new AuthzError("Report unavailable",404);
  const db=createAdminClient();
  const {data:report,error}=await db.from("placement_reports").select("*").eq("token_hash",tokenHash(token)).maybeSingle();
  if(error) throw new Error(error.message);
  if(!report || report.status!=="shared" || !report.expires_at || new Date(report.expires_at).getTime()<=Date.now() || report.recipient_email.toLowerCase()!==actor.email.toLowerCase()) throw new AuthzError("This report is unavailable or belongs to another email address.",404);
  return {actor,report,evidence:await reportEvidence(report)};
}
