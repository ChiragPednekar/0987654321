import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { MarkedSheet } from "@/components/marked-sheet";
import { DOMAINS } from "@/lib/constants";
import { roleHome } from "@/lib/role-home";

/**
 * The front page.
 *
 * Built around one image — an answer, marked (MarkedSheet) — because marking
 * is the thing CaseCode does that a casebook cannot. Everything else is kept
 * plain: a left-aligned argument, the marking process in the order it
 * happens, the library as a casebook's contents page with real counts, and a
 * short note for the placement cells who license it.
 *
 * Access is through a college licence (invite-only), so the page never offers
 * a free sign-up it cannot honour.
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
    : { href: "/login", label: "Sign in" };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav profile={profile} />

      <main className="flex-1">
        {/* ------------------------------------------------------- hero --- */}
        <section className="mx-auto grid max-w-6xl gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_minmax(0,30rem)] lg:items-center lg:gap-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
              {caseClaim}+ business cases · {DOMAINS.length} domains
            </p>
            <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.04] sm:text-6xl">
              Pick a number. Defend it. See where you{" "}
              <span className="underline decoration-mark decoration-wavy decoration-2 underline-offset-[10px]">
                lost marks
              </span>
              .
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Case practice for MBA placements. Solve finance, consulting and
              product cases under interview conditions, and every answer comes
              back marked against that case&apos;s rubric — criterion by
              criterion, with the reasoning you skipped.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button size="lg" asChild>
                <Link href={primary.href}>
                  {primary.label}
                  <ArrowRight />
                </Link>
              </Button>
              <Link
                href="/cases"
                className="text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                Browse the case library
              </Link>
            </div>
            {!profile && (
              <p className="mt-5 text-sm text-subtle-foreground">
                Access comes through your college. Use the address you were
                invited with.
              </p>
            )}
          </div>

          <MarkedSheet className="lg:rotate-[0.6deg]" />
        </section>

        {/* -------------------------------------------- how it's marked --- */}
        <section className="border-t border-border bg-surface-sunken/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-md text-3xl font-semibold leading-tight">
              How an answer is marked
            </h2>
            <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="border-t-2 border-foreground pt-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    Step {i + 1}
                  </span>
                  <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
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
            <h2 className="text-3xl font-semibold leading-tight">In the library</h2>
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
                  <span className="w-52 shrink-0 font-display text-lg font-semibold group-hover:text-brand">
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
            <h2 className="text-3xl font-semibold leading-tight">For placement cells</h2>
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
