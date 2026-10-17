"use client";

import * as React from "react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { Textarea } from "@/components/ui/textarea";
import type { CheckoutMode } from "@/lib/billing/checkout-mode";
import { cn } from "@/lib/utils";

export interface BookableSlot {
  id: string;
  label: string;
  day: string;
  duration: number;
}

/**
 * Pick a time, say what you want to work on, pay. Paying holds the slot for
 * fifteen minutes so two students cannot pay for the same hour.
 */
export function BookSlot({
  slots,
  priceLabel,
  mode,
  signedIn,
  email,
  name,
  expertId,
}: {
  slots: BookableSlot[];
  priceLabel: string;
  mode: CheckoutMode;
  signedIn: boolean;
  email?: string;
  name?: string | null;
  expertId: string;
}) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");

  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">No open times right now. Check back soon.</p>;
  }

  const days = Array.from(new Set(slots.map((s) => s.day)));

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <div key={day}>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{day}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {slots
              .filter((s) => s.day === day)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={cn(
                    "border px-3 py-1.5 text-sm tabular",
                    selected === s.id ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
                  )}
                >
                  {s.label} · {s.duration} min
                </button>
              ))}
          </div>
        </div>
      ))}

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          What should the session focus on? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="notes"
          value={notes}
          maxLength={1500}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. a profitability case, my structuring is slow; target firms are MBB."
          className="min-h-[90px]"
        />
      </div>

      <CheckoutButton
        item={{ kind: "expert_session", slotId: selected ?? "00000000-0000-0000-0000-000000000000", notes }}
        mode={mode}
        signedIn={signedIn}
        email={email}
        name={name}
        loginNext={`/experts/${expertId}`}
        label={selected ? `Book and pay ${priceLabel}` : "Pick a time"}
        size="lg"
        disabled={!selected}
      />
      {mode === "demo" && signedIn ? (
        <p className="text-xs text-muted-foreground">Demo checkout: no money is taken.</p>
      ) : null}
    </div>
  );
}
