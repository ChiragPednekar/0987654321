"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Handshake, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  isComplete,
  scoreTerms,
  type Issue,
  type PayoffTable,
  type Terms,
} from "@/lib/negotiation/engine";
import { cn } from "@/lib/utils";

export interface NegotiationTurn {
  role: "student" | "counterparty";
  content: string;
  offer: Terms | null;
}

/**
 * Chat for the negotiation, a structured form for the offer.
 *
 * The terms are picked rather than typed, and that is deliberate: parsing a
 * deal out of prose would be unreliable exactly when it matters most, and a
 * disagreement about what was actually agreed is the one thing a scored
 * exercise cannot survive. The conversation persuades; the form commits.
 */
export function NegotiationRoom({
  sessionId,
  issues,
  payoffs,
  batna,
  counterpartyRole,
  initial,
}: {
  sessionId: string;
  issues: Issue[];
  payoffs: PayoffTable;
  batna: number;
  counterpartyRole: string;
  initial: NegotiationTurn[];
}) {
  const router = useRouter();
  const [turns, setTurns] = React.useState(initial);
  const [draft, setDraft] = React.useState("");
  const [terms, setTerms] = React.useState<Terms>({});
  const [attach, setAttach] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Your own score, live. You never see theirs — finding out what they value
  // is the exercise.
  const yourValue = scoreTerms(payoffs, terms);
  const complete = isComplete(issues, terms);

  async function send() {
    const message = draft.trim();
    if (!message || busy) return;
    const offer = attach && complete ? terms : null;

    setDraft("");
    setTurns((t) => [...t, { role: "student", content: message, offer }]);
    setBusy(true);

    try {
      const response = await fetch(`/api/negotiation/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, offer }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "The counterparty did not respond.");
        return;
      }
      setTurns((t) => [
        ...t,
        { role: "counterparty", content: payload.message, offer: payload.offer ?? null },
      ]);
      if (payload.accepted) {
        toast.success("Deal agreed.");
        router.push(`/negotiation/${sessionId}/result`);
      }
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function walkAway() {
    if (!confirm("Walk away with no deal? This ends the negotiation.")) return;
    setBusy(true);
    try {
      await fetch(`/api/negotiation/sessions/${sessionId}/end`, { method: "POST" });
      router.push(`/negotiation/${sessionId}/result`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="space-y-3">
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn("flex", t.role === "student" ? "justify-end" : "justify-start")}
            >
              <Card
                className={cn(
                  "max-w-[90%]",
                  t.role === "student" && "border-primary/30 bg-primary/5",
                )}
              >
                <CardContent className="p-3.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t.role === "student" ? "You" : counterpartyRole}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {t.content}
                  </p>
                  {t.offer && (
                    <div className="mt-2 rounded-md bg-muted/60 p-2 text-xs">
                      <p className="font-medium">Terms on the table</p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {issues.map((issue) => {
                          const chosen = issue.options.find(
                            (o) => o.key === t.offer![issue.key],
                          );
                          return (
                            <li key={issue.key}>
                              {issue.label}: {chosen?.label ?? "—"}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <Card className="max-w-[90%]">
                <CardContent className="flex items-center gap-2 p-3.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {counterpartyRole} is considering…
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
            placeholder="Ask a question, make an argument, or put terms on the table…"
            className="min-h-[90px] resize-y text-[13px]"
            disabled={busy}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={attach}
                disabled={!complete}
                onChange={(e) => setAttach(e.target.checked)}
                className="size-4"
              />
              Attach the terms below as a formal offer
              {!complete && " (settle every issue first)"}
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={walkAway} disabled={busy}>
                <XCircle />
                Walk away
              </Button>
              <Button size="sm" onClick={send} disabled={busy || !draft.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Build an offer
            </p>
            <div className="mt-3 space-y-3">
              {issues.map((issue) => (
                <div key={issue.key}>
                  <p className="text-xs font-medium">{issue.label}</p>
                  <div className="mt-1 space-y-1">
                    {issue.options.map((option) => {
                      const chosen = terms[issue.key] === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() =>
                            setTerms((t) => ({ ...t, [issue.key]: option.key }))
                          }
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                            chosen
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:bg-accent",
                          )}
                        >
                          <span>{option.label}</span>
                          <span className="text-muted-foreground tabular">
                            {payoffs[issue.key]?.[option.key] ?? 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-3">
              <p className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Worth to you</span>
                <span
                  className={cn(
                    "font-semibold tabular",
                    complete && yourValue < batna && "text-destructive",
                  )}
                >
                  {yourValue}
                </span>
              </p>
              <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Walking away is worth</span>
                <span className="tabular">{batna}</span>
              </p>
              {complete && yourValue < batna && (
                <p className="mt-2 text-xs text-destructive">
                  This deal is worse for you than no deal.
                </p>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Handshake className="mt-0.5 size-3 shrink-0" />
                You cannot see what any of this is worth to them. Finding that
                out is the exercise.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
