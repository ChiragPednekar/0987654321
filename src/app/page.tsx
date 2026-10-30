import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteNav } from "@/components/site-nav";
import { Logo } from "@/components/logo";
import { DOMAINS } from "@/lib/constants";
import { roleHome } from "@/lib/role-home";

/**
 * The front page.
 *
 * In the manner of an Apple product page: a centred hero that is only type —
 * a bold two-tone headline, one sentence, a filled button and a text link —
 * then the marking process as four tiles, the library as an inset grouped
 * list with real counts, and a short note for the placement cells who
 * license it.
 *
 * Anyone can sign up (071) and read the library; practising is CaseCode Pro,
 * bought individually or through a college licence.
 */

const STEPS = [
  {
    title: "Read the brief",
    body: "A situation, the figures, and a decision to make — set as a document, the way it arrives in an interview.",
  },
  {
    title: "Commit to an answer",
    body: "Write the recommendation with the camera on and the window locked, the way a timed round runs.",
  },
  {
    title: "Marked against the rubric",
    body: "Every case carries its own criteria and weights. Marks are given per criterion, never for length.",
  },
  {
    title: "See what you skipped",
    body: "Lost marks come back with the step behind them: the number you asserted instead of showing.",
  },
];

export default async function LandingPage() {
  const profile = await getCurrentUser();
  // Counted, not hard-coded: a literal goes stale the moment more cases are
  // seeded. One head-only count per domain. On the service role because a
  // signed-out visitor cannot read cases at all, and these are only counts of
  // the published platform library — nothing a visitor could not be told.
  const admin = createAdminClient();
  const counts = await Promise.all(
    DOMAINS.map((d) =>
      admin
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("visibility", "platform")
        .eq("is_published", true)
        .eq("domain", d.value)
        .then(({ count }) => count ?? 0),
    ),
  );
  const total = counts.reduce((n, c) => n + c, 0);
  // Rounded down so it reads as a claim, not a live counter; never overstates.
  const caseClaim = total > 0 ? Math.floor(total / 50) * 50 : 500;

  const primary = profile
    ? { href: roleHome(profile.role), label: "Go to your dashboard" }
    : { href: "/signup", label: "Create a free account" };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav profile={profile} />

      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* ------------------------------------------------------- hero --- */}
        <section className="mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-28">
          <p className="text-[15px] font-semibold text-muted-foreground">
            Case practice for MBA placements
          </p>
          <h1 className="hero-title mt-4 text-[3rem] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[5rem]">
            Every case,
            <br />
            <span className="text-muted-foreground">rehearsed.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[1.2rem] leading-snug text-muted-foreground sm:text-[1.35rem]">
            {caseClaim}+ finance, consulting and product cases, solved under
            interview conditions and marked against a rubric — criterion by
            criterion.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <Link
              href={primary.href}
              className="inline-flex h-11 items-center rounded-full bg-action px-6 text-base font-medium text-action-foreground transition-colors hover:bg-action-hover"
            >
              {primary.label}
            </Link>
            <Link
              href="/cases"
              className="inline-flex items-center gap-0.5 text-base text-brand hover:underline"
            >
              Browse the library
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          {!profile && (
            <p className="mt-8 text-[13px] text-muted-foreground">
              Reading is free. Practising is CaseCode Pro, from ₹499 a month —{" "}
              <Link href="/pricing" className="text-brand hover:underline">see plans</Link>. Already have an account?{" "}
              <Link href="/login" className="text-brand hover:underline">Sign in</Link>.
            </p>
          )}
        </section>

        {/* -------------------------------------------- how it's marked --- */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="text-center text-[2rem] font-bold tracking-[-0.03em] sm:text-[2.5rem]">
            How an answer is marked
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl bg-card p-6 shadow-xs dark:shadow-none">
                <span className="text-[13px] font-semibold text-muted-foreground">
                  Step {i + 1}
                </span>
                <h3 className="mt-2 text-[1.2rem] font-bold leading-snug tracking-[-0.015em]">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* -------------------------------------------------- the library --- */}
        <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-[18rem_1fr]">
          <div>
            <h2 className="text-[2rem] font-bold tracking-[-0.03em]">In the library</h2>
            <p className="mt-3 text-[17px] text-muted-foreground">
              Every case is tagged by domain, so your progress shows which kind
              of question to practise next.
            </p>
          </div>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-2xl bg-card shadow-xs dark:shadow-none">
            {DOMAINS.map((domain, i) => (
              <li key={domain.value}>
                <Link
                  href={`/cases?domain=${domain.value}`}
                  className="flex min-h-14 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{domain.label}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {domain.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular">
                    {counts[i]} cases
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------- placement cells --- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="grid gap-8 rounded-3xl bg-card p-8 shadow-xs dark:shadow-none sm:p-12 lg:grid-cols-[18rem_1fr]">
            <h2 className="text-[2rem] font-bold leading-tight tracking-[-0.03em]">For placement cells</h2>
            <div className="max-w-2xl space-y-4 text-[17px] leading-relaxed">
              <p>
                Set cases, SQL and Excel exercises and aptitude quizzes for a
                batch straight from the library, or write your own.
              </p>
              <p>
                The marking is done for you. Each student&apos;s score, attempts
                and time come back to one page, before placement week rather
                than after it.
              </p>
              <p>
                Tests are proctored: camera on, window locked. A flagged attempt
                is held for 24 hours and recorded with a photo for you to review.
              </p>
              <p className="text-base text-muted-foreground">
                CaseCode is licensed to colleges; students get access through
                their institution.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="text-foreground" />
          <nav className="flex gap-5">
            <Link href="/cases" className="hover:text-foreground">Cases</Link>
            <Link href="/leaderboard" className="hover:text-foreground">Leaderboard</Link>
            <Link href="/groups" className="hover:text-foreground">Groups</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
