import {sharedReport} from "@/lib/placement/server";
import {audit,authzResponse} from "@/lib/authz";
function cell(value:unknown) {let text=String(value??"");if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}) {
  try {const {token}=await params;const {report,evidence,actor}=await sharedReport(token);
    const rows:unknown[][]=[["Student","Target role","Programme","Assessment","Evaluation type","Score %","Assessed at","Reviewed at","Skill scores","Faculty feedback","Work sample","Authorised email","Authorised résumé"]];
    for(const c of evidence.candidates)for(const e of c.evidence)rows.push([c.name,c.target_role,c.programme,evidence.assessments.find(a=>a.id===e.assessment_id)?.title,e.proctored?"Faculty-reviewed / proctored common assessment":"Faculty-reviewed / common assessment",e.percentage,e.date,e.reviewed_at,JSON.stringify(e.scores),e.feedback,e.work,c.email,c.resume_url]);
    await audit(actor,"placement.report_downloaded","placement_reports",report.id);
    return new Response("\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="candidate-report.csv"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(e){const r=authzResponse(e);return Response.json(r.body,{status:r.status});}
}
