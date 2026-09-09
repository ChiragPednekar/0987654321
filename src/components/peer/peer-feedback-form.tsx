"use client";

import * as React from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RubricCriteria } from "@/lib/types/database";

/**
 * Mark your partner on the case's own rubric.
 *
 * Deliberately the same criteria and weights the AI grades against, so a
 * student can hold the two side by side. Where a human and the model disagree
 * on the same axis is the most instructive thing this feature produces — and it
 * only works if the axes are identical.
 */
export function PeerFeedbackForm({
  sessionId,
  toUserId,
  criteria,
  maxScore,
  role,
}: {
  sessionId: string;
  toUserId: string;
  criteria: RubricCriteria;
  maxScore: number;
  role: "interviewer" | "candidate";
}) {
  const entries = Object.entries(criteria);
  const [scores, setScores] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const total = entries.reduce(
    (sum, [key]) => sum + (Number(scores[key]) || 0),
    0,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const breakdown = Object.fromEntries(
        entries.map(([key]) => [key, Number(scores[key]) || 0]),
      );
      const response = await fetch(`/api/peer/sessions/${sessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user: toUserId, breakdown, notes: notes || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send that.");
      setSent(true);
      toast.success("Feedback sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="p-5 text-center text-sm text-muted-foreground">
          Feedback sent. They can see it on their side.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Mark your partner
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {role === "interviewer"
            ? "Same rubric the AI uses. Where you disagree with it is the interesting part."
            : "Mark how they ran the interview — the questions, not your own answer."}
        </p>

        <form onSubmit={submit} className="mt-3 space-y-3">
          {entries.map(([key, weight]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <label htmlFor={`peer-${key}`} className="text-sm capitalize">
                {key.replace(/_/g, " ")}
                <span className="ml-1 text-xs text-muted-foreground">/ {weight}</span>
              </label>
              <Input
                id={`peer-${key}`}
                type="number"
                min={0}
                max={Number(weight)}
                value={scores[key] ?? ""}
                onChange={(e) =>
                  setScores((s) => ({ ...s, [key]: e.target.value }))
                }
                className="w-20 text-right"
              />
            </div>
          ))}

          <div className="flex items-baseline justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="tabular font-medium">
              {total}
              <span className="text-muted-foreground">/{maxScore}</span>
            </span>
          </div>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="One thing they did well, one thing to fix next time…"
            className="min-h-[80px]"
          />

          <Button type="submit" disabled={busy} className="w-full">
            <Send className="size-4" />
            {busy ? "Sending…" : "Send feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
