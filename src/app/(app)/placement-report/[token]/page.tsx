import {notFound} from "next/navigation";
import {sharedReport} from "@/lib/placement/server";
import {audit,AuthzError} from "@/lib/authz";
import {ReportView} from "@/components/placement/report-view";
import {CompanyReportActions} from "@/components/placement/company-report-actions";
export const metadata={title:"College candidate report",robots:{index:false,follow:false}};
export default async function CompanyReport({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  let result;try{result=await sharedReport(token);}catch(e){if(e instanceof AuthzError)notFound();throw e;}
  await audit(result.actor,"placement.report_viewed","placement_reports",result.report.id);
  return <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8"><p className="text-xs text-muted-foreground">For {result.report.recipient_email} · Access expires {new Date(result.report.expires_at!).toLocaleDateString()}</p><ReportView title={result.report.title} evidence={result.evidence}/><CompanyReportActions token={token} candidates={result.evidence.candidates.map(c=>({id:c.id,name:c.name}))}/></div>;
}
