import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ExamRoom, type ExamCase } from "@/components/certificates/exam-room";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeLockout } from "@/lib/exam-lockouts";
import { attemptPath, attemptState } from "@/lib/certificates";
import type { CertAnswerRow, CertAttemptRow, CertExamRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Certificate exam" };
export const dynamic = "force-dynamic";

/**
 * One attempt: the exam room while it is open, the result once it is marked.
 * The cases are only sent to the page once the attempt exists and is open, so
 * nobody can read them before paying, and nobody can read them again after.
 */
export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=${attemptPath(id)}`);

  const admin = createAdminClient();
  const { data } = await admin.from("cert_attempts").select("*").eq("id", id).maybeSingle();
  let attempt = data as CertAttemptRow | null;
  if (!attempt || attempt.user_id !== profile.id) notFound();

  const { data: examData } = await admin.from("cert_exams").select("*").eq("id", attempt.exam_id).single();
  const exam = examData as CertExamRow;

  // A sitting the proctor ended is void — recorded here as well as on submit,
  // so the page never offers to resume it.
  if (attempt.status === "in_progress" && !attempt.submitted_at) {
    const lock = await activeLockout(admin, profile.id, attemptPath(id));
    if (lock.state) {
      const { data: voided } = await admin
        .from("cert_attempts")
        .update({ status: "voided", void_reason: "The exam was ended by proctoring (the window was left, or the camera stopped)." })
        .eq("id", id)
        .eq("status", "in_progress")
        .select("*");
      attempt = (voided?.[0] as CertAttemptRow | undefined) ?? attempt;
    }
  }

  const state = attemptState(attempt);

  if (state === "graded") {
    const { data: answers } = await admin.from("cert_answers").select("*").eq("attempt_id", id);
    const { data: cases } = await admin.from("cases").select("id, title").in("id", exam.case_ids);
    const titleOf = new Map((cases ?? []).map((c) => [c.id, c.title]));
    return (
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{exam.title} · result</p>
        <h1 className="mt-4 font-editorial text-[2.8rem] font-normal leading-tight">
          {attempt.passed ? (
            <>You <em className="italic">passed</em>.</>
          ) : (
            <>Not this time.</>
          )}
        </h1>
        <p className="mt-3 font-editorial text-6xl">{attempt.percentage}%</p>
        <p className="mt-1 text-sm text-muted-foreground">Pass mark {exam.pass_pct}%.</p>

        {attempt.passed && attempt.certificate_code ? (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button variant="ink" size="lg" asChild>
              <Link href={`/certificate/${attempt.certificate_code}`}>View your certificate</Link>
            </Button>
            <span className="font-mono text-xs text-muted-foreground">{attempt.certificate_code}</span>
          </div>
        ) : (
          <div className="mt-6">
            <Button variant="outline" asChild>
              <Link href={`/certificates/${exam.slug}`}>Try again</Link>
            </Button>
          </div>
        )}

        <div className="mt-12 space-y-8">
          {((answers ?? []) as CertAnswerRow[]).map((a, i) => {
            const fb = (a.feedback ?? {}) as { verdict?: string; strengths?: string[]; improvements?: string[] };
            return (
              <section key={a.case_id} className="border-t border-border pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-editorial text-2xl font-normal">
                    Case {i + 1}: {titleOf.get(a.case_id)}
                  </h2>
                  <span className="font-mono text-sm tabular">
                    {a.total_score}/{a.max_score}
                  </span>
                </div>
                {fb.verdict && <p className="mt-3 text-sm leading-relaxed">{fb.verdict}</p>}
                <div className="mt-4 grid gap-6 text-sm sm:grid-cols-2">
                  {fb.strengths?.length ? (
                    <div>
                      <p className="font-medium">What worked</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {fb.strengths.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {fb.improvements?.length ? (
                    <div>
                      <p className="font-medium">To improve</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {fb.improvements.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (state === "voided" || state === "expired") {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{exam.title}</p>
        <h1 className="mt-4 font-editorial text-[2.4rem] font-normal leading-tight">This attempt is over.</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {state === "expired" ? "The time ran out before the exam was submitted." : attempt.void_reason ?? "The attempt was voided."}
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href={`/certificates/${exam.slug}`}>Buy another attempt</Link>
        </Button>
      </div>
    );
  }

  // ready, in_progress or grading: the room. The cases are sent only once the
  // clock is running — before that they would sit in the page payload, readable
  // by anyone who opened the developer tools before pressing start.
  const { data: caseRows } =
    state === "in_progress"
      ? await admin.from("cases").select("id, title, scenario, instructions, supporting_data").in("id", exam.case_ids)
      : { data: [] as { id: string; title: string; scenario: string; instructions: string | null; supporting_data: unknown }[] };
  const cases: ExamCase[] = exam.case_ids
    .map((cid) => (caseRows ?? []).find((c) => c.id === cid))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      title: c.title,
      scenario: c.scenario,
      instructions: c.instructions,
      supporting_data: c.supporting_data,
    }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Certificate exam</p>
      <h1 className="mt-3 font-editorial text-[2.2rem] font-normal leading-tight">{exam.title}</h1>
      <div className="mt-8">
        <ExamRoom
          attemptId={attempt.id}
          title={exam.title}
          durationMinutes={exam.duration_minutes}
          passPct={exam.pass_pct}
          cases={cases}
          caseCount={exam.case_ids.length}
          initialDeadline={attempt.deadline_at}
          retryGrading={state === "grading"}
        />
      </div>
    </div>
  );
}
