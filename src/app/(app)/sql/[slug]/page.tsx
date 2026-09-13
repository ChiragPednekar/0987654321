import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
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
    .select("id, title, prompt, topic, difficulty, schema_note, order_matters, hint")
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

      <Card className="mt-4">
        <CardContent className="p-5">
          <p className="text-sm">{exercise.prompt}</p>
        </CardContent>
      </Card>

      <div className="mt-5">
        <SqlWorkbench
          slug={slug}
          schemaNote={exercise.schema_note}
          orderMatters={exercise.order_matters}
          hint={exercise.hint}
          initialQuery={last?.query ?? ""}
          alreadySolved={Boolean(last?.correct)}
        />
      </div>
    </div>
  );
}
