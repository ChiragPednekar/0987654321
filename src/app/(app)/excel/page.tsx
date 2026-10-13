import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, Sheet } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PickToggle } from "@/components/teacher/library-picker";
import { PickHint } from "@/components/teacher/pick-hint";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Excel practice" };

export default async function ExcelIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/excel");

  const admin = createAdminClient();
  // Teachers can tick exercises here and add them to a batch.
  const profile = await getCurrentUser();
  const canAssign = profile?.role === "teacher" || profile?.role === "admin";
  const [{ data: rawExercises }, { data: solved }] = await Promise.all([
    admin
      .from("excel_exercises")
      .select("id, slug, title, prompt, topic, difficulty, sort_order, created_by")
      // A teacher also sees the exercises they wrote, which are not published.
      .or(canAssign ? `is_published.eq.true,created_by.eq.${user.id}` : "is_published.eq.true")
      .order("sort_order"),
    admin
      .from("excel_attempts")
      .select("exercise_id")
      .eq("user_id", user.id)
      .eq("correct", true),
  ]);
  // Their own first, so a teacher who has just written one finds it.
  const exercises = (rawExercises ?? []).sort(
    (a, b) => Number(b.created_by === user.id) - Number(a.created_by === user.id),
  );

  const done = new Set((solved ?? []).map((a) => a.exercise_id));
  const list = exercises ?? [];
  const solvedCount = list.filter((e) => done.has(e.id)).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Excel practice</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Write the formula, run it, get it marked. The lookups, conditional sums
        and cleanup a finance or operations interviewer asks at the desk.
      </p>

      <Card className="mt-6 border-muted">
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p>
            Your formula is evaluated, not read, so SUMIF, SUMIFS and SUMPRODUCT
            all score the same when they give the same answer.
          </p>
          <p>
            Every answer is also checked against a second grid with the same
            columns and different numbers. Typing the answer in, or adding up
            the cells you can see, will be marked wrong and told why.
          </p>
        </CardContent>
      </Card>

      {canAssign && <PickHint noun="exercises" />}
      {canAssign && (
        <p className="mt-3 text-sm">
          <Link href="/teacher/questions/new?type=excel" className="underline underline-offset-4">
            Write your own Excel exercise
          </Link>
          <span className="text-muted-foreground"> — it stays private to you and the batches you add it to.</span>
        </p>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        {plural(solvedCount, "exercise")} solved of {list.length}.
      </p>

      <div className="mt-3 space-y-2">
        {list.map((e) => (
          <Link key={e.slug} href={`/excel/${e.slug}`}>
            <Card className="transition-colors hover:border-foreground/25">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {canAssign && <PickToggle kind="excel" id={e.id} title={e.title} />}
                    {done.has(e.id) ? (
                      <Check className="size-4 text-[var(--success)]" />
                    ) : (
                      <Sheet className="size-4 text-muted-foreground" />
                    )}
                    <p className="font-medium">{e.title}</p>
                    <Badge variant="outline">{e.difficulty}</Badge>
                    <Badge variant="secondary">{e.topic}</Badge>
                    {e.created_by === user.id && <Badge variant="outline">Yours</Badge>}
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
