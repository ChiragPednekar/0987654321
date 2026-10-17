import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PLAN_ORDER, PLANS, rupees } from "@/lib/pricing";

/**
 * Shown in place of the answer editor when the account may read but not
 * practise.
 *
 * Upgrade comes first: an individual CaseCode Pro plan needs no college ID. A
 * campus licence is mentioned in one line — a placement cell ADDS students to
 * it; an email address on the right domain does not unlock anything by itself
 * (public.can_solve matches on membership).
 *
 * Reading the case and its rubric stays open, so anyone deciding whether to
 * subscribe can see the standard first.
 */
export function LicenceGate({ signedIn = false }: { signedIn?: boolean; userEmail?: string; userName?: string | null }) {
  return (
    <section className="border-t-2 border-foreground pt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Reading is open · practising needs Pro
      </p>
      <h3 className="mt-3 font-editorial text-[1.9rem] font-normal leading-tight">
        Practise this with <em className="italic">CaseCode Pro</em>.
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        You can read every case and see how it is marked. Upgrade to write answers and have them graded, and to unlock
        drills and AI mock interviews.
      </p>

      <ul className="mt-6 grid max-w-2xl gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        {PLAN_ORDER.map((code) => {
          const plan = PLANS[code];
          return (
            <li key={code} className="border-t border-border pt-2">
              <p className="text-muted-foreground">{plan.name}</p>
              <p className="font-editorial text-2xl">{rupees(plan.pricePaise)}</p>
              <p className="text-xs text-muted-foreground">
                {plan.gradings} answers · {plan.interviews} interviews
              </p>
            </li>
          );
        })}
      </ul>

      <Button variant="ink" size="lg" className="mt-6" asChild>
        <Link href={signedIn ? "/upgrade" : "/login?next=/upgrade"}>
          Upgrade — from {rupees(PLANS.monthly.pricePaise)} a month
        </Link>
      </Button>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        No college ID needed. If your college already has a campus licence, your placement cell can add you instead.
      </p>

      <p className="mt-6 text-xs text-muted-foreground">
        <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
          What each plan includes
        </Link>
        {" · "}
        <Link href="/cases" className="underline underline-offset-4 hover:text-foreground">
          Keep browsing
        </Link>
      </p>
    </section>
  );
}
