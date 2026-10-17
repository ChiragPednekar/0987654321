import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ExpertProfileForm } from "@/components/experts/expert-profile-form";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPERTISE, expertForUser } from "@/lib/experts";
import { EXPERT_COMMISSION_BPS, EXPERT_PRICE_RANGE_PAISE } from "@/lib/pricing";

export const metadata: Metadata = { title: "Become an expert" };

export default async function ApplyPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/experts/apply");
  const expert = await expertForUser(createAdminClient(), profile.id);
  if (expert && expert.status !== "pending") redirect("/experts/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Become an expert</p>
      <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-tight">
        Interview the next batch, <em className="italic">on your own time</em>.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
        Publish the hours you are free, set your price, run the interview on your own meeting link and write up
        feedback afterwards. CaseCode handles booking and payment and keeps {EXPERT_COMMISSION_BPS / 100}%. Every
        profile is reviewed before it goes live.
      </p>
      {expert?.status === "pending" && (
        <p className="mt-6 border-l-2 border-foreground/40 pl-4 text-sm">
          Your application is in review. You can still edit it below.
        </p>
      )}
      <div className="mt-10 border-t-2 border-foreground pt-6">
        <ExpertProfileForm
          mode="apply"
          expertise={EXPERTISE}
          priceRange={{ min: EXPERT_PRICE_RANGE_PAISE.min / 100, max: EXPERT_PRICE_RANGE_PAISE.max / 100 }}
          commissionPct={EXPERT_COMMISSION_BPS / 100}
          initial={{
            display_name: expert?.display_name ?? profile.full_name ?? "",
            headline: expert?.headline ?? "",
            bio: expert?.bio ?? "",
            expertise: expert?.expertise ?? [],
            linkedin_url: expert?.linkedin_url ?? "",
            meeting_url: expert?.meeting_url ?? "",
            price_rupees: (expert?.price_paise ?? 150_000) / 100,
          }}
        />
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        <Link href="/experts" className="underline underline-offset-4">Back to experts</Link>
      </p>
    </div>
  );
}
