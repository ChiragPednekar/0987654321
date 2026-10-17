"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Publishes a slot. The time is entered in the expert's own clock and sent as
 * an absolute instant, so a student in another timezone sees it correctly.
 */
export function SlotAdder() {
  const router = useRouter();
  const [when, setWhen] = React.useState("");
  const [duration, setDuration] = React.useState(45);
  const [busy, setBusy] = React.useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!when) return;
    setBusy(true);
    try {
      const response = await fetch("/api/experts/me/slots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ starts_at: new Date(when).toISOString(), duration_minutes: duration }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not add the slot.");
        return;
      }
      toast.success("Slot published.");
      setWhen("");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="slot-when">Start</Label>
        <Input id="slot-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slot-duration">Length</Label>
        <select
          id="slot-duration"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="h-9 border border-input bg-transparent px-2 text-sm"
        >
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>60 min</option>
        </select>
      </div>
      <Button type="submit" variant="ink" disabled={busy || !when}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />}
        Add slot
      </Button>
    </form>
  );
}

export function WithdrawSlot({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="text-xs underline underline-offset-4 hover:text-foreground disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        const response = await fetch(`/api/experts/me/slots/${id}`, { method: "DELETE" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) toast.error(payload.error ?? "Could not withdraw.");
        router.refresh();
        setBusy(false);
      }}
    >
      Withdraw
    </button>
  );
}
