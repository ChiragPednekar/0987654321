import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, ChevronRight, Lock, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { CertCourseViewer } from "@/components/certificates/cert-course-viewer";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";
import { attemptState } from "@/lib/certificates";
import { getCertCourse } from "@/lib/cert-courses";
import { publicCheck } from "@/lib/cert-course-checks";
import { getCourseProgress } from "@/lib/course-progress";
import { rupees } from "@/lib/pricing";
import type { CertAttemptRow, CertExamRow } from "@/lib/types/database";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("cert_exams").select("title, track, summary").eq("slug", slug).maybeSingle();
  return {
    title: data ? `${data.title} — Course & Certification` : "Certificate exam",
    description: data?.summary ?? "Comprehensive preparation course and timed proctored certification exam.",
  };
}

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCurrentUser();
  const admin = createAdminClient();

  const { data } = await admin.from("cert_exams").select("*").eq("slug", slug).maybeSingle();
  const exam = data as CertExamRow | null;
  if (!exam || !exam.is_published) notFound();

  const fullCourse = getCertCourse(exam.slug);

  const [{ data: attempts }, mode, comp, progress, { data: examCases }] = await Promise.all([
    profile
      ? admin.from("cert_attempts").select("*").eq("exam_id", exam.id).eq("user_id", profile.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as CertAttemptRow[] }),
    profile ? checkoutModeFor(admin, profile) : Promise.resolve(checkoutMode()),
    profile ? admin.rpc("is_complimentary", { p_user: profile.id }) : Promise.resolve({ data: false }),
    profile
      ? getCourseProgress(admin, profile.id, exam.slug)
      : Promise.resolve({ passed: [] as string[], total: fullCourse?.modules.length ?? 0, complete: !fullCourse }),
    admin.from("cases").select("slug").in("id", exam.case_ids),
  ]);

  // Never recommend the exam's own cases as practice, whatever the course file
  // says: that would hand out the exam.
  const examSlugs = new Set((examCases ?? []).map((c) => c.slug));
  const course = fullCourse
    ? {
        ...fullCourse,
        modules: fullCourse.modules.map((m) => ({
          ...m,
          recommendedCases: m.recommendedCases.filter((rc) => !examSlugs.has(rc.slug)),
        })),
      }
    : null;
  const checks = Object.fromEntries((course?.modules ?? []).map((m) => [m.id, publicCheck(m.id)]));

  const included = Boolean(profile?.role === "admin" || comp.data === true);
  const open = ((attempts ?? []) as CertAttemptRow[]).find((a) => ["ready", "in_progress"].includes(attemptState(a)));
  const passed = ((attempts ?? []) as CertAttemptRow[]).find((a) => a.passed && a.certificate_code);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      {/* ------------------------------------------------ Top Navigation --- */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/certificates" className="hover:text-foreground">
          Certificates
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{exam.track}</span>
      </div>

      {/* ---------------------------------------------------- Hero Header --- */}
      <header className="mt-6 border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {exam.track} Track
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs text-muted-foreground">
            Course + Proctored Exam
          </span>
        </div>

        <h1 className="mt-3 font-editorial text-[2.8rem] font-normal leading-[1.02] tracking-[-0.02em] sm:text-[3.4rem]">
          {exam.title}
        </h1>

        <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-muted-foreground">
          {course?.subtitle ?? exam.summary}
        </p>

        {/* 4-Step Pathway Progress Bar */}
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <div className="rounded border border-border bg-card/60 p-3.5">
            <span className="font-mono text-[11px] uppercase text-muted-foreground">Step 1</span>
            <p className="mt-1 text-xs font-semibold text-foreground">Prep Course</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">4 In-depth modules</p>
          </div>
          <div className="rounded border border-border bg-card/60 p-3.5">
            <span className="font-mono text-[11px] uppercase text-muted-foreground">Step 2</span>
            <p className="mt-1 text-xs font-semibold text-foreground">Practice Cases</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">8 AI-graded scenarios</p>
          </div>
          <div className="rounded border border-border bg-card/60 p-3.5">
            <span className="font-mono text-[11px] uppercase text-muted-foreground">Step 3</span>
            <p className="mt-1 text-xs font-semibold text-foreground">Proctored Exam</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">90 min · 2 cases · 60%</p>
          </div>
          <div className="rounded border border-border bg-card/60 p-3.5">
            <span className="font-mono text-[11px] uppercase text-muted-foreground">Step 4</span>
            <p className="mt-1 text-xs font-semibold text-foreground">Verified Certificate</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Public link &amp; LinkedIn</p>
          </div>
        </div>
      </header>

      {/* ------------------------------------ Section 1: The Course --- */}
      <section className="mt-10">
        {course ? (
          <CertCourseViewer
            course={course}
            examTitle={exam.title}
            passedIds={progress.passed}
            checks={checks}
            signedIn={Boolean(profile)}
          />
        ) : null}
      </section>

      {/* -------------------------------- Section 2: Proctored Exam --- */}
      <section id="exam-sitting" className="mt-16 border-t border-border pt-10 scroll-mt-10">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Capstone Assessment
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs text-muted-foreground">Pass mark: {exam.pass_pct}%</span>
        </div>

        <h2 className="mt-2 font-editorial text-3xl font-normal sm:text-4xl">
          The Proctored Examination
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The exam unlocks once every module of the prep course is passed. The cases are held until the clock starts, and your answers are marked against each case&apos;s rubric.
        </p>

        <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-[1fr_22rem]">
          {/* Rules & Requirements */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card/30 p-5">
              <h3 className="font-editorial text-xl font-normal">Exam Structure &amp; Conditions</h3>
              <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <strong className="text-foreground">{exam.case_ids.length} unseen cases in {exam.duration_minutes} minutes:</strong> The clock starts when you click &quot;Start exam&quot;, not when you pay.
                </li>
                <li>
                  <strong className="text-foreground">Proctored environment:</strong> The page enters fullscreen, your camera must remain on, and copy-paste is disabled.
                </li>
                <li>
                  <strong className="text-foreground">Single-window lock:</strong> Navigating away from the window or switching tabs ends the exam and voids the attempt.
                </li>
                <li>
                  <strong className="text-foreground">Standardized grading:</strong> Each submission is graded against the benchmark rubric. Score {exam.pass_pct}% or more overall to pass.
                </li>
                <li>
                  <strong className="text-foreground">Public verification:</strong> Passing awards a permanent credential at <code className="text-xs bg-muted px-1 py-0.5 rounded">/certificate/CC-XXXXX</code> with 1-click LinkedIn addition.
                </li>
              </ol>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-background p-4 text-xs text-muted-foreground">
              <Video className="size-4 shrink-0 text-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Hardware Requirements</p>
                <p className="mt-0.5">Working webcam and microphone. Tested on Chrome, Safari, Edge and Firefox. Stable internet connection required for the 90-minute sitting.</p>
              </div>
            </div>
          </div>

          {/* Pricing & Checkout Card */}
          <aside className="h-fit rounded-lg border-2 border-brand bg-card p-6 shadow-sm">
            {open ? (
              <>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Your Exam Sitting</p>
                <p className="mt-2 font-editorial text-4xl font-normal text-emerald-600 dark:text-emerald-400">
                  {attemptState(open) === "ready" ? "Attempt Ready" : "In Progress"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {attemptState(open) === "ready"
                    ? "Your exam attempt is waiting. The clock starts when you begin."
                    : "Your attempt is currently running. Return before your time expires."}
                </p>
              </>
            ) : included ? (
              <>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Exam Sitting</p>
                <p className="mt-2 font-editorial text-4xl font-normal text-emerald-600 dark:text-emerald-400">
                  Included
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Complimentary access granted on your account — no fee.</p>
              </>
            ) : (
              <>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">One Exam Sitting</p>
                <p className="mt-2 font-editorial text-5xl font-normal">{rupees(exam.price_paise)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Pass or retake — each sitting is an independent attempt.</p>
              </>
            )}

            <div className="mt-6 space-y-3">
              {!open && profile && !progress.complete ? (
                <div className="space-y-2">
                  <Button variant="outline" size="lg" className="w-full text-sm" disabled>
                    <Lock className="mr-1.5 size-4" />
                    Finish the course to unlock
                  </Button>
                  <p className="text-center font-mono text-[11px] text-muted-foreground">
                    {progress.passed.length} of {progress.total} modules passed
                  </p>
                </div>
              ) : open ? (
                <Button variant="ink" size="lg" className="w-full text-sm" asChild>
                  <Link href={`/certificates/attempt/${open.id}`}>
                    {attemptState(open) === "ready" ? "Start exam attempt" : "Resume exam in progress"}
                  </Link>
                </Button>
              ) : (
                <CheckoutButton
                  item={{ kind: "exam", slug: exam.slug }}
                  mode={included ? "demo" : mode}
                  signedIn={Boolean(profile)}
                  email={profile?.email}
                  name={profile?.full_name}
                  loginNext={`/certificates/${exam.slug}`}
                  label={!profile ? "Sign in to take exam" : included ? "Start attempt — included" : `Take exam — ${rupees(exam.price_paise)}`}
                  size="lg"
                  className="w-full text-sm"
                />
              )}

              {!progress.complete && profile && !open ? null : included && !open ? (
                <p className="text-center font-mono text-[11px] text-muted-foreground">
                  Complimentary access granted — no charge.
                </p>
              ) : mode === "demo" && !open && profile ? (
                <p className="text-center font-mono text-[11px] text-muted-foreground">
                  Demo checkout enabled: no real payment taken.
                </p>
              ) : null}
            </div>

            {passed ? (
              <div className="mt-6 border-t border-border pt-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" /> You passed this exam!
                </span>
                <Link
                  href={`/certificate/${passed.certificate_code}`}
                  className="mt-1.5 inline-block text-foreground underline underline-offset-4"
                >
                  View your certificate &amp; badge →
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
