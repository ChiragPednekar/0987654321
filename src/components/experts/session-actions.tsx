"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

async function post(id: string, body: unknown) {
  const response = await fetch(`/api/experts/bookings/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Could not save.");
}

/** The expert closes a session: written feedback, or a no-show. */
export function CompleteSession({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function run(body: unknown, done: string) {
    setBusy(true);
    try {
      await post(id, body);
      toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex gap-3">
        <Button size="sm" variant="ink" onClick={() => setOpen(true)}>
          Write feedback
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: "no_show" }, "Marked as a no-show.")}>
          No-show
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="What went well, what to fix, and what to practise next. The student sees this."
        className="min-h-[140px]"
      />
      <Button
        size="sm"
        variant="ink"
        disabled={busy || feedback.trim().length < 40}
        onClick={() => run({ action: "complete", feedback }, "Feedback sent.")}
      >
        {busy ? <Loader2 className="animate-spin" /> : null}
        Send feedback and close
      </Button>
      <p className="text-xs text-muted-foreground">At least 40 characters.</p>
    </div>
  );
}

/** The student rates a completed session. */
export function RateSession({ id }: { id: string }) {
  const router = useRouter();
  const [rating, setRating] = React.useState(0);
  const [review, setReview] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
            <Star className={cn("size-5", n <= rating ? "fill-foreground text-foreground" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      <Textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="Optional: a line for other students." className="min-h-[70px]" />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || rating === 0}
        onClick={async () => {
          setBusy(true);
          try {
            await post(id, { action: "review", rating, review });
            toast.success("Thanks for the rating.");
            router.refresh();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Rate session
      </Button>
    </div>
  );
}

/** Admin actions on an expert: approve, suspend, record a payout. */
export function AdminExpertAction({ id, action, label }: { id: string; action: "approve" | "suspend" | "mark_paid"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant={action === "approve" ? "ink" : "outline"}
      disabled={busy}
      onClick={async () => {
        if (action === "mark_paid" && !window.confirm("Record that this expert's completed sessions have been paid out?")) return;
        setBusy(true);
        const response = await fetch(`/api/admin/experts/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) toast.error(payload.error ?? "Could not save.");
        else toast.success("Saved.");
        router.refresh();
        setBusy(false);
      }}
    >
      {label}
    </Button>
  );
}
