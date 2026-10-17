import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PlanTable, TopupList } from "@/components/billing/plan-table";
import { QuotaCard } from "@/components/quota-card";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { checkoutModeFor } from "@/lib/billing/checkout-mode";
import { getAccess, purchaseBlock } from "@/lib/subscription";
import { getQuotaStatus } from "@/lib/quota";

export const metadata: Metadata = {
  title: "Upgrade",
  description: "Choose a CaseCode Pro plan, or top up your allowance.",
};

/**
 * The store for a signed-in student: the three plans, top-up packs, and where
 * the account stands now. No college ID is needed for any of it.
 */
export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/upgrade");

  const admin = createAdminClientOrNull();
  const [access, mode, quota] = admin
    ? await Promise.all([
        getAccess(admin, profile.id),
        checkoutModeFor(admin, profile),
        getQuotaStatus(admin, profile.id),
      ])
    : [null, "closed" as const, null];

  const blocked = access ? purchaseBlock(access) : null;
  const buyer = {
    signedIn: true,
    mode,
    email: profile.email,
    name: profile.full_name,
    blocked,
    access,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Upgrade</p>
        <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.4rem]">
          {access?.subscription ? (
            <>Your <em className="italic">CaseCode Pro</em>.</>
          ) : (
            <>Upgrade to <em className="italic">CaseCode Pro</em>.</>
          )}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Write answers and have them graded, take AI mock interviews, and work through every drill. No college ID
          needed — pick the plan that fits how you prepare.
        </p>
      </header>

      {from && !access?.canSolve ? (
        <p className="mt-8 max-w-2xl border-l-2 border-foreground pl-4 text-sm">
          <span className="font-medium">That page needs CaseCode Pro.</span>{" "}
          <span className="text-muted-foreground">
            Everything on CaseCode opens once you have a plan — or once your placement cell adds you to your
            college&apos;s licence.
          </span>
        </p>
      ) : null}

      {access?.pro && !access.subscription ? (
        <p className="mt-10 max-w-xl border-l-2 border-foreground/40 pl-4 text-sm text-muted-foreground">
          Your account already has Pro through your college or the CaseCode team — there is no plan to buy. You can
          still top up below if you run low.
        </p>
      ) : (
        <div className="mt-12">
          <PlanTable buyer={buyer} />
        </div>
      )}

      <div className="mt-16 grid gap-x-14 gap-y-12 lg:grid-cols-2">
        <section id="topups">
          <div className="border-b border-foreground pb-2">
            <h2 className="font-editorial text-[1.6rem] font-normal leading-tight">Top-up packs</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Extra answers and interviews for when you run low. They are used after your plan&apos;s allowance — and
            they keep working past the 5-hour limit.
          </p>
          <div className="mt-4">
            <TopupList buyer={buyer} canTopUp={Boolean(access?.canSolve)} />
          </div>
        </section>

        {quota && (access?.canSolve || access?.pro) ? <QuotaCard quota={quota} title="Where you stand" /> : null}
      </div>

      <p className="mt-14 text-xs text-muted-foreground">
        Also on CaseCode:{" "}
        <Link href="/certificates" className="underline underline-offset-4 hover:text-foreground">
          proctored certificate exams
        </Link>{" "}
        and{" "}
        <Link href="/experts" className="underline underline-offset-4 hover:text-foreground">
          mock interviews with experts
        </Link>
        .
      </p>
    </div>
  );
}
