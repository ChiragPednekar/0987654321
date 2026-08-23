"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import type { ChatResponse } from "@/app/api/chat/route";

interface Turn {
  role: "interviewer" | "candidate";
  content: string;
}

/**
 * Live case interviewer (spec §6).
 *
 * The transcript on screen is a mirror of what the server stored, not the
 * source of truth — every turn round-trips so the interviewer's context is
 * whatever the database says it is.
 */
export function CaseChat({
  caseId,
  signedIn,
  isPro,
}: {
  caseId: string;
  signedIn: boolean;
  /** Pro (or admin). The route enforces this too; this only saves a round trip. */
  isPro: boolean;
}) {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [closed, setClosed] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(message?: string) {
    if (!signedIn) {
      toast.error("Log in to start an interview.");
      return;
    }
    setBusy(true);

    // Show the candidate's turn immediately; waiting for the round trip to
    // echo your own words back reads as lag.
    if (message) setTurns((prev) => [...prev, { role: "candidate", content: message }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          session_id: sessionId ?? undefined,
          message,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "The interviewer did not respond.");
        // Roll the optimistic turn back so the transcript still matches the
        // server's, which is what the next request will be graded against.
        if (message) setTurns((prev) => prev.slice(0, -1));
        return;
      }

      const data = payload as ChatResponse;
      setSessionId(data.session_id);
      setTurns((prev) => [...prev, { role: "interviewer", content: data.reply }]);
      setClosed(data.closed);
    } catch {
      toast.error("Network error.");
      if (message) setTurns((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy || closed) return;
    setDraft("");
    void send(message);
  }

  if (signedIn && !isPro) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6 text-sm">
          <p className="font-medium">Live case interview — Pro</p>
          <p className="text-muted-foreground">
            An interviewer walks you through the case one question at a time,
            pushing on your reasoning the way a real one would, then closes with
            written feedback.
          </p>
          <p className="text-muted-foreground">
            Every case on CaseCode stays free to solve and get graded. Pro adds
            the live interviewer.
          </p>
          <Button asChild>
            <Link href="/pricing">See Pro</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (turns.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6 text-sm">
          <p className="font-medium">Live case interview</p>
          <p className="text-muted-foreground">
            An interviewer will walk you through this case one question at a
            time, pushing on your reasoning the way a real one would. It will
            not tell you whether you are right until the end.
          </p>
          <p className="text-muted-foreground">
            Expect eight to ten exchanges, then three sentences of feedback.
          </p>
          <Button onClick={() => void send()} disabled={busy || !signedIn}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Start interview
          </Button>
          {!signedIn ? (
            <p className="text-xs text-muted-foreground">
              You need to be logged in to start.
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {turns.map((turn, index) => (
          <div
            key={index}
            className={cn(
              "flex gap-3",
              turn.role === "candidate" && "flex-row-reverse",
            )}
          >
            <div
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium",
                turn.role === "interviewer"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {turn.role === "interviewer" ? "I" : <UserRound className="size-4" />}
            </div>
            <div
              className={cn(
                "min-w-0 max-w-[46rem] rounded-lg px-4 py-3 text-sm",
                turn.role === "interviewer"
                  ? "bg-muted/60"
                  : "bg-primary/10",
              )}
            >
              <p className="sr-only">
                {turn.role === "interviewer" ? "Interviewer" : "You"} said:
              </p>
              <Markdown>{turn.content}</Markdown>
            </div>
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2 pl-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            thinking…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {closed ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            This interview is complete. Reload the page to start a fresh one.
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the convention
              // everyone already has muscle memory for.
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder="Your answer…"
            rows={3}
            disabled={busy}
            className="min-h-[72px] flex-1 resize-y"
            aria-label="Your answer"
          />
          <Button type="submit" disabled={busy || !draft.trim()} size="icon">
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      )}
    </div>
  );
}
