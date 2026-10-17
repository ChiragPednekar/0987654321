import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { Section } from "@/components/section";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";
import { attemptState } from "@/lib/certificates";
import { rupees } from "@/lib/pricing";
import { formatDay } from "@/lib/utils";
import type { CertAttemptRow, CertExamRow } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Certificate exams",
  description: "Timed, proctored case exams with a verifiable certificate for your CV and LinkedIn.",
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
  const [{ data: exams }, { data: attempts }, mode] = await Promise.all([
    admin.from("cert_exams").select("*").eq("is_published", true).order("title"),
    profile
      ? admin.from("cert_attempts").select("*").eq("user_id", profile.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as CertAttemptRow[] }),
    profile ? checkoutModeFor(admin, profile) : Promise.resolve(checkoutMode()),
  ]);
  const examById = new Map(((exams ?? []) as CertExamRow[]).map((e) => [e.id, e]));
  const earned = ((attempts ?? []) as CertAttemptRow[]).filter((a) => a.passed && a.certificate_code);
  const openAttempts = new Map(
    ((attempts ?? []) as CertAttemptRow[])
      .filter((a) => ["ready", "in_progress"].includes(attemptState(a)))
      .map((a) => [a.exam_id, a]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Certificates</p>
        <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.4rem]">
          Prove it <em className="italic">under exam conditions</em>.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Each exam is two cases against the clock, proctored with your camera on and the page locked. Pass, and you
          get a certificate with a public verification link for your CV and LinkedIn. You pay for the attempt, pass or
          not — that is what makes the certificate mean something.
        </p>
      </header>

      <Section title="Exams" count={(exams ?? []).length}>
        <ul className="divide-y divide-border">
          {((exams ?? []) as CertExamRow[]).map((exam) => {
            const open = openAttempts.get(exam.id);
            return (
              <li key={exam.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{exam.track}</p>
                  <Link href={`/certificates/${exam.slug}`} className="font-editorial text-2xl hover:underline">
                    {exam.title}
                  </Link>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">{exam.summary}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {exam.case_ids.length} cases · {exam.duration_minutes} min · pass {exam.pass_pct}%
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <span className="font-editorial text-3xl">{rupees(exam.price_paise)}</span>
                  <div className="flex items-center gap-3">
                    <Link href={`/certificates/${exam.slug}`} className="text-sm underline underline-offset-4">
                      Details
                    </Link>
                    {open ? (
                      <Button variant="ink" size="sm" asChild>
                        <Link href={`/certificates/attempt/${open.id}`}>
                          {attemptState(open) === "ready" ? "Start exam" : "Resume"}
                        </Link>
                      </Button>
                    ) : (
                      <CheckoutButton
                        item={{ kind: "exam", slug: exam.slug }}
                        mode={mode}
                        signedIn={Boolean(profile)}
                        email={profile?.email}
                        name={profile?.full_name}
                        loginNext={`/certificates/${exam.slug}`}
                        label="Take exam"
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
