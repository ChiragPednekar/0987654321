"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SalesDebrief } from "@/lib/types/database";

export const CRITERIA_LABEL: Record<string, string> = {
  discovery: "Discovery",
  listening: "Listening",
  objections: "Objection handling",
  value_and_price: "Value & pricing",
  close: "Advancing the sale",
};

function DebriefView({ debrief }: { debrief: SalesDebrief }) {
  const entries = Object.entries(debrief.scores ?? {});
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm">{debrief.verdict}</p>
        {entries.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-5">
            {entries.map(([key, score]) => (
              <div key={key} className="rounded-md border p-2.5 text-center">
                <p className="text-xl font-semibold tabular">
                  {score}
                  <span className="text-xs text-muted-foreground">/10</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{CRITERIA_LABEL[key] ?? key}</p>
              </div>
            ))}
          </div>
        )}
        {debrief.strengths.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">What worked</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {debrief.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {debrief.improvements.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Next time</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {debrief.improvements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Shows the stored review, or asks for it once — the route returns the stored one on any later call. */
export function SalesDebriefPanel({ sessionId, initial }: { sessionId: string; initial: SalesDebrief | null }) {
  const [debrief, setDebrief] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const asked = React.useRef(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sales/sessions/${sessionId}/debrief`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not write the review.");
        return;
      }
      setDebrief(payload.debrief);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    if (!debrief && !asked.current) {
      asked.current = true;
      void load();
    }
  }, [debrief, load]);

  if (debrief) return <DebriefView debrief={debrief} />;
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-5 text-sm text-muted-foreground">
        {busy ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Reviewing your meeting…
          </span>
        ) : (
          <span>{error ?? "Review not written yet."}</span>
        )}
        {!busy && (
          <Button size="sm" variant="outline" onClick={load}>
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
