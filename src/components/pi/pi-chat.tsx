"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { useProctor } from "@/hooks/use-proctor";
import {
  CONVERSATION_RULES,
  ProctorGate,
  ProctorOverlay,
} from "@/components/case/proctor-overlay";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PiTurn {
  role: "interviewer" | "candidate";
  content: string;
}

/**
 * The interview itself.
 *
 * No feedback appears during the conversation, by design — the interviewer is
 * told not to coach, and the UI has nowhere to put a score even if it wanted
 * one. A real panel gives nothing away, and a student who practises against an
 * interviewer that reassures them mid-answer is practising the wrong thing.
 */
export function PiChat({
  sessionId,
  initial,
  questionsAsked,
  maxQuestions,
}: {
  sessionId: string;
  initial: PiTurn[];
  questionsAsked: number;
  maxQuestions: number;
}) {
  const router = useRouter();
  const [turns, setTurns] = React.useState<PiTurn[]>(initial);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const [asked, setAsked] = React.useState(questionsAsked);

  /**
   * The one new surface where AI-written prose is the actual risk rather than
   * a tab switch: an interview answer is exactly the thing a chat window will
   * write for you. Paste is refused, and the cumulative signals for the
   * sitting are sent once when the interview ends, which is the unit that is
   * assessed.
   */
  const proctor = useProctor(true);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function send() {
    const message = draft.trim();
    if (!message || busy) return;

    setDraft("");
    setTurns((t) => [...t, { role: "candidate", content: message }]);
    setBusy(true);

    try {
      const response = await fetch(`/api/pi/sessions/${sessionId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "The interviewer did not respond.");
        // The answer is on the server either way, so it stays on screen.
        return;
      }
      setTurns((t) => [...t, { role: "interviewer", content: payload.message }]);
      setAsked(payload.questions_asked);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      const response = await fetch(`/api/pi/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The interview is the assessed unit, not any single answer, so the
        // cumulative signals for the whole sitting travel with the end call.
        body: JSON.stringify({ signals: proctor.signals }),
      });
      const payload = await response.json();
      if (!response.ok || payload.abandoned) {
        toast.error(payload.error ?? "Could not assess the interview.");
        setFinishing(false);
        return;
      }
      router.push(`/interview/${sessionId}/result`);
      router.refresh();
    } catch {
      toast.error("Network error.");
      setFinishing(false);
    }
  }

  const nearlyDone = asked >= maxQuestions;

  if (!proctor.examMode) {
    return (
      <ProctorGate
        starting={proctor.starting}
        onStart={proctor.start}
        title="This interview is answered under exam conditions"
        rules={CONVERSATION_RULES}
      />
    );
  }

  return (
    <div className="space-y-4">
      {proctor.needsAcknowledgement && (
        <ProctorOverlay
          count={proctor.signals.blurCount}
          onResume={proctor.acknowledge}
        />
      )}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular">
          Question {Math.min(asked, maxQuestions)} of about {maxQuestions}
        </span>
        <Button size="sm" variant="outline" onClick={finish} disabled={finishing || busy}>
          {finishing ? <Loader2 className="animate-spin" /> : <Square />}
          {finishing ? "Assessing…" : nearlyDone ? "Finish and get assessed" : "End early"}
        </Button>
      </div>

      <div className="space-y-3">
        {turns.map((turn, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              turn.role === "candidate" ? "justify-end" : "justify-start",
            )}
          >
            <Card
              className={cn(
                "max-w-[85%]",
                turn.role === "candidate" && "bg-muted/50",
              )}
            >
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {turn.role === "interviewer" ? "Interviewer" : "You"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {turn.content}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <Card className="max-w-[85%]">
              <CardContent className="flex items-center gap-2 p-3.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Thinking…
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
          onPaste={proctor.handlers.onPaste}
          onKeyDown={(e) => {
            proctor.handlers.onKeyDown(e);
            // Enter sends, shift+enter breaks the line — the shape people
            // already expect from a chat box.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Answer as you would out loud…"
          className="min-h-[110px] resize-y text-[13px] leading-relaxed"
          disabled={busy || finishing}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Enter to send. Answer in full sentences, the way you would speak.
          </p>
          <Button onClick={send} disabled={busy || finishing || !draft.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
