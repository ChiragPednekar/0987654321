"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Opt in to the recruiter directory (spec §8).
 *
 * Written by the browser under the user's own session, not a route handler:
 * 20250101000017 grants UPDATE on exactly this one column to `authenticated`,
 * so RLS plus the column grant already constrain it to the caller's own row
 * and to this field alone.
 */
export function OpportunitiesToggle({
  userId,
  initial,
}: {
  userId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function toggle(next: boolean) {
    setOn(next);
    setBusy(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ open_to_opportunities: next })
      .eq("id", userId);

    setBusy(false);

    if (error) {
      setOn(!next);
      toast.error(error.message);
      return;
    }

    toast.success(
      next ? "Recruiters can now find you." : "You are hidden from recruiters.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="font-medium">Open to opportunities</span>
          <span className="mt-0.5 block text-muted-foreground">
            Show my name, university, solved count and score trend to verified
            recruiters on CaseCode. Your answers themselves stay private. Off by
            default, and you can switch it off again at any time.
          </span>
        </span>
      </label>
    </div>
  );
}
