import Link from "next/link";
import type { Metadata } from "next";
import { PlanTable, TopupList } from "@/components/billing/plan-table";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";
import { getAccess, purchaseBlock, type Access } from "@/lib/subscription";
import { DOMAINS, MARKETED_CASE_FLOOR } from "@/lib/constants";
import { EXPERT_COMMISSION_BPS, EXPERT_PRICE_RANGE_PAISE, PLANS, USAGE_WINDOW, rupees } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "CaseCode Pro plans from ₹299 a month, top-up packs, certificate exams and expert mock interviews.",
};

/**
 * Everything CaseCode sells, on one page: the three plans, top-ups, the
 * certificate exams and expert mock interviews — then the campus licence for
 * colleges. Set like the front page: type, rules and space, no boxed price
 * cards, and every line is something the product actually does.
 */

const FREE = [
  `Read all ${MARKETED_CASE_FLOOR}+ cases across ${DOMAINS.length} domains`,
  "See each case's rubric before you start",
  "Learning paths and leaderboards",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need a college ID?",
    a: "No. Sign up with any email address and pick a plan. If your college has a campus licence, your placement cell can add you to it instead.",
  },
  {
    q: "What is the 5-hour limit?",
    a: `Like Claude's usage limit: within any 5-hour window you can have up to ${USAGE_WINDOW.gradings} answers graded and take ${USAGE_WINDOW.interviews} mock interviews. The window opens with your first one and resets five hours later. It stops one sitting from using up a month's allowance — and top-up credits keep working past it.`,
  },
  {
    q: "Does a plan renew automatically?",
    a: "No. Each plan is a fixed period you pay for once. Near the end you can buy the next one, and it starts the day the current one ends, so you never lose days.",
  },
  {
    q: "What happens when my plan ends?",
    a: "Practising stops on the day it ends; everything you have done stays on your account. Unused top-up credits stay valid for a year and work again as soon as you have a plan.",
  },
  {
    q: "How do I pay?",
    a: "Through Razorpay: UPI, cards or net banking. Card details go to Razorpay, never to CaseCode. Prices include GST.",
  },
];

export default async function PricingPage() {
  const profile = await getCurrentUser();
  const admin = createAdminClientOrNull();
  const [access, mode, exams] = await Promise.all([
    profile && admin ? getAccess(admin, profile.id) : Promise.resolve(null as Access | null),
    profile && admin ? checkoutModeFor(admin, profile) : Promise.resolve(checkoutMode()),
    admin
      ? admin.from("cert_exams").select("slug, title, track, price_paise, duration_minutes").eq("is_published", true).order("title")
      : Promise.resolve({ data: [] as { slug: string; title: string; track: string; price_paise: number; duration_minutes: number }[] }),
  ]);

  const buyer = {
    signedIn: Boolean(profile),
    mode,
    email: profile?.email,
    name: profile?.full_name,
    blocked: access ? purchaseBlock(access) : null,
    access,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
        <h1 className="mt-4 font-editorial text-[2.8rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.8rem]">
          Practise properly, <em className="italic">from {rupees(PLANS.monthly.pricePaise)} a month</em>.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Reading the library is free. CaseCode Pro adds graded answers, AI mock interviews and every drill. Sign up
          with any email — no college ID needed.
        </p>
      </header>

      <div className="mt-14">
        <PlanTable buyer={buyer} loginNext="/pricing" />
      </div>

      {/* ------------------------------------------------------- top-ups --- */}
      <section className="mt-16 grid gap-6 border-t border-border pt-6 lg:grid-cols-[18rem_1fr]">
        <div>
          <h2 className="font-editorial text-3xl font-normal">Top-up packs</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Run low before your plan renews? Top up. Credits keep working past the 5-hour limit.
          </p>
        </div>
        <TopupList buyer={buyer} canTopUp={Boolean(access?.canSolve)} />
      </section>

      {/* -------------------------------------------------- certificates --- */}
      <section className="mt-12 grid gap-6 border-t border-border pt-6 lg:grid-cols-[18rem_1fr]">
        <div>
          <h2 className="font-editorial text-3xl font-normal">Certificate exams</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A timed, proctored case exam. Pass it and get a certificate with a verification link for your CV and
            LinkedIn. You pay per attempt, pass or not.
          </p>
        </div>
        <div>
          <ul className="divide-y divide-border border-y border-border">
            {(exams.data ?? []).map((exam) => (
              <li key={exam.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/certificates/${exam.slug}`} className="text-sm font-medium hover:underline">
                    {exam.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {exam.track} · {exam.duration_minutes} minutes · proctored
                  </p>
                </div>
                <span className="font-editorial text-2xl">{rupees(exam.price_paise)}</span>
              </li>
            ))}
          </ul>
          <Link href="/certificates" className="mt-3 inline-block text-sm underline underline-offset-4">
            See the exams
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------- experts --- */}
      <section className="mt-12 grid gap-6 border-t border-border pt-6 lg:grid-cols-[18rem_1fr]">
        <div>
          <h2 className="font-editorial text-3xl font-normal">Mock interviews with experts</h2>
        </div>
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p>
            A live case or fit interview with an ex-consultant, banker or product lead, then written feedback.
            Sessions are {rupees(EXPERT_PRICE_RANGE_PAISE.min)}–{rupees(EXPERT_PRICE_RANGE_PAISE.max)}, set by each
            expert, and you pay when you book.
          </p>
          <p className="mt-3">
            <Link href="/experts" className="text-foreground underline underline-offset-4">Browse experts</Link>
            {" · "}
            <Link href="/experts/apply" className="underline underline-offset-4 hover:text-foreground">
              Become an expert
            </Link>{" "}
            (you keep {100 - EXPERT_COMMISSION_BPS / 100}% of each session)
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- campus --- */}
      <section className="mt-12 grid gap-6 border-t border-border pt-6 lg:grid-cols-[18rem_1fr]">
        <h2 className="font-editorial text-3xl font-normal">For colleges</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A campus licence covers every student your placement cell adds — they pay nothing — with teacher pages,
          proctored tests and batch analytics.{" "}
          <a
            href="mailto:chiragpednekar3@gmail.com?subject=CaseCode%20campus%20licence"
            className="text-foreground underline underline-offset-4"
          >
            Ask about a campus licence
          </a>
        </p>
      </section>

      {/* --------------------------------------------------------- free --- */}
      <section className="mt-12 grid gap-6 border-t border-border pt-6 lg:grid-cols-[18rem_1fr]">
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
