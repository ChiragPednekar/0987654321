import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";
import { attemptState } from "@/lib/certificates";
import { rupees } from "@/lib/pricing";
import type { CertAttemptRow, CertExamRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Certificate exam" };

/**
 * One exam: what it covers, the rules, the price — and either the pay button
 * or the way into an attempt already bought. The cases themselves are not
 * named here; they are revealed when the sitting starts.
 */
export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCurrentUser();
  const admin = createAdminClient();

  const { data } = await admin.from("cert_exams").select("*").eq("slug", slug).maybeSingle();
  const exam = data as CertExamRow | null;
  if (!exam || !exam.is_published) notFound();

  const [{ data: attempts }, mode] = await Promise.all([
    profile
      ? admin.from("cert_attempts").select("*").eq("exam_id", exam.id).eq("user_id", profile.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as CertAttemptRow[] }),
    profile ? checkoutModeFor(admin, profile) : Promise.resolve(checkoutMode()),
  ]);
  const open = ((attempts ?? []) as CertAttemptRow[]).find((a) => ["ready", "in_progress"].includes(attemptState(a)));
  const passed = ((attempts ?? []) as CertAttemptRow[]).find((a) => a.passed && a.certificate_code);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <Link href="/certificates" className="text-sm text-muted-foreground hover:text-foreground">
        ← All exams
      </Link>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{exam.track} certificate</p>
      <h1 className="mt-3 font-editorial text-[2.6rem] font-normal leading-tight">{exam.title}</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{exam.summary}</p>

      <div className="mt-10 grid gap-x-14 gap-y-10 lg:grid-cols-[1fr_20rem]">
        <section className="border-t-2 border-foreground pt-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li>Buy one attempt. Start it whenever you are ready — the clock starts when you press start, not when you pay.</li>
            <li>
              You get {exam.case_ids.length} cases and {exam.duration_minutes} minutes. The page goes fullscreen, your camera
              stays on, and pasting is disabled.
            </li>
            <li>Leaving the window or switching tabs ends the exam, and the attempt is void.</li>
            <li>Each answer is marked against its case&apos;s rubric. Score {exam.pass_pct}% or more overall to pass.</li>
            <li>Pass, and you get a certificate with a public verification link, ready for your CV and LinkedIn.</li>
          </ol>
        </section>

        <aside className="border-t-2 border-foreground pt-5">
          <p className="text-sm text-muted-foreground">One attempt</p>
          <p className="font-editorial text-5xl">{rupees(exam.price_paise)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pass or not — retakes are a new attempt.</p>
          <div className="mt-6">
            {open ? (
              <Button variant="ink" size="lg" className="w-full" asChild>
                <Link href={`/certificates/attempt/${open.id}`}>
                  {attemptState(open) === "ready" ? "Go to your attempt" : "Return to your exam"}
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
                label={profile ? `Pay ${rupees(exam.price_paise)}` : "Sign in to take this exam"}
                size="lg"
                className="w-full"
              />
            )}
          </div>
          {mode === "demo" && !open && profile ? (
            <p className="mt-3 text-xs text-muted-foreground">Demo checkout: no money is taken.</p>
          ) : null}
          {passed ? (
            <p className="mt-4 text-xs text-muted-foreground">
              You passed this exam —{" "}
              <Link href={`/certificate/${passed.certificate_code}`} className="underline underline-offset-4">
                view your certificate
              </Link>
              .
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
