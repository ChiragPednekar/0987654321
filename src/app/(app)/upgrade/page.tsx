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
import { Page, PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Upgrade",
  description: "Choose a CaseCode Pro plan, or top up your allowance.",
};

/**
 * The store for a signed-in student: the three plans, top-up packs, and where
 * the account stands now. No college ID is needed for any of it.
 */
export default async function UpgradePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/upgrade");

  const admin = createAdminClientOrNull();
  const [access, mode, quota, comp] = admin
    ? await Promise.all([
        getAccess(admin, profile.id),
        checkoutModeFor(admin, profile),
        getQuotaStatus(admin, profile.id),
        admin.rpc("is_complimentary", { p_user: profile.id }),
      ])
    : [null, "closed" as const, null, { data: false }];
  const isComplimentary = Boolean(profile.role === "admin" || comp?.data === true);

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
    <Page>
      <PageHeader
        eyebrow="You"
        title="Upgrade"
        subtitle={
          access?.subscription
            ? "Your CaseCode Pro plan: graded answers, AI mock interviews and every drill."
            : "Upgrade to CaseCode Pro to have your answers graded, take AI mock interviews, and work through every drill. No college ID needed; pick the plan that fits how you prepare."
        }
      />

      {access?.pro && !access.subscription ? (
        <p className="mt-10 max-w-xl rounded-xl bg-card px-4 py-3 shadow-xs dark:shadow-none text-sm text-muted-foreground">
          Your account already has Pro through your college or the CaseCode team — there is no plan to buy. You can
          still top up below if you run low.
        </p>
      ) : (
        <div id="plans" className="mt-12 scroll-mt-10">
          <PlanTable buyer={buyer} />
        </div>
      )}

      <div className="mt-16 grid gap-x-14 gap-y-12 lg:grid-cols-2">
        <section id="topups">
          <div className="border-b border-border pb-2">
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

      <section className="mt-16 border-t border-border pt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Pay as you go · no plan needed
        </p>
        <div className="mt-3 max-w-xl">
          <Link href="/certificates" className="group block border-b border-border pb-4">
            <p className="font-editorial text-2xl group-hover:underline">Certificate exams</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isComplimentary
                ? "A proctored case exam with a verifiable certificate — included with your account."
                : "A proctored case exam with a verifiable certificate — ₹399 an attempt."}
            </p>
          </Link>
        </div>
      </section>
    </Page>
  );
}
