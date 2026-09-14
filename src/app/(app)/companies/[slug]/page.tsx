import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, CircleAlert, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INTERVIEW_ROUNDS, ROUND_LABEL, lastChecked, type InterviewRound } from "@/lib/companies";
import { ReportQuestion } from "@/components/companies/report-question";

export const metadata: Metadata = { title: "Company prep" };

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/companies/${slug}`);

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("id, slug, name, sector, roles, summary, rounds, look_for, practice, sources")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!company) notFound();

  // Approved questions carry no reporter. The student's own pending reports are
  // fetched separately so they can see what is waiting.
  const [{ data: approved }, { data: mine }] = await Promise.all([
    admin
      .from("company_question_reports")
      .select("id, role, round, year, question")
      .eq("company_id", company.id)
      .eq("status", "approved")
      .order("year", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("company_question_reports")
      .select("id, role, round, year, question, status")
      .eq("company_id", company.id)
      .eq("user_id", user.id)
      .neq("status", "approved")
      .order("created_at", { ascending: false }),
  ]);

  const byRound = new Map<InterviewRound, NonNullable<typeof approved>>();
  for (const q of approved ?? []) {
    const round = q.round as InterviewRound;
    byRound.set(round, [...(byRound.get(round) ?? []), q]);
  }

  // A profile is only presented as checked when it lists what it was checked
  // against. The date it was written is deliberately not shown: it used to read
  // as "last reviewed", which claimed a verification nobody had done.
  const sources = company.sources ?? [];
  const checkedOn = lastChecked(sources);
  const checked = checkedOn
    ? new Date(`${checkedOn}T00:00:00Z`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">
        ← Company prep
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
        <Badge variant="outline">{company.sector}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{company.roles.join(" · ")}</p>
      <p className="mt-3 text-sm">{company.summary}</p>

      {checked ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Checked against{" "}
          <a href="#sources" className="underline underline-offset-2 hover:text-foreground">
            {sources.length === 1 ? "one source" : `${sources.length} sources`}
          </a>
          , most recently on {checked}.
        </p>
      ) : (
        <div className="mt-4 flex gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">Not verified against official sources</p>
            <p className="mt-0.5 text-muted-foreground">
              This is general guidance, written from widely reported descriptions of how{" "}
              {company.name} usually hires. No one has yet checked it against the firm&apos;s own
              careers page or placement records. Confirm the details with your placement cell
              before relying on them.
            </p>
          </div>
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">How the process usually runs</h2>
        <ol className="mt-2 space-y-2">
          {company.rounds.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-muted-foreground">{r.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Processes vary by year, campus and role — check the details with your placement cell.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">What they tend to look for</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {company.look_for.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Practise for it here</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {company.practice.map((p) => (
            <Link key={p.href} href={p.href}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex items-start justify-between gap-2 p-3">
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.why}</p>
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Questions students were asked</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Reported by students after their interviews and checked before they appear. Reporters
          are never named.
        </p>

        {(approved ?? []).length === 0 ? (
          <Card className="mt-3 border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              No reported questions yet. If you have interviewed with {company.name}, the next
              student will thank you for adding one.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 space-y-4">
            {INTERVIEW_ROUNDS.filter((r) => byRound.has(r)).map((round) => (
              <div key={round}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {ROUND_LABEL[round]}
                </p>
                <div className="mt-1.5 space-y-2">
                  {byRound.get(round)!.map((q) => (
                    <Card key={q.id}>
                      <CardContent className="p-3">
                        <p className="whitespace-pre-line text-sm">{q.question}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {q.role} · {q.year}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <ReportQuestion
            slug={company.slug}
            companyName={company.name}
            mine={(mine ?? []).map((m) => ({ ...m, round: m.round as InterviewRound }))}
          />
        </div>
      </section>

      {sources.length > 0 && (
        <section id="sources" className="mt-8 scroll-mt-20">
          <h2 className="text-sm font-semibold">Sources</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            What this profile was checked against. Questions students reported are not covered by
            these — they come from the students themselves.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {sources.map((s) => (
              <li key={s.url} className="flex flex-wrap items-baseline gap-x-2">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-primary"
                >
                  {s.label}
                  <ExternalLink className="size-3" />
                </a>
                <span className="text-xs text-muted-foreground">
                  checked{" "}
                  {new Date(`${s.checked_on}T00:00:00Z`).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        CaseCode is not affiliated with, endorsed by, or connected to {company.name}.
      </p>
    </div>
  );
}
