import Link from "next/link";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { checkoutMode } from "@/lib/billing/checkout-mode";
import { QUOTA } from "@/lib/constants";

/**
 * Shown in place of the answer editor when the account may read but not
 * practise.
 *
 * Upgrade comes first: an individual CaseCode Pro subscription (₹499/year)
 * needs no college ID. A campus licence is mentioned in one line — a
 * placement cell ADDS students to it; an email address on the right domain
 * does not unlock anything by itself (public.can_solve matches on membership).
 *
 * Reading the case and its rubric stays open, so anyone deciding whether to
 * subscribe can see the standard first.
 */
export function LicenceGate({
  signedIn = false,
  userEmail,
  userName,
}: {
  signedIn?: boolean;
  userEmail?: string;
  userName?: string | null;
}) {
  return (
    <section className="border-t-2 border-foreground pt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Reading is open · practising needs Pro
      </p>
      <h3 className="mt-3 font-editorial text-[1.9rem] font-normal leading-tight">
        Practise this with <em className="italic">CaseCode Pro</em>.
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        You can read every case and see how it is marked. Upgrade to write
        answers and have them graded, and to unlock drills and AI mock
        interviews.
      </p>

      <div className="mt-7 max-w-md">
        <p className="font-editorial text-4xl">
          ₹499 <span className="font-sans text-sm text-muted-foreground">/ year</span>
        </p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          <li>{QUOTA.pro.gradings} graded answers</li>
          <li>{QUOTA.pro.interviews} AI mock interviews</li>
          <li>SQL, Excel, aptitude, drills and peer interviews</li>
        </ul>
        <UpgradeButton
          signedIn={signedIn}
          mode={checkoutMode()}
          email={userEmail}
          name={userName}
          label="Upgrade — ₹499 a year"
          variant="ink"
          size="lg"
          className="mt-5"
        />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          No college ID needed. If your college already has a campus licence,
          your placement cell can add you instead.
        </p>
      </div>

      <p className="mt-7 text-xs text-muted-foreground">
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
