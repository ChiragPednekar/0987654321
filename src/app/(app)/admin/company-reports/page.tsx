import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportModeration, type PendingReport } from "@/components/admin/report-moderation";

export const metadata: Metadata = { title: "Reported questions · Admin" };

/** The queue of student-reported interview questions. Guarded by the admin layout. */
export default async function AdminCompanyReportsPage() {
  const admin = createAdminClient();
  const [{ data: pending }, { data: companies }, { count: approvedCount }] = await Promise.all([
    admin
      .from("company_question_reports")
      .select("id, company_id, role, round, year, question, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    admin.from("companies").select("id, name, slug"),
    admin
      .from("company_question_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);

  const companyOf = new Map((companies ?? []).map((c) => [c.id, c]));
  const reports: PendingReport[] = (pending ?? []).map((r) => ({
    id: r.id,
    company: companyOf.get(r.company_id)?.name ?? "Unknown",
    companySlug: companyOf.get(r.company_id)?.slug ?? "",
    role: r.role,
    round: r.round,
    year: r.year,
    question: r.question,
    createdAt: r.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reported questions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Students report questions they were asked; nothing appears on a company page until it is
          approved here. Approve real, specific questions. Reject anything invented, vague,
          promotional, or naming an interviewer or candidate — fix a typo, but do not rewrite a
          question into one the student was not asked. {approvedCount ?? 0} approved so far.
        </p>
      </div>
      <ReportModeration reports={reports} />
    </div>
  );
}
