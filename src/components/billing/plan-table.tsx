import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import type { CheckoutMode } from "@/lib/billing/checkout-mode";
import {
  PLAN_ORDER,
  PLANS,
  TOPUP_ORDER,
  TOPUP_VALID_DAYS,
  TOPUPS,
  USAGE_WINDOW,
  perMonth,
  rupees,
} from "@/lib/pricing";
import { renewalWindowDays, type Access } from "@/lib/subscription";
import { cn, formatDay } from "@/lib/utils";

interface Buyer {
  signedIn: boolean;
  mode: CheckoutMode;
  email?: string;
  name?: string | null;
  /** Why this account cannot buy a plan right now, if it cannot. */
  blocked: string | null;
  access: Access | null;
}

/**
 * The three plans side by side, set as ruled columns rather than boxed cards
 * (casecode-visual-identity). The season pass carries the eyebrow because it
 * is the plan built for how students actually prepare: hard, for a few months.
 */
export function PlanTable({ buyer, loginNext = "/upgrade" }: { buyer: Buyer; loginNext?: string }) {
  const current = buyer.access?.subscription?.planCode ?? null;

  return (
    <div>
      <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
        {PLAN_ORDER.map((code) => {
          const plan = PLANS[code];
          const featured = code === "season";
          return (
            <section
              key={code}
              id={code}
              className={cn("border-t-2 pt-5", featured ? "border-foreground" : "border-foreground/30")}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {featured ? "Built for placement season" : code === "annual" ? "Year-round prep" : "Flexible"}
                {current === code ? " · your plan" : ""}
              </p>
              <h3 className="mt-2 font-editorial text-[1.7rem] font-normal leading-tight">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-4 font-editorial text-5xl">
                {rupees(plan.pricePaise)}
                <span className="font-sans text-sm text-muted-foreground">
                  {" "}/ {plan.days === 30 ? "month" : plan.days === 90 ? "3 months" : "year"}
                </span>
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {code === "monthly" ? "billed each month you choose to renew" : `works out to ${perMonth(plan)} a month`}
              </p>
              <ul className="mt-5 divide-y divide-border border-y border-border text-sm">
                <li className="py-2.5">{plan.gradings} graded answers</li>
                <li className="py-2.5">{plan.interviews} AI mock interviews</li>
                <li className="py-2.5">SQL, Excel, aptitude, drills, CV and deck reviews</li>
                <li className="py-2.5 text-muted-foreground">
                  Up to {USAGE_WINDOW.gradings} answers and {USAGE_WINDOW.interviews} interviews every{" "}
                  {USAGE_WINDOW.hours} hours
                </li>
              </ul>
              <div className="mt-5">
                {buyer.blocked && buyer.signedIn ? null : (
                  <CheckoutButton
                    item={{ kind: "plan", code }}
                    mode={buyer.mode}
                    signedIn={buyer.signedIn}
                    email={buyer.email}
                    name={buyer.name}
                    loginNext={loginNext}
                    label={buyer.signedIn ? `Pay ${rupees(plan.pricePaise)}` : `Choose ${plan.name}`}
                    variant={featured ? "ink" : "outline"}
                    size="lg"
                    className="w-full"
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>

      {buyer.signedIn && <PlanStatus buyer={buyer} />}
    </div>
  );
}

function PlanStatus({ buyer }: { buyer: Buyer }) {
  const sub = buyer.access?.subscription;
  const queued = buyer.access?.queued;
  if (!sub && !buyer.blocked) {
    return buyer.mode === "demo" ? (
      <p className="mt-6 text-xs text-muted-foreground">
        Demo checkout: no money is taken and no card is needed. Razorpay replaces this step when it is connected.
      </p>
    ) : null;
  }
  return (
    <p className="mt-6 border-l-2 border-foreground/40 pl-4 text-sm">
      {sub ? (
        <>
          <span className="font-medium">
            You&apos;re on {PLANS[sub.planCode].name} until {formatDay(sub.endsAt)}.
          </span>{" "}
        </>
      ) : null}
      {queued ? (
        <span className="text-muted-foreground">
          Your next {PLANS[queued.planCode].name} period starts {formatDay(queued.startsAt)}.
        </span>
      ) : buyer.blocked && sub ? (
        <span className="text-muted-foreground">
          You can buy your next period in its last {renewalWindowDays(sub)} days; it starts the day this one ends.
        </span>
      ) : buyer.blocked ? (
        <span className="text-muted-foreground">{buyer.blocked}</span>
      ) : (
        <span className="text-muted-foreground">Renewing now adds the new period after this one ends.</span>
      )}
    </p>
  );
}

/** Top-up packs: extra answers and interviews that keep working past every limit. */
export function TopupList({ buyer, canTopUp }: { buyer: Omit<Buyer, "blocked" | "access">; canTopUp: boolean }) {
  return (
    <div>
      <ul className="divide-y divide-border border-y border-border">
        {TOPUP_ORDER.map((code) => {
          const pack = TOPUPS[code];
          return (
            <li key={code} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{pack.name}</p>
                <p className="text-xs text-muted-foreground">Valid {TOPUP_VALID_DAYS / 365 === 1 ? "12 months" : `${TOPUP_VALID_DAYS} days`} · used after your plan</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-editorial text-2xl">{rupees(pack.pricePaise)}</span>
                {canTopUp ? (
                  <CheckoutButton
                    item={{ kind: "topup", code }}
                    mode={buyer.mode}
                    signedIn={buyer.signedIn}
                    email={buyer.email}
                    name={buyer.name}
                    loginNext="/upgrade#topups"
                    label="Buy"
                    variant="outline"
                    size="sm"
                  />
                ) : !buyer.signedIn ? (
                  <CheckoutButton
                    item={{ kind: "topup", code }}
                    mode={buyer.mode}
                    signedIn={false}
                    email={buyer.email}
                    name={buyer.name}
                    loginNext="/upgrade#topups"
                    label="Buy"
                    variant="outline"
                    size="sm"
                  />
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="#plans">Upgrade first</Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!canTopUp && (
        <p className="mt-3 text-xs text-muted-foreground">Top-ups add to a plan — upgrade first, then top up when you run low.</p>
      )}
    </div>
  );
}
