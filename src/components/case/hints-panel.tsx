"use client";

import * as React from "react";
import { Lightbulb, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HintStub {
  id: string;
  step: number;
  penalty_pct: number;
  /** Present only for hints this user has already revealed. */
  body: string | null;
}

/**
 * Progressive hints. Bodies for unrevealed hints are never sent to the client —
 * shipping them hidden behind CSS would make the penalty trivially avoidable
 * by anyone who opens devtools.
 */
export function HintsPanel({
  hints,
  signedIn,
}: {
  hints: HintStub[];
  signedIn: boolean;
}) {
  const [revealed, setRevealed] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      hints.filter((h) => h.body).map((h) => [h.id, h.body as string]),
    ),
  );
  const [pending, setPending] = React.useState<string | null>(null);

  const totalPenalty = hints
    .filter((h) => revealed[h.id])
    .reduce((sum, h) => sum + h.penalty_pct, 0);

  async function reveal(hint: HintStub) {
    if (!signedIn) {
      toast.error("Log in to use hints.");
      return;
    }

    setPending(hint.id);
    try {
      const response = await fetch("/api/hints/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hint_id: hint.id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not reveal hint.");
        return;
      }

      setRevealed((prev) => ({ ...prev, [hint.id]: payload.body }));
    } catch {
      toast.error("Network error.");
    } finally {
      setPending(null);
    }
  }

  if (hints.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hints for this case.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <p className="text-muted-foreground">
          Each hint costs {hints[0]?.penalty_pct ?? 10}% of your final score.
        </p>
        {totalPenalty > 0 && (
          <span className="font-medium text-[var(--warning)]">
            −{Math.min(50, totalPenalty)}% applied
          </span>
        )}
      </div>

      {hints.map((hint, index) => {
        const body = revealed[hint.id];
        // Hints unlock in order — jumping to the last one would skip the
        // scaffolding the earlier ones provide.
        const locked = index > 0 && !revealed[hints[index - 1].id];

        return (
          <Card key={hint.id} className={cn(body && "border-primary/30")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Lightbulb
                    className={cn(
                      "size-4",
                      body ? "text-[var(--warning)]" : "text-muted-foreground",
                    )}
                  />
                  <span className="text-sm font-medium">Hint {hint.step}</span>
                </div>

                {!body && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={locked || pending === hint.id}
                    onClick={() => reveal(hint)}
                  >
                    {pending === hint.id ? (
                      <Loader2 className="animate-spin" />
                    ) : locked ? (
                      <Lock />
                    ) : null}
                    {locked
                      ? `Reveal hint ${index} first`
                      : `Reveal (−${hint.penalty_pct}%)`}
                  </Button>
                )}
              </div>

              {body && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
