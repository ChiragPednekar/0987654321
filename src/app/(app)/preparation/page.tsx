import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireActor } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { weekStart } from "@/lib/placement/core";
import { preparationState } from "@/lib/placement/next-practice";
import { PreparationProfileForm, TaskCheck, SpokenDefense } from "@/components/preparation/workspace";

export const metadata = { title: "Your preparation plan" };

export default async function PreparationPage({ searchParams }: { searchParams: Promise<{ submission?: string }> }) {
  const actor = await requireActor();
  const db = createAdminClient();
  const q = await searchParams;

  const [state, { data: defenses }, { data: gdReviews }] = await Promise.all([
    preparationState(actor.id),
    db.from("practice_defenses").select("*").eq("user_id", actor.id).order("created_at", { ascending: false }).limit(10),
    db.from("gd_faculty_reviews").select("*").eq("user_id", actor.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const { profile, diagnostic, tasks, plan, next, pendingAssignments, assessments } = state;

  // Arriving from a graded answer: the spoken defence is about that case.
  let topic = "";
  if (q.submission) {
    const { data: s } = await db.from("submissions").select("id, cases(title)").eq("id", q.submission).eq("user_id", actor.id).maybeSingle();
    if (s) topic = (Array.isArray(s.cases) ? s.cases[0] : s.cases)?.title ?? "";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Your preparation plan</p>
        <h1 className="mt-2 font-editorial text-4xl">A plan for your placements.</h1>
        <p className="mt-3 text-muted-foreground">
          {profile?.target_role || "Set your target role below"}
          {profile?.placement_date && ` · placements from ${new Date(profile.placement_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
          . Short sessions, honest feedback, then a fresh task.
        </p>
      </header>

      <Link href={next.href} className="group block rounded-xl border border-primary/30 bg-primary/5 p-5 transition-colors hover:bg-primary/10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Your next practice · {next.minutes}</p>
        <p className="mt-2 flex items-center gap-2 text-xl font-medium">
          {next.title}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{next.reason}</p>
      </Link>

      <PreparationProfileForm profile={profile} />

      <section className="rounded-xl border bg-muted/20 p-5">
        <h2 className="text-xl font-medium">{diagnostic?.status === "evaluated" ? "Your baseline is ready" : "Start with a free diagnostic"}</h2>
        <p className="my-3 text-sm text-muted-foreground">
          One business problem, a 15-minute answer and specific feedback. No subscription needed, and your baseline stays private.
        </p>
        <Link href="/preparation/diagnostic" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
          {diagnostic?.status === "evaluated" ? "Review baseline feedback" : "Take the diagnostic"}
        </Link>
      </section>

      {pendingAssignments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Teacher assignments first</h2>
          {pendingAssignments.map((a) => (
            <Link key={a.id} href={`/classrooms/${a.classroom_id}`} className="block rounded-lg border p-4 text-sm">
              {a.title ?? "Class assignment"}
              <span className="ml-3 text-xs text-muted-foreground">{a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString()}` : "No deadline"}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-medium">This week · from {weekStart()}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {plan.map((p, i) => (
            <article key={p.key} className="space-y-3 rounded-xl border p-5">
              <p className="text-xs text-muted-foreground">{i + 1}. {p.minutes}</p>
              <Link href={p.href} className="text-lg font-medium hover:underline">{p.title}</Link>
              <p className="text-sm text-muted-foreground">{p.reason}</p>
              <TaskCheck taskKey={p.key} completed={tasks.some((t) => t.task_key === p.key)} />
            </article>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          The checklist is yours to keep track; it awards no points and is not shown to companies. Library practice follows your plan&apos;s limits.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">College assessments</h2>
        {assessments.length ? (
          assessments.map((a) => (
            <Link key={a.id} href={`/preparation/assessments/${a.id}`} className="flex justify-between rounded-lg border p-4 text-sm">
              <span>{a.title}</span>
              <span>{a.status}{a.closes_at ? ` · closes ${new Date(a.closes_at).toLocaleDateString()}` : ""}</span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Common assessments appear here when your placement cell opens them. They never use paid practice credits.</p>
        )}
      </section>

      <div id="spoken" className="scroll-mt-20">
        <SpokenDefense submissionId={topic ? q.submission : null} initialTopic={topic} />
      </div>

      {defenses?.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Your speaking practice so far</h2>
          <p className="text-xs text-muted-foreground">
            Each attempt is on a different topic, so compare the feedback rather than the numbers.
          </p>
          {defenses.map((d) => (
            <details key={d.id} className="rounded-lg border p-4">
              <summary className="cursor-pointer text-sm">
                {d.topic} · {new Date(d.created_at).toLocaleDateString()} · {d.result ? `${d.result.percentage.toFixed(0)}%` : d.status}
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">{d.input_mode === "spoken" ? "Voice transcript (may be edited)" : "Typed practice"}</p>
              <p className="mt-2 text-sm">{d.result?.feedback.verdict}</p>
              <ul className="list-disc pl-5 text-sm">{d.result?.feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </details>
          ))}
        </section>
      ) : null}

      {gdReviews?.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Group discussion feedback from your teacher</h2>
          {gdReviews.map((r) => (
            <article key={r.id} className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Faculty-reviewed · {new Date(r.created_at).toLocaleDateString()}</p>
              <p className="mt-2 text-sm">{Object.entries(r.scores).map(([k, v]) => `${k}: ${v}/5`).join(" · ")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.feedback}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
