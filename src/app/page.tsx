import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Flame,
  Swords,
  Target,
} from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DOMAINS } from "@/lib/constants";

const FEATURES = [
  {
    icon: Brain,
    title: "Graded against a rubric",
    body: "Every case ships with an explicit rubric. You get points per criterion, not a vague vibe — plus strengths, gaps, and what to do next time.",
  },
  {
    icon: BarChart3,
    title: "Progress you can see",
    body: "A skill radar across five domains, streaks, CE and levels. You find out which muscle is weak before an interviewer does.",
  },
  {
    icon: Target,
    title: "Structured paths",
    body: "Finance, consulting and PM tracks that unlock progressively. Start at financial statements, finish at M&A.",
  },
  {
    icon: Swords,
    title: "Weekly contests",
    body: "One featured case a week, a two-hour timer, and a speed bonus. Friday to Sunday, ranked against everyone else.",
  },
];

export default async function LandingPage() {
  const profile = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav profile={profile} />

      <main className="flex-1">
        {/* ------------------------------------------------------- hero --- */}
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5 py-1">
              <Flame className="size-3.5 text-[var(--warning)]" />
              300+ cases across five domains
            </Badge>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              LeetCode, but for{" "}
              <span className="text-primary">business decisions</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Theory is not the bottleneck. Reps are. Solve realistic finance,
              consulting and product cases, get graded against a real rubric, and
              watch your weak domains turn into strong ones.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href={profile ? "/cases" : "/signup"}>
                  {profile ? "Browse cases" : "Start solving free"}
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/cases">See the case library</Link>
              </Button>
            </div>
          </div>

          {/* Sample evaluation — shows the product rather than describing it. */}
          <Card className="mx-auto mt-20 max-w-3xl overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-destructive/60" />
                <span className="size-2.5 rounded-full bg-[var(--warning)]/60" />
                <span className="size-2.5 rounded-full bg-[var(--success)]/60" />
              </div>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                AI review · SaaS Capital Raise · Medium
              </span>
            </div>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total score</span>
                <span className="text-3xl font-semibold tabular">
                  64<span className="text-lg text-muted-foreground">/80</span>
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  ["Financial analysis", 18, 20],
                  ["Market analysis", 15, 20],
                  ["Risk assessment", 14, 20],
                  ["Recommendation", 17, 20],
                ].map(([label, got, max]) => (
                  <div key={label as string} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="tabular">
                        {got}/{max}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${((got as number) / (max as number)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Where you lost points</p>
                <p className="mt-1 text-muted-foreground">
                  You never computed the burn multiple, so the 30% growth against
                  ₹20 Cr of burn is asserted as &ldquo;efficient&rdquo; rather than
                  shown. Quantify it, then argue.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* --------------------------------------------------- features --- */}
        <section className="border-t border-border bg-muted/20 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Practice that actually compounds
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <Card key={feature.title}>
                  <CardContent className="flex gap-4 p-6">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">{feature.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {feature.body}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- domains --- */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Five domains
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Every case is tagged, so your radar chart tells you exactly where to
              spend the next hour.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {DOMAINS.map((domain) => (
                <Link key={domain.value} href={`/cases?domain=${domain.value}`}>
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardContent className="p-5">
                      <div className={`text-sm font-medium ${domain.color}`}>
                        {domain.label}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {domain.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- cta --- */}
        <section className="border-t border-border py-20">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">
              Solve your first case today
            </h2>
            <p className="mt-4 text-muted-foreground">
              Free to start. No card. Your first evaluation takes about thirty
              seconds.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href={profile ? "/cases" : "/signup"}>
                {profile ? "Browse cases" : "Create your account"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>CaseCode</span>
          <nav className="flex gap-4">
            <Link href="/cases" className="hover:text-foreground">
              Cases
            </Link>
            <Link href="/leaderboard" className="hover:text-foreground">
              Leaderboard
            </Link>
            <Link href="/contests" className="hover:text-foreground">
              Contests
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
