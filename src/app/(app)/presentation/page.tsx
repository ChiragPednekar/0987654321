import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve } from "@/lib/entitlement";
import { getQuotaStatus } from "@/lib/quota";
import { DeckReviewer, type StoredDeckReview } from "@/components/presentation/deck-reviewer";

export const metadata: Metadata = { title: "Presentation review" };

export default async function PresentationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/presentation");

  const admin = createAdminClient();
  const [{ data: past }, entitled, quota] = await Promise.all([
    admin
      .from("deck_reviews")
      .select("id, file_name, context, result, created_at")
      .eq("user_id", user.id)
      .is("erased_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    canSolve(admin, user.id),
    getQuotaStatus(admin, user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Presentation review</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a deck — a case competition submission, an interview presentation — and get it read
        the way a partner reads one: storyline, action titles, one message a slide, and whether the
        charts prove the point.
      </p>
      <div className="mt-6">
        <DeckReviewer
          history={(past ?? []) as StoredDeckReview[]}
          entitled={entitled}
          gradingsLeft={quota.gradingsLeft}
        />
      </div>
    </div>
  );
}
