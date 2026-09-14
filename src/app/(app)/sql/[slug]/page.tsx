import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { SqlWorkbench } from "@/components/sql/sql-workbench";

export const metadata: Metadata = { title: "SQL exercise" };

export default async function SqlExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/sql/${slug}`);

  const admin = createAdminClient();
  // Only the readable columns are selected. hidden_setup_sql and solution_sql
  // are not granted to clients and must never reach a page.
  const { data: exercise } = await admin
    .from("sql_exercises")
    // Deliberately not prompt, schema_note, order_matters or hint. Those are
    // the exercise, and they are handed over by /api/sql/open once the student
    // has armed exam mode — a prop rendered here would travel in the page
    // payload and be readable without pressing Start.
    .select("id, title, topic, difficulty")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!exercise) notFound();

  const { data: attempts } = await admin
    .from("sql_attempts")
    .select("query, correct")
    .eq("user_id", user.id)
    .eq("exercise_id", exercise.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = attempts?.[0];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/sql" className="text-sm text-muted-foreground hover:text-foreground">
        ← SQL practice
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{exercise.title}</h1>
        <Badge variant="outline">{exercise.difficulty}</Badge>
      </div>

      <div className="mt-5">
        <SqlWorkbench
          slug={slug}
          initialQuery={last?.query ?? ""}
          alreadySolved={Boolean(last?.correct)}
        />
      </div>
    </div>
  );
}
