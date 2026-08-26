"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Deactivate or restore one account.
 *
 * Deliberately not a delete button. Deleting cascades away submissions, scores
 * and any marks a teacher gave, so acting on an abusive account would also
 * destroy the record of what it did. Deactivation closes the account — Pro off,
 * grading quota zero — and can be undone.
 */
export function UserActions({
  userId,
  name,
  deactivated,
}: {
  userId: string;
  name: string;
  deactivated: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    let reason: string | null = null;

    if (!deactivated) {
      // A reason is the difference between an audit row someone can act on and
      // one that only records that *something* happened.
      reason = prompt(
        `Deactivate ${name}?\n\nThey lose Pro and their grading allowance drops to zero, so no further AI spend is possible. Their work is kept and this can be undone.\n\nReason (optional, recorded in the audit log):`,
      );
      // prompt() returns null on Cancel and "" when submitted empty.
      if (reason === null) return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deactivated: !deactivated,
          reason: reason?.trim() || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not update the account.");
        return;
      }
      toast.success(deactivated ? "Account restored." : "Account deactivated.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50 " +
        (deactivated
          ? "text-muted-foreground hover:bg-muted hover:text-foreground"
          : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")
      }
    >
      {busy ? (
        <Loader2 className="size-3 animate-spin" />
      ) : deactivated ? (
        <ShieldCheck className="size-3" />
      ) : (
        <ShieldOff className="size-3" />
      )}
      {deactivated ? "Restore" : "Deactivate"}
    </button>
  );
}
