import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, Database } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "SQL practice" };

export default async function SqlIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/sql");

  const admin = createAdminClient();
  const [{ data: exercises }, { data: solved }] = await Promise.all([
    admin
      .from("sql_exercises")
      .select("slug, title, prompt, topic, difficulty, sort_order")
      .eq("is_published", true)
      .order("sort_order"),
    admin
      .from("sql_attempts")
      .select("exercise_id")
      .eq("user_id", user.id)
      .eq("correct", true),
  ]);

  const { data: ids } = await admin.from("sql_exercises").select("id, slug");
  const slugOf = new Map((ids ?? []).map((e) => [e.id, e.slug]));
  const done = new Set(
    (solved ?? []).map((a) => slugOf.get(a.exercise_id)).filter(Boolean) as string[],
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">SQL practice</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Write the query, run it, get it marked. One schema throughout, so what
        you learn on the first carries to the last.
      </p>

      <Card className="mt-6 border-muted">
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p>
            Your query runs against a real SQLite database built fresh for each
            attempt. Column names and row order are ignored unless the question
            says otherwise.
          </p>
          <p>
            Every answer is also checked against a second dataset you cannot
            see. A query that only works on the rows in front of you will be
            marked wrong, and told why.
          </p>
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        {plural(done.size, "exercise")} solved of {(exercises ?? []).length}.
      </p>

      <div className="mt-3 space-y-2">
        {(exercises ?? []).map((e) => (
          <Link key={e.slug} href={`/sql/${e.slug}`}>
            <Card className="transition-colors hover:border-foreground/25">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {done.has(e.slug) ? (
                      <Check className="size-4 text-[var(--success)]" />
                    ) : (
                      <Database className="size-4 text-muted-foreground" />
                    )}
                    <p className="font-medium">{e.title}</p>
                    <Badge variant="outline">{e.difficulty}</Badge>
                    <Badge variant="secondary">{e.topic}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{e.prompt}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
