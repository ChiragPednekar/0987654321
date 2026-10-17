"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Grant or end a hand-given Pro subscription on one account.
 *
 * A grant is a real subscription period that runs out on its own, added on
 * top of any live period. Ending only touches hand-granted periods; a paid one
 * is a refund decision made in Razorpay.
 */
export function SubscriptionActions({
  userId,
  name,
  hasManualGrant,
}: {
  userId: string;
  name: string;
  hasManualGrant: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function grant() {
    const answer = prompt(`Grant ${name} CaseCode Pro for how many days?`, "30");
    if (answer === null) return;
    const days = Number(answer);
    if (!Number.isInteger(days) || days < 1 || days > 730) {
      toast.error("Give a whole number of days between 1 and 730.");
      return;
    }
    await send("POST", { days }, (b) =>
      `Pro granted until ${new Date(b.ends_at as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`,
    );
  }

  async function end() {
    if (!confirm(`End the hand-granted Pro on ${name} now? Paid periods are not affected.`)) return;
    await send("DELETE", undefined, () => "Hand-granted Pro ended.");
  }

  async function send(method: "POST" | "DELETE", body: unknown, ok: (b: Record<string, unknown>) => string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        toast.error((payload.error as string) ?? "Could not update the subscription.");
        return;
      }
      toast.success(ok(payload));
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const button = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50";
  return (
    <span className="inline-flex items-center">
      {busy && <Loader2 className="mr-1 size-3 animate-spin" />}
      <button type="button" onClick={() => void grant()} disabled={busy} className={button}>
        Grant Pro
      </button>
      {hasManualGrant && (
        <button type="button" onClick={() => void end()} disabled={busy} className={button}>
          End grant
        </button>
      )}
    </span>
  );
}
