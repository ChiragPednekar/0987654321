import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { getCurrentUser } from "@/lib/supabase/server";
import { razorpayConfigured } from "@/lib/billing/razorpay";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
  description: "CaseCode is free while it is in early access.",
};

const FREE = [
  "All 508 cases across six domains, including drills and model builds",
  "Rubric-based AI grading with per-criterion feedback",
  "Progress tracking, streaks and skill radar",
  "Campus and global leaderboards",
  "Weekly contests, study groups and classrooms",
];

// Only the first entry is live today. The rest stay on the page because they
// are what Pro is being built toward, but they are marked as such below rather
// than implied to be included.
const PRO_NOW = ["Live case interview with an AI interviewer, on every case"];

const PRO_SOON = [
  "Unlimited re-attempts with fresh case variants",
  "Pattern analytics across your submissions",
  "Rubrics reviewed by ex-consultants and ex-bankers",
];

export default async function PricingPage() {
  const profile = await getCurrentUser();
  const paymentsLive = razorpayConfigured();

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
              ₹499
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                / year
              </span>
            </p>
          </div>

          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {PRO_NOW.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
            {PRO_SOON.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                <span className="text-muted-foreground">
                  {item}{" "}
                  <span className="text-xs opacity-70">(planned)</span>
                </span>
              </li>
            ))}
          </ul>

          {paymentsLive ? (
            <UpgradeButton
              signedIn={Boolean(profile)}
              alreadyPro={profile?.plan === "pro"}
              email={profile?.email}
              name={profile?.full_name}
            />
          ) : (
            /* No keys configured on this deployment: showing a button that
               cannot charge anyone would be worse than showing none. */
            <Button variant="outline" className="mt-6 w-full" disabled>
              Not available yet
            </Button>
          )}
        </Card>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Every case stays free to solve and get graded — that does not change.
        Pro adds the live interviewer.{" "}
        <Link href="/how-grading-works" className="underline underline-offset-4">
          How grading works
        </Link>
      </p>
    </div>
  );
}
