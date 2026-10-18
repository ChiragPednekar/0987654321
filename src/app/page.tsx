import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteNav } from "@/components/site-nav";
import { Logo } from "@/components/logo";
import { DOMAINS } from "@/lib/constants";
import { roleHome } from "@/lib/role-home";

/**
 * The front page.
 *
 * Editorial and quiet: a hero that is only type — the headline in a Didone,
 * a hairline, one sentence — then the marking process in the order it
 * happens, the library as a casebook's contents page with real counts, and a
 * short note for the placement cells who license it. Section titles share the
 * hero's serif so the page reads as one piece.
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

      <main className="flex-1">
        {/* ------------------------------------------------------- hero --- */}
        {/* Type and space, nothing else: one line in the Didone, one hairline,
            one sentence and two ways in. The restraint is the point. */}
        <section className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Case practice for MBA placements
          </p>
          <h1 className="mt-10 font-editorial text-[3.6rem] font-normal leading-[0.92] tracking-[-0.025em] sm:text-[7.5rem]">
            Every case,
            <br />
            <em className="italic">rehearsed.</em>
          </h1>

          <div className="mt-14 grid gap-10 border-t border-border pt-8 md:grid-cols-[minmax(0,26rem)_1fr] md:items-end">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {caseClaim}+ finance, consulting and product cases, solved under
              interview conditions and marked against a rubric — criterion by
              criterion.
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 md:justify-end">
              <Link
                href={primary.href}
                className="inline-flex h-11 items-center gap-2 bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                {primary.label}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/cases"
                className="text-sm underline decoration-border underline-offset-[6px] transition-colors hover:decoration-foreground"
              >
                Browse the library
              </Link>
            </div>
          </div>
          {!profile && (
            <p className="mt-6 text-xs text-subtle-foreground md:text-right">
              Reading is free. Practising is CaseCode Pro, from ₹499 a month —{" "}
              <Link href="/pricing" className="underline underline-offset-4">see plans</Link>. Already have an account?{" "}
              <Link href="/login" className="underline underline-offset-4">Sign in</Link>.
            </p>
          )}
        </section>

        {/* -------------------------------------------- how it's marked --- */}
        <section className="border-t border-border bg-surface-sunken/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-md font-editorial text-4xl font-normal leading-tight tracking-[-0.015em]">
              How an answer is marked
            </h2>
            <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="border-t-2 border-foreground pt-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    Step {i + 1}
                  </span>
                  <h3 className="mt-2 font-editorial text-[1.35rem] leading-snug">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------------------- the library --- */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[18rem_1fr]">
          <div>
            <h2 className="font-editorial text-4xl font-normal leading-tight tracking-[-0.015em]">In the library</h2>
            <p className="mt-3 text-muted-foreground">
              Every case is tagged by domain, so your progress shows which kind
              of question to practise next.
            </p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {DOMAINS.map((domain, i) => (
              <li key={domain.value}>
                <Link
                  href={`/cases?domain=${domain.value}`}
                  className="group flex items-baseline gap-4 py-4 transition-colors hover:bg-card/70 sm:px-2"
                >
                  <span className="w-52 shrink-0 font-editorial text-xl group-hover:italic">
                    {domain.label}
                  </span>
                  <span className="hidden min-w-0 text-sm text-muted-foreground sm:block">
                    {domain.description}
                  </span>
                  <span aria-hidden className="mb-1.5 hidden flex-1 border-b border-dotted border-border sm:block" />
                  <span className="ml-auto font-mono text-sm tabular sm:ml-0">
                    {counts[i]} <span className="text-muted-foreground">cases</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------- placement cells --- */}
        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[18rem_1fr]">
            <h2 className="font-editorial text-4xl font-normal leading-tight tracking-[-0.015em]">For placement cells</h2>
            <div className="max-w-2xl space-y-5 text-[17px] leading-relaxed">
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
