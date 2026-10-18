import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { PlanTable, TopupList } from "@/components/billing/plan-table";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";
import { getAccess, purchaseBlock, type Access } from "@/lib/subscription";
import { PLANS, USAGE_WINDOW, rupees } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "CaseCode Pro plans from ₹299 a month, top-up packs and certificate exams.",
};

/**
 * Everything CaseCode sells, on one page: the three plans, top-ups and the
 * certificate exams — then the campus licence for colleges. Every page is free
 * to look at; solving needs a plan or a licence. Exams are a separate
 * pay-as-you-go package. Set like the front page: type, rules and space, no
 * boxed price cards, and every line is something the product actually does.
 */

const FAQ: { q: string; a: string }[] = [
  {
    q: "Can I take a certificate exam without a plan?",
    a: "Yes. Certificate exams are sold separately, pay as you go — you buy just the attempt you want.",
  },
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
  const [access, mode, exams, attempts, comp] = await Promise.all([
    profile && admin ? getAccess(admin, profile.id) : Promise.resolve(null as Access | null),
    profile && admin ? checkoutModeFor(admin, profile) : Promise.resolve(checkoutMode()),
    admin
      ? admin.from("cert_exams").select("id, slug, title, track, price_paise, duration_minutes").eq("is_published", true).order("title")
      : Promise.resolve({ data: [] as { id: string; slug: string; title: string; track: string; price_paise: number; duration_minutes: number }[] }),
    profile && admin
      ? admin.from("cert_attempts").select("id, exam_id, status, deadline_at").eq("user_id", profile.id).in("status", ["ready", "in_progress"])
      : Promise.resolve({ data: [] as { id: string; exam_id: string; status: string; deadline_at: string | null }[] }),
    profile && admin ? admin.rpc("is_complimentary", { p_user: profile.id }) : Promise.resolve({ data: false }),
  ]);
  const isComplimentary = Boolean(profile?.role === "admin" || comp?.data === true);

  const openAttempts = new Map(
    ((attempts?.data ?? []) as { id: string; exam_id: string; status: string }[]).map((a) => [a.exam_id, a]),
  );

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
          with any email — no college ID needed — or get it through your college&apos;s licence.
        </p>
      </header>

      <div id="plans" className="mt-14 scroll-mt-10">
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

      {/* ------------------------------------------ pay as you go package --- */}
      <section className="mt-16 border-t-2 border-foreground pt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Pay as you go · no plan needed
        </p>
        <h2 className="mt-2 font-editorial text-[2.2rem] font-normal leading-tight">
          Certificate exams, <em className="italic">on their own</em>.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Sold separately from the plans. Sign up, pay for the one thing you want, and use it — with or without
          CaseCode Pro.
        </p>

        <div className="mt-8 max-w-2xl">
          <div>
            <h3 className="font-editorial text-2xl font-normal">Certificate exams</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A timed, proctored case exam. Pass it and get a certificate with a verification link for your CV and
              LinkedIn. You pay per attempt, pass or not.
            </p>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {(exams.data ?? []).map((exam) => {
                const open = openAttempts.get(exam.id);
                const hasAccess = Boolean(open) || isComplimentary;
                return (
                  <li key={exam.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/certificates/${exam.slug}`} className="text-sm font-medium hover:underline">
                        {exam.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {exam.track} · {exam.duration_minutes} minutes · proctored
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!hasAccess ? (
                        <span className="font-editorial text-2xl">{rupees(exam.price_paise)}</span>
                      ) : open ? (
                        <span className="inline-flex items-center rounded border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          {open.status === "ready" ? "Attempt ready" : "In progress"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Included
                        </span>
                      )}
                      {open ? (
                        <Button variant="ink" size="sm" asChild>
                          <Link href={`/certificates/attempt/${open.id}`}>
                            {open.status === "ready" ? "Start exam" : "Resume"}
                          </Link>
                        </Button>
                      ) : (
                        <CheckoutButton
                          item={{ kind: "exam", slug: exam.slug }}
                          mode={isComplimentary ? "demo" : buyer.mode}
                          signedIn={buyer.signedIn}
                          email={buyer.email}
                          name={buyer.name}
                          loginNext={`/certificates/${exam.slug}`}
                          label={isComplimentary ? "Start attempt — included" : "Take exam"}
                          variant="outline"
                          size="sm"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link href="/certificates" className="mt-3 inline-block text-sm underline underline-offset-4">
              See the exams
            </Link>
          </div>
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
