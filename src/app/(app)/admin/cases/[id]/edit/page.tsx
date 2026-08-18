import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { CaseForm, type CaseFormInitial } from "@/components/admin/case-form";
import { DeleteCaseButton } from "@/components/admin/delete-case-button";

export const metadata: Metadata = { title: "Edit case" };

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/admin/cases/${id}/edit`);
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: caseData }, { data: categories }, { data: rubric }, { count }] =
    await Promise.all([
      supabase
        .from("cases")
        .select(
          "id, slug, title, domain, difficulty, category_id, company_track, estimated_minutes, scenario, instructions, supporting_data, expected_framework, model_answer, tags, is_published",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("case_categories").select("id, name, domain").order("sort_order"),
      supabase
        .from("rubrics")
        .select("criteria, descriptors, pass_score")
        .eq("case_id", id)
        .maybeSingle(),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("case_id", id),
    ]);

  if (!caseData) notFound();

  const submissionCount = count ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/cases"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Cases
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit case</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {caseData.slug} · {submissionCount} submission
            {submissionCount === 1 ? "" : "s"}
          </p>
        </div>

        <DeleteCaseButton
          caseId={caseData.id}
          title={caseData.title}
          submissionCount={submissionCount}
        />
      </div>

      <div className="mt-8">
        <CaseForm
          categories={categories ?? []}
          initial={{ ...caseData, rubric } as CaseFormInitial}
        />
      </div>
    </div>
  );
}
