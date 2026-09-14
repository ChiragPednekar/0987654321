import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve } from "@/lib/entitlement";
import { getQuotaStatus } from "@/lib/quota";
import { ResumeCritic, type StoredCritique } from "@/components/resume/resume-critic";

export const metadata: Metadata = { title: "Resume critique" };

export default async function ResumePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/resume");

  const admin = createAdminClient();
  const [{ data: past }, entitled, quota] = await Promise.all([
    admin
      .from("resume_critiques")
      .select("id, target_role, bullets, result, created_at")
      .eq("user_id", user.id)
      .is("erased_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    canSolve(admin, user.id),
    getQuotaStatus(admin, user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Resume critique</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste your CV bullets. Each one is judged the way a shortlister reads it,
        and rewritten — without inventing a single number.
      </p>

      <div className="mt-6">
        <ResumeCritic
          history={(past ?? []) as StoredCritique[]}
          entitled={entitled}
          gradingsLeft={quota.gradingsLeft}
        />
      </div>
    </div>
  );
}
