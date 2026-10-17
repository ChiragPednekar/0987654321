import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkedInAddUrl } from "@/lib/certificates";

/**
 * The public face of a certificate: what an employer sees when they follow
 * the link on a CV. Open to anyone, signed in or not.
 *
 * It shows only what a certificate states — who, which exam, the score, when,
 * and that it was sat proctored — and nothing else from the account. A code
 * that does not match a passed attempt is a 404, never a page that looks
 * half-valid.
 */

const CODE = /^CC-[A-Z2-9]{5}-[A-Z2-9]{5}$/;

async function load(code: string) {
  if (!CODE.test(code)) return null;
  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("cert_attempts")
    .select("user_id, exam_id, percentage, graded_at, passed, certificate_code")
    .eq("certificate_code", code)
    .eq("passed", true)
    .maybeSingle();
  if (!attempt) return null;
  const [{ data: exam }, { data: user }] = await Promise.all([
    admin.from("cert_exams").select("title, track, pass_pct, duration_minutes").eq("id", attempt.exam_id).single(),
    admin.from("users").select("full_name").eq("id", attempt.user_id).single(),
  ]);
  if (!exam) return null;
  return { attempt, exam, name: user?.full_name?.trim() || "CaseCode candidate" };
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const cert = await load(code);
  if (!cert) return { title: "Certificate not found" };
  return {
    title: `${cert.name} — ${cert.exam.title} certificate`,
    description: `${cert.name} passed the proctored CaseCode ${cert.exam.title} exam with ${cert.attempt.percentage}%.`,
  };
}

export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await load(code);
  if (!cert) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "casecode.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/certificate/${code}`;
  const issued = cert.attempt.graded_at ?? new Date().toISOString();
  const issuedLabel = new Date(issued).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" aria-label="CaseCode home">
          <Logo />
        </Link>

        <article className="mt-10 border-y-2 border-foreground px-2 py-12 text-center sm:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Certificate of achievement
          </p>
          <p className="mt-8 text-sm text-muted-foreground">This certifies that</p>
          <h1 className="mt-3 font-editorial text-[2.6rem] font-normal leading-tight sm:text-[3.4rem]">{cert.name}</h1>
          <p className="mt-4 text-sm text-muted-foreground">passed the proctored CaseCode exam</p>
          <p className="mt-3 font-editorial text-[1.9rem] italic leading-tight">{cert.exam.title}</p>
          <p className="mt-6 font-mono text-sm tabular">
            Score {cert.attempt.percentage}% · pass mark {cert.exam.pass_pct}%
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {cert.exam.track} · {cert.exam.duration_minutes}-minute timed exam, camera-proctored, marked against
            published rubrics
          </p>
          <div className="mt-10 grid gap-4 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              Issued <span className="text-foreground">{issuedLabel}</span>
            </p>
            <p>
              Certificate <span className="font-mono text-foreground">{code}</span>
            </p>
          </div>
        </article>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Verified by CaseCode. This page is the record: if it loads at this address, the certificate is genuine.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
          <a
            href={linkedInAddUrl({ title: cert.exam.title, issuedAt: issued, url, code })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center bg-foreground px-5 font-medium text-background hover:opacity-85"
          >
            Add to LinkedIn
          </a>
          <span className="font-mono text-xs text-muted-foreground">{url}</span>
        </div>
      </div>
    </main>
  );
}
