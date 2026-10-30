import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, Newspaper } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve } from "@/lib/entitlement";
import { addDays, currentStreak, istDate } from "@/lib/current-affairs/questions";
import { loadReview } from "@/lib/current-affairs/review";
import { DailyQuiz } from "@/components/daily/daily-quiz";
import { cn } from "@/lib/utils";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatChip } from "@/components/stat-chip";

export const metadata: Metadata = { title: "Daily quiz" };

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
      <Page narrow>
        <PageHeader
          eyebrow="Practise"
          title="Daily quiz"
          subtitle="Current affairs, written from the RBI's press releases, every answer sourced."
        />
        <EmptyState
          className="mt-6"
          icon={Newspaper}
          title="The first quiz isn't out yet"
          description="A new one appears each morning, written from the Reserve Bank of India's latest press releases."
        />
      </Page>
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
    <Page narrow>
      <PageHeader
        eyebrow="Practise"
        title="Daily quiz"
        subtitle="Current affairs, written from the RBI's press releases, every answer sourced."
        stats={[isToday ? "Today's quiz" : longDate(selected.quiz_date)]}
        actions={<StatChip label="Quiz streak" value={streak} unit={streak === 1 ? "day" : "days"} tone={streak > 0 ? "warning" : "neutral"} />}
      />

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
    </Page>
  );
}
