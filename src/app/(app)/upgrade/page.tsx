import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { DemoPayButton } from "@/components/billing/demo-pay-button";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { checkoutMode } from "@/lib/billing/checkout-mode";
import { PRO_PRICE_PAISE } from "@/lib/billing/razorpay";
import { getAccess, purchaseBlock, RENEWAL_WINDOW_DAYS, SUBSCRIPTION_DAYS } from "@/lib/subscription";
import { QUOTA } from "@/lib/constants";
import { formatDay } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Upgrade",
  description: "Subscribe to CaseCode Pro for a year.",
};

const INCLUDED = [
  `${QUOTA.pro.gradings} graded answers, marked against each case's rubric`,
  `${QUOTA.pro.interviews} AI mock interviews with follow-up questions`,
  "SQL and Excel exercises, aptitude quizzes and drills",
  "Peer interview rooms, daily quizzes, CV and deck reviews",
];

/**
 * Checkout for an individual CaseCode Pro subscription.
 *
 * Laid out like a receipt: what you get on the left, the amount and the pay
 * step on the right. Until Razorpay is connected the pay step is the demo
 * checkout (checkout-mode.ts) and says so plainly — no money moves.
 */
export default async function UpgradePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/upgrade");

  const admin = createAdminClientOrNull();
  const access = admin ? await getAccess(admin, profile.id) : null;
  const blocked = access ? purchaseBlock(access) : null;
  const mode = checkoutMode();
  const rupees = `₹${(PRO_PRICE_PAISE / 100).toLocaleString("en-IN")}`;
  const renewing = Boolean(access?.subscription) && !blocked;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Upgrade</p>
        <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.4rem]">
          {access?.pro && blocked ? (
            <>You&apos;re on <em className="italic">CaseCode Pro</em>.</>
          ) : renewing ? (
            <>Renew <em className="italic">CaseCode Pro</em>.</>
          ) : (
            <>Upgrade to <em className="italic">CaseCode Pro</em>.</>
          )}
        </h1>
      </header>

      {blocked ? (
        <section className="mt-10 max-w-xl border-t-2 border-foreground pt-5">
          {access?.subscription ? (
            <p className="text-sm">
              <span className="font-medium">Pro until {formatDay(access.subscription.endsAt)}.</span>{" "}
              <span className="text-muted-foreground">
                You can renew in the last {RENEWAL_WINDOW_DAYS} days; the new year is added to what is left.
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{blocked} Nothing to pay.</p>
          )}
          <Button variant="ink" className="mt-6" asChild>
            <Link href="/cases">Start practising</Link>
          </Button>
        </section>
      ) : (
        <div className="mt-12 grid gap-x-14 gap-y-10 lg:grid-cols-[1fr_22rem]">
          <section className="border-t-2 border-foreground pt-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              CaseCode Pro · {SUBSCRIPTION_DAYS} days
            </p>
            <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
              {INCLUDED.map((line) => (
                <li key={line} className="py-2.5">{line}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Access starts the moment the payment goes through and ends after a year;
              {renewing ? " renewing adds the new year to what you have left." : ` you can renew in the last ${RENEWAL_WINDOW_DAYS} days.`}{" "}
              <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">Compare plans</Link>
            </p>
          </section>

          <aside className="border-t-2 border-foreground pt-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Account</dt>
                <dd className="truncate pl-4">{profile.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Plan</dt>
                <dd>Pro, 1 year</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-editorial text-4xl">{rupees}</span>
            </div>

            <div className="mt-6">
              {mode === "demo" ? (
                <>
                  <DemoPayButton amountLabel={rupees} />
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Demo checkout: no money is taken and no card is needed. Online
                    payment through Razorpay replaces this step when it is connected.
                  </p>
                </>
              ) : mode === "razorpay" ? (
                <UpgradeButton
                  signedIn
                  mode="razorpay"
                  email={profile.email}
                  name={profile.full_name}
                  label={`Pay ${rupees}`}
                  variant="ink"
                  size="lg"
                  className="w-full"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Online payment isn&apos;t switched on yet.</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
