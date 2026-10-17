import Link from "next/link";
import type { Metadata } from "next";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { checkoutMode, type CheckoutMode } from "@/lib/billing/checkout-mode";
import { canRenew, getAccess, RENEWAL_WINDOW_DAYS, type Access } from "@/lib/subscription";
import { DOMAINS, MARKETED_CASE_FLOOR, QUOTA } from "@/lib/constants";
import { formatDay } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Subscribe to CaseCode Pro on your own, or practise through your college's campus licence.",
};

/**
 * Two ways to practise: an individual subscription for a student whose college
 * has not bought CaseCode, and a campus licence for colleges. Reading the
 * library is free for everyone.
 *
 * Set like the front page — type, rules and space, no boxed price cards — and
 * every line is something the product actually does.
 */

const PRO = [
  `${QUOTA.pro.gradings} graded answers a year, marked against each case's rubric`,
  `${QUOTA.pro.interviews} AI mock interviews with follow-up questions`,
  "SQL and Excel exercises, aptitude quizzes and quantitative drills",
  "Peer interview rooms, daily quizzes, CV and slide-deck reviews",
];

const CAMPUS = [
  "Every student your placement cell adds can practise — no payment from them",
  "Teacher pages: batches, assignments, your own questions, marking",
  "Proctored tests with camera, microphone and window checks",
  "Batch analytics before placement week",
];

const FREE = [
  `Read all ${MARKETED_CASE_FLOOR}+ cases across ${DOMAINS.length} domains`,
  "See each case's rubric before you start",
  "Learning paths and leaderboards",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "My college hasn't bought CaseCode. Can I still use it?",
    a: "Yes — subscribe to CaseCode Pro yourself for ₹499 a year. Access starts as soon as the payment is confirmed.",
  },
  {
    q: "My college has a campus licence. How do I get in?",
    a: "Your placement cell adds you to the licence; then you sign in as usual and can practise straight away. Signing up with a college email address does not add you by itself — ask your placement cell.",
  },
  {
    q: "What happens when my year ends?",
    a: `Practising stops on the day your year ends; everything you have done stays on your account. You can renew in the last ${RENEWAL_WINDOW_DAYS} days, and the new year is added to whatever is left.`,
  },
  {
    q: "How do I pay?",
    a: "Through Razorpay: UPI, cards or net banking. Card details go to Razorpay, never to CaseCode.",
  },
];

export default async function PricingPage() {
  const profile = await getCurrentUser();
  const admin = createAdminClientOrNull();
  const access: Access | null = profile && admin ? await getAccess(admin, profile.id) : null;
  const mode = checkoutMode();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
        <h1 className="mt-4 font-editorial text-[2.8rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.8rem]">
          Practise on your own, <em className="italic">or with your college</em>.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Reading the library is free for everyone. Writing answers and having
          them graded, drills and mock interviews come with CaseCode Pro — your
          own subscription, or a seat on your college&apos;s campus licence.
        </p>
      </header>

      <div className="mt-14 grid gap-x-14 gap-y-12 lg:grid-cols-2">
        {/* ------------------------------------------------ individual --- */}
        <section className="border-t-2 border-foreground pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            CaseCode Pro · on your own
          </p>
          <p className="mt-3 font-editorial text-5xl">
            ₹499 <span className="font-sans text-base text-muted-foreground">/ year</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            For a student whose college hasn&apos;t bought CaseCode.
          </p>
          <ul className="mt-5 divide-y divide-border border-y border-border text-sm">
            {PRO.map((line) => (
              <li key={line} className="py-2.5">{line}</li>
            ))}
          </ul>
          <div className="mt-6">
            <IndividualStatus access={access} signedIn={Boolean(profile)} mode={mode} email={profile?.email} name={profile?.full_name} />
          </div>
        </section>

        {/* ---------------------------------------------------- campus --- */}
        <section className="border-t-2 border-foreground pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Campus licence · for colleges
          </p>
          <p className="mt-3 font-editorial text-5xl">Per seat</p>
          <p className="mt-3 text-sm text-muted-foreground">
            For placement cells licensing CaseCode for a batch or a whole cohort.
          </p>
          <ul className="mt-5 divide-y divide-border border-y border-border text-sm">
            {CAMPUS.map((line) => (
              <li key={line} className="py-2.5">{line}</li>
            ))}
          </ul>
          <a
            href="mailto:chiragpednekar3@gmail.com?subject=CaseCode%20campus%20licence"
            className="mt-6 inline-block text-sm underline underline-offset-4"
          >
            Ask about a campus licence
          </a>
        </section>
      </div>

      {/* --------------------------------------------------------- free --- */}
      <section className="mt-16 grid gap-6 border-t border-border pt-6 lg:grid-cols-[18rem_1fr]">
        <h2 className="font-editorial text-3xl font-normal">Free, for everyone</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {FREE.join(" · ")}.{" "}
          <Link href="/cases" className="text-foreground underline underline-offset-4">Browse the library</Link>
        </p>
      </section>

      {/* ---------------------------------------------------------- faq --- */}
      <section className="mt-12 grid gap-6 border-t border-border pt-6 lg:grid-cols-[18rem_1fr]">
        <h2 className="font-editorial text-3xl font-normal">Questions</h2>
        <dl className="divide-y divide-border">
          {FAQ.map((item) => (
            <div key={item.q} className="py-4 first:pt-0">
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/** Where this account stands, and the one thing it can do next. */
function IndividualStatus({
  access,
  signedIn,
  mode,
  email,
  name,
}: {
  access: Access | null;
  signedIn: boolean;
  mode: CheckoutMode;
  email?: string;
  name?: string | null;
}) {
  const button = (label: string) => (
    <UpgradeButton signedIn={signedIn} mode={mode} email={email} name={name} label={label} variant="ink" size="lg" />
  );

  if (!signedIn) {
    return (
      <>
        {button("Sign in to upgrade")}
        <p className="mt-3 text-xs text-muted-foreground">CaseCode is invite-only: sign in with the address you were invited with.</p>
      </>
    );
  }

  if (access?.subscription) {
    const renewable = canRenew(access.subscription.endsAt);
    return (
      <>
        <p className="text-sm">
          <span className="font-medium">You have Pro</span>
          <span className="text-muted-foreground">
            {" "}until {formatDay(access.subscription.endsAt)}
            {access.subscription.source === "manual" ? " (granted by CaseCode)" : access.subscription.source === "demo" ? " (demo payment)" : ""}.
          </span>
        </p>
        {renewable ? (
          <div className="mt-4">{button("Renew for another year — ₹499")}</div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">You can renew in the last {RENEWAL_WINDOW_DAYS} days.</p>
        )}
      </>
    );
  }

  if (access?.pro) {
    return <p className="text-sm text-muted-foreground">Your account already has Pro through your college or the CaseCode team — nothing to pay.</p>;
  }

  return (
    <>
      {button("Upgrade — ₹499 a year")}
      {access?.canSolve ? (
        <p className="mt-3 text-xs text-muted-foreground">
          You can already practise through your college; Pro adds the AI interviewer and the larger allowance.
        </p>
      ) : null}
      {mode === "closed" ? (
        <p className="mt-3 text-xs text-muted-foreground">Online payment isn&apos;t switched on yet.</p>
      ) : null}
    </>
  );
}
