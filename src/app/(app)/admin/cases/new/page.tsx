import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { CaseForm } from "@/components/admin/case-form";

export const metadata: Metadata = { title: "New case" };

export default async function NewCasePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/admin/cases/new");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("case_categories")
    .select("id, name, domain")
    .order("sort_order");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/cases"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Cases
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">New case</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A case cannot be graded without a rubric, so both are created together.
      </p>

      <div className="mt-8">
        <CaseForm categories={categories ?? []} />
      </div>
    </div>
  );
}
