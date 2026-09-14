"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, LogOut, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface SalesTurn {
  role: "student" | "buyer";
  content: string;
}

export function StartSalesButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function start() {
    setBusy(true);
    try {
      const response = await fetch("/api/sales/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not start.");
        return;
      }
      router.push(`/sales/${payload.id}`);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" className="shrink-0" onClick={start} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Briefcase />}
      Start meeting
    </Button>
  );
}

/**
 * The meeting. Deliberately shows no running tally of needs found or concerns
 * resolved: a live checklist would tell the student what to look for, which is
 * the skill being practised. It all appears in the review afterwards.
 */
export function SalesRoom({
  sessionId,
  buyerRole,
  initial,
  turnsUsed,
  maxTurns,
}: {
  sessionId: string;
  buyerRole: string;
  initial: SalesTurn[];
  turnsUsed: number;
  maxTurns: number;
}) {
  const router = useRouter();
  const [turns, setTurns] = React.useState(initial);
  const [used, setUsed] = React.useState(turnsUsed);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function send() {
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setTurns((t) => [...t, { role: "student", content: message }]);
    setDraft("");

    try {
      const response = await fetch(`/api/sales/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json();
      if (!response.ok) {
        // Nothing was stored server-side: take the message back out and return
        // it to the box so it can be sent again.
        setTurns((t) => t.slice(0, -1));
        setDraft(message);
        toast.error(payload.error ?? "The buyer did not respond.");
        if (response.status === 409) router.refresh();
        return;
      }
      setTurns((t) => [...t, { role: "buyer", content: payload.message }]);
      setUsed(payload.turn);
      if (payload.outcome !== "live") {
        toast[payload.outcome === "won" ? "success" : "info"](
          payload.outcome === "won" ? "The buyer agreed." : "The meeting has ended.",
        );
        setTimeout(() => router.push(`/sales/${sessionId}/result`), 1200);
      }
    } catch {
      setTurns((t) => t.slice(0, -1));
      setDraft(message);
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function endMeeting() {
    if (!window.confirm("End the meeting without a sale?")) return;
    setBusy(true);
    try {
      await fetch(`/api/sales/sessions/${sessionId}/end`, { method: "POST" });
      router.push(`/sales/${sessionId}/result`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {turns.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            The {buyerRole.toLowerCase()} has sat down and is waiting for you to begin.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("flex", t.role === "student" ? "justify-end" : "justify-start")}>
            <Card className={cn("max-w-[90%]", t.role === "student" && "bg-muted/50")}>
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t.role === "student" ? "You" : buyerRole}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{t.content}</p>
              </CardContent>
            </Card>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <Card className="max-w-[90%]">
              <CardContent className="flex items-center gap-2 p-3.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {buyerRole} is thinking…
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Open the meeting, ask a question, or make your case…"
          className="min-h-[90px] resize-y text-[13px]"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular">
            Turn {used} of {maxTurns}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={endMeeting} disabled={busy}>
              <LogOut />
              End meeting
            </Button>
            <Button size="sm" onClick={send} disabled={busy || !draft.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
