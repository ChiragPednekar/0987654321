import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
  description: "CaseCode is free while it is in early access.",
};

const FREE = [
  "All 300 cases across Finance, Consulting and Product",
  "Rubric-based AI grading with per-criterion feedback",
  "Progress tracking, streaks and skill radar",
  "Campus and global leaderboards",
  "Weekly contests",
];

const LATER = [
  "Unlimited re-attempts with fresh case variants",
  "Timed interview simulation",
  "Pattern analytics across your submissions",
  "Rubrics reviewed by ex-consultants and ex-bankers",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-medium text-primary">Pricing</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Free while we get it right
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          CaseCode is in early access. Everything is free — no card, no trial
          timer. Charging before the core loop is genuinely good would be
          putting the cart first.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card className="flex flex-col p-6 ring-1 ring-primary/40">
          <div>
            <h2 className="text-base font-semibold">Early access</h2>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              Free
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                / forever for early users
              </span>
            </p>
          </div>

          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {FREE.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <Button asChild className="mt-6 w-full">
            <Link href="/signup">Start solving free</Link>
          </Button>
        </Card>

        <Card className="flex flex-col p-6">
          <div>
            <h2 className="text-base font-semibold">Pro</h2>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              Later
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                / not yet priced
              </span>
            </p>
          </div>

          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {LATER.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>

          <Button variant="outline" className="mt-6 w-full" disabled>
            Not available yet
          </Button>
        </Card>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Early users keep free access to everything listed above when paid plans
        arrive.{" "}
        <Link href="/how-grading-works" className="underline underline-offset-4">
          How grading works
        </Link>
      </p>
    </div>
  );
}
