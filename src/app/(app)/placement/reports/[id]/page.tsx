import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlacement, reportEvidence } from "@/lib/placement/server";
import { ShareReport } from "@/components/placement/forms";
import { ReportView } from "@/components/placement/report-view";

const ACCESS_LABEL: Record<string, string> = {
  "placement.report_draft": "Draft created",
  "placement.report_shared": "Approved and link issued",
  "placement.report_viewed": "Opened by recipient",
  "placement.report_downloaded": "CSV downloaded",
  "placement.report_revoked": "Access revoked",
  "placement.interview_request": "Interviews requested",
};

export default async function ReportPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: report } = await db.from("placement_reports").select("*").eq("id", id).maybeSingle();
  if (!report) notFound();
  await requirePlacement(report.institution_id);
  const [evidence, { data: log }] = await Promise.all([
    reportEvidence(report),
    // The record of what left the college: every approval, view, download and
    // revocation, from the same audit trail the admin area reads.
    db.from("audit_log").select("id, action, actor_email, created_at").eq("resource", "placement_reports")
      .eq("resource_id", report.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const missing = report.student_ids.length - evidence.candidates.length;

  return (
    <div className="space-y-6">
      <Link href={`/placement?institution=${report.institution_id}`} className="text-sm underline">Back to college</Link>
      <h1 className="text-2xl font-semibold">Review report before sharing</h1>
      <ShareReport report={report} />
      {missing > 0 && (
        <p className="rounded border border-amber-500 p-3 text-sm">
          {missing} selected {missing === 1 ? "student has" : "students have"} no shareable faculty-reviewed result or turned sharing off. This report cannot be approved until every selected student qualifies — create a new draft to revise the selection.
        </p>
      )}
      <ReportView title={report.title} evidence={evidence} />
      <section className="rounded-xl border p-5 print:hidden">
        <h2 className="font-medium">Access record</h2>
        {!log?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {log.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2">
                <span>{ACCESS_LABEL[row.action] ?? row.action} · <span className="text-muted-foreground">{row.actor_email}</span></span>
                <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Revoking stops the link working. Copies already downloaded or printed cannot be recalled.</p>
      </section>
    </div>
  );
}
