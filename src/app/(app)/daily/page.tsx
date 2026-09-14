import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve } from "@/lib/entitlement";
import { Card, CardContent } from "@/components/ui/card";
import { addDays, currentStreak, istDate } from "@/lib/current-affairs/questions";
import { loadReview } from "@/lib/current-affairs/review";
import { DailyQuiz } from "@/components/daily/daily-quiz";
import { cn, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Daily current affairs" };

function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/daily");

  const admin = createAdminClient();
  const today = istDate();

  const [{ data: quizzes }, entitled] = await Promise.all([
    admin
      .from("ca_quizzes")
      .select("id, quiz_date")
      .lte("quiz_date", today)
      .gte("quiz_date", addDays(today, -60))
      .order("quiz_date", { ascending: false }),
    canSolve(admin, user.id),
  ]);
  const all = quizzes ?? [];

  const { data: attempts } = all.length
    ? await admin
        .from("ca_attempts")
        .select("quiz_id, answers, on_the_day")
        .eq("user_id", user.id)
        .in("quiz_id", all.map((q) => q.id))
    : { data: [] };
  const attemptOf = new Map((attempts ?? []).map((a) => [a.quiz_id, a]));
  const dateOf = new Map(all.map((q) => [q.id, q.quiz_date]));

  const streak = currentStreak(
    (attempts ?? []).filter((a) => a.on_the_day).map((a) => dateOf.get(a.quiz_id)!),
    all.map((q) => q.quiz_date),
    today,
  );

  const selected = all.find((q) => q.quiz_date === date) ?? all[0];

  if (!selected) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Daily current affairs</h1>
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            The first quiz has not been written yet. A new one appears each morning,
            written from the Reserve Bank of India&apos;s latest press releases.
          </CardContent>
        </Card>
      </div>
    );
  }

  const attempt = attemptOf.get(selected.id);
  const [review, { data: questions }] = await Promise.all([
    attempt ? loadReview(admin, selected.id, attempt.answers) : Promise.resolve(null),
    admin
      .from("ca_questions")
      .select("position, stem, options, is_pulled")
      .eq("quiz_id", selected.id)
      .order("position"),
  ]);

  const isToday = selected.quiz_date === today;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily current affairs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isToday ? "Today" : longDate(selected.quiz_date)} · written from the RBI&apos;s
            press releases, every answer sourced.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border px-3 py-1 text-sm">
          <Flame className={cn("size-4", streak > 0 ? "text-[var(--warning)]" : "text-muted-foreground")} />
          <span className="tabular">{plural(streak, "day")}</span>
        </div>
      </div>

      {!isToday && all[0]?.quiz_date !== today && selected.id === all[0]?.id && (
        <p className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          No quiz for today yet — one is written each morning, and skipped on days the RBI
          publishes nothing worth asking about. This is the most recent. A day without a quiz
          does not break your streak.
        </p>
      )}
      {!isToday && selected.id !== all[0]?.id && !attempt && (
        <p className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          An earlier quiz. Good practice, but only the day&apos;s own quiz, taken that day,
          counts toward your streak.
        </p>
      )}

      <div className="mt-6">
        <DailyQuiz
          key={selected.id}
          quizId={selected.id}
          questions={(questions ?? []).map((q) => ({
            position: q.position,
            stem: q.stem,
            options: q.options,
            isPulled: q.is_pulled,
          }))}
          initialReview={review}
          entitled={entitled}
        />
      </div>

      {all.length > 1 && (
        <div className="mt-8">
          <p className="text-xs font-medium text-muted-foreground">
            Recent quizzes
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {all.slice(0, 14).map((q) => {
              const done = attemptOf.has(q.id);
              return (
                <Link
                  key={q.id}
                  href={`/daily?date=${q.quiz_date}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent",
                    q.id === selected.id && "border-primary",
                  )}
                >
                  {done && <Check className="size-3 text-[var(--success)]" />}
                  {q.quiz_date === today ? "Today" : longDate(q.quiz_date).replace(/^\w+, /, "")}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
