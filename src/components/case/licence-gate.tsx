import Link from "next/link";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { razorpayConfigured } from "@/lib/billing/razorpay";
import { QUOTA } from "@/lib/constants";

/**
 * Shown in place of the answer editor when the account may read but not
 * practise.
 *
 * Two ways in, and this says exactly what each is:
 *   1. An individual CaseCode Pro subscription (₹499/year) — for a student
 *      whose college has not bought CaseCode.
 *   2. A seat on the college's campus licence. A placement cell ADDS students
 *      to its licence; an email address on the right domain does not unlock
 *      anything by itself (public.can_solve matches on membership).
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
        Reading is open · practising needs access
      </p>
      <h3 className="mt-3 font-editorial text-[1.9rem] font-normal leading-tight">
        Practise this with <em className="italic">CaseCode Pro</em>.
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        You can read every case and see how it is marked. Writing an answer and
        having it graded, drills, and mock interviews need access — your own
        subscription, or a seat on your college&apos;s campus licence.
      </p>

      <div className="mt-7 grid gap-x-12 gap-y-8 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            On your own
          </p>
          <p className="mt-2 font-editorial text-3xl">
            ₹499 <span className="font-sans text-sm text-muted-foreground">/ year</span>
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>{QUOTA.pro.gradings} graded answers</li>
            <li>{QUOTA.pro.interviews} AI mock interviews</li>
            <li>SQL, Excel, aptitude, drills and peer interviews</li>
          </ul>
          <UpgradeButton
            signedIn={signedIn}
            paymentsOpen={razorpayConfigured()}
            email={userEmail}
            name={userName}
            label="Subscribe — ₹499 a year"
            variant="ink"
            className="mt-5"
          />
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Through your college
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If your placement cell has a campus licence, they add you to it and
            there is nothing to pay. Ask them — or have them get in touch about
            licensing CaseCode for your batch.
          </p>
          <a
            href="mailto:chiragpednekar3@gmail.com?subject=CaseCode%20campus%20licence"
            className="mt-4 inline-block text-sm underline underline-offset-4"
          >
            Ask about a campus licence
          </a>
        </div>
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
