import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, CheckCircle2, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { Section } from "@/components/section";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";
import { attemptState } from "@/lib/certificates";
import { getCertCourse } from "@/lib/cert-courses";
import { getCourseProgress, type CourseProgress } from "@/lib/course-progress";
import { rupees } from "@/lib/pricing";
import { formatDay } from "@/lib/utils";
import type { CertAttemptRow, CertExamRow } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Certificates & Courses",
  description: "Structured preparation courses and timed proctored case exams with verifiable certificates for your CV and LinkedIn.",
};

const STATE_LABEL: Record<string, string> = {
  ready: "Ready to start",
  in_progress: "In progress",
  grading: "Being marked",
  expired: "Time ran out",
  voided: "Void",
  graded: "Marked",
};

export default async function CertificatesPage() {
  const profile = await getCurrentUser();
  const admin = createAdminClient();
  const [{ data: exams }, { data: attempts }, mode, comp] = await Promise.all([
    admin.from("cert_exams").select("*").eq("is_published", true).order("title"),
    profile
      ? admin.from("cert_attempts").select("*").eq("user_id", profile.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as CertAttemptRow[] }),
    profile ? checkoutModeFor(admin, profile) : Promise.resolve(checkoutMode()),
    profile ? admin.rpc("is_complimentary", { p_user: profile.id }) : Promise.resolve({ data: false }),
  ]);
  const isComplimentary = Boolean(profile?.role === "admin" || comp.data === true);
  const examById = new Map(((exams ?? []) as CertExamRow[]).map((e) => [e.id, e]));
  const progressBySlug = new Map<string, CourseProgress>(
    profile
      ? await Promise.all(
          ((exams ?? []) as CertExamRow[]).map(
            async (e) => [e.slug, await getCourseProgress(admin, profile.id, e.slug)] as const,
          ),
        )
      : [],
  );
  const earned = ((attempts ?? []) as CertAttemptRow[]).filter((a) => a.passed && a.certificate_code);
  const openAttempts = new Map(
    ((attempts ?? []) as CertAttemptRow[])
      .filter((a) => ["ready", "in_progress"].includes(attemptState(a)))
      .map((a) => [a.exam_id, a]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      {/* ---------------------------------------------------- Hero Header --- */}
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Certifications &amp; Courses
        </p>
        <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.4rem]">
          Learn the frameworks. <em className="italic">Prove it under exam conditions</em>.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Each certification includes a structured preparation curriculum paired with real practice cases.
          Study the core mental models and business arithmetic first, then sit for the proctored exam to earn a verifiable
          credential with 1-click addition to your LinkedIn profile.
        </p>
      </header>

      {/* --------------------------------------- Certification Roadmap --- */}
      <div className="mt-10 rounded-lg border border-border bg-card/40 p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">How the Certification Works</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <div className="rounded border border-border/80 bg-background p-4">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Step 1</span>
            <p className="mt-1 text-sm font-semibold">1. Study Curriculum</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              4 modules with framework guides, formula sheets, and common pitfalls.
            </p>
          </div>
          <div className="rounded border border-border/80 bg-background p-4">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Step 2</span>
            <p className="mt-1 text-sm font-semibold">2. Solve Practice Cases</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Apply frameworks to real library cases with immediate AI rubric grading.
            </p>
          </div>
          <div className="rounded border border-border/80 bg-background p-4">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Step 3</span>
            <p className="mt-1 text-sm font-semibold">3. Proctored Exam</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Two timed cases in 90 minutes under camera and window-lock proctoring.
            </p>
          </div>
          <div className="rounded border border-border/80 bg-background p-4">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Step 4</span>
            <p className="mt-1 text-sm font-semibold">4. Verified Credential</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Score 60%+ to earn a public certificate page and LinkedIn credential.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- Programs Catalog --- */}
      <Section title="Certification Programs" count={(exams ?? []).length}>
        <ul className="divide-y divide-border">
          {((exams ?? []) as CertExamRow[]).map((exam) => {
            const open = openAttempts.get(exam.id);
            const course = getCertCourse(exam.slug);
            const progress = progressBySlug.get(exam.slug);

            return (
              <li key={exam.id} className="grid gap-4 py-7 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{exam.track}</p>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">Course Included</span>
                  </div>

                  <Link href={`/certificates/${exam.slug}`} className="mt-1 inline-block font-editorial text-2xl hover:underline sm:text-3xl">
                    {exam.title}
                  </Link>

                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {course?.subtitle ?? exam.summary}
                  </p>

                  {/* Course Feature Badges */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded border border-border bg-card px-2.5 py-0.5 font-mono text-[11px] text-foreground">
                      4 Prep Modules (~{course?.estimatedHours ?? 8}h)
                    </span>
                    <span className="rounded border border-border bg-card px-2.5 py-0.5 font-mono text-[11px] text-foreground">
                      Frameworks &amp; Formula Sheets
                    </span>
                    <span className="rounded border border-border bg-card px-2.5 py-0.5 font-mono text-[11px] text-foreground">
                      8 Practice Cases
                    </span>
                    <span className="rounded border border-border/60 bg-muted/40 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      Exam: 2 cases · {exam.duration_minutes} min · pass {exam.pass_pct}%
                    </span>
                  </div>
                  {progress && progress.total > 0 && (
                    <p className="mt-3 font-mono text-xs text-muted-foreground">
                      Course: {progress.passed.length} of {progress.total} modules passed
                      {progress.complete ? " · exam unlocked" : " · exam unlocks when all are passed"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <div className="text-right">
                    {!open && !isComplimentary ? (
                      <>
                        <span className="font-editorial text-3xl">{rupees(exam.price_paise)}</span>
                        <p className="text-[11px] text-muted-foreground">course free · pay per exam attempt</p>
                      </>
                    ) : open ? (
                      <>
                        <span className="inline-flex items-center rounded border border-emerald-600/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {attemptState(open) === "ready" ? "Attempt ready" : "In progress"}
                        </span>
                        <p className="mt-1 text-[11px] text-muted-foreground">Access active</p>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center rounded border border-emerald-600/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Included
                        </span>
                        <p className="mt-1 text-[11px] text-muted-foreground">Complimentary access</p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant={open ? "outline" : "ink"} size="sm" asChild>
                      <Link href={`/certificates/${exam.slug}`}>
                        {!progress || progress.passed.length === 0
                          ? "Start course"
                          : progress.complete
                            ? "Open course & exam"
                            : "Continue course"}
                      </Link>
                    </Button>

                    {!open && (!profile || !progress?.complete) ? null : open ? (
                      <Button variant="ink" size="sm" asChild>
                        <Link href={`/certificates/attempt/${open.id}`}>
                          {attemptState(open) === "ready" ? "Start exam" : "Resume exam"}
                        </Link>
                      </Button>
                    ) : (
                      <CheckoutButton
                        item={{ kind: "exam", slug: exam.slug }}
                        mode={isComplimentary ? "demo" : mode}
                        signedIn={Boolean(profile)}
                        email={profile?.email}
                        name={profile?.full_name}
                        loginNext={`/certificates/${exam.slug}`}
                        label={isComplimentary ? "Start attempt — included" : "Take exam"}
                        variant="outline"
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ---------------------------------------------- Active Attempts --- */}
      {profile && (attempts ?? []).length > 0 && (
        <Section title="Your attempts" count={(attempts ?? []).length}>
          <ul className="divide-y divide-border text-sm">
            {((attempts ?? []) as CertAttemptRow[]).map((a) => {
              const state = attemptState(a);
              return (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                  <Link href={`/certificates/attempt/${a.id}`} className="hover:underline">
                    {examById.get(a.exam_id)?.title ?? "Exam"}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {STATE_LABEL[state]}
                    {state === "graded" && a.percentage !== null ? ` · ${a.percentage}% · ${a.passed ? "passed" : "not passed"}` : ""}
                    {" · "}
                    {formatDay(a.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* ------------------------------------------- Earned Credentials --- */}
      {earned.length > 0 && (
        <Section title="Your certificates" count={earned.length}>
          <ul className="divide-y divide-border text-sm">
            {earned.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <span>{examById.get(a.exam_id)?.title}</span>
                <Link href={`/certificate/${a.certificate_code}`} className="font-mono text-xs underline underline-offset-4">
                  {a.certificate_code}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
