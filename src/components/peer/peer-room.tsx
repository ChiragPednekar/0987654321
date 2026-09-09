"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, ClipboardCheck, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoRoom } from "@/components/peer/video-room";
import { PeerFeedbackForm } from "@/components/peer/peer-feedback-form";
import type { RubricCriteria } from "@/lib/types/database";

/**
 * The room: video on one side, the case on the other.
 *
 * Two panes rather than tabs for the main split, because the whole point is
 * reading the case *while* watching the other person react. The interviewer's
 * private material is a tab within their own pane — near enough to glance at,
 * far enough that it is not on screen while they are meant to be listening.
 */
export function PeerRoom({
  sessionId,
  userId,
  otherUserId,
  status,
  needsJoin,
  role,
  criteria,
  maxScore,
  scenario,
  interviewerNotes,
}: {
  sessionId: string;
  userId: string;
  otherUserId: string | null;
  status: string;
  needsJoin: boolean;
  role: "interviewer" | "candidate";
  criteria: RubricCriteria;
  maxScore: number;
  scenario: React.ReactNode;
  interviewerNotes: React.ReactNode;
}) {
  const router = useRouter();
  const [joined, setJoined] = React.useState(!needsJoin);
  const [busy, setBusy] = React.useState(false);
  const [ended, setEnded] = React.useState(status === "completed");

  async function act(action: "join" | "end") {
    setBusy(true);
    try {
      const response = await fetch(`/api/peer/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "That did not work.");

      if (action === "join") {
        setJoined(true);
        router.refresh();
      } else {
        setEnded(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (!joined) {
    return (
      <Card className="mt-6">
        <CardContent className="p-8 text-center">
          <h2 className="text-base font-medium">
            Join as the {role}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {role === "interviewer"
              ? "You will get the expected structure and the model answer, so you can push on the parts they skip. Your partner sees only the case."
              : "You will get the case and nothing else — your partner has the model answer and will question you on it."}
          </p>
          <Button className="mt-5" disabled={busy} onClick={() => act("join")}>
            {busy ? "Joining…" : "Join the room"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {!ended ? (
          <VideoRoom
            sessionId={sessionId}
            userId={userId}
            onEnd={() => void act("end")}
          />
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium">Interview finished</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave your partner some feedback — it is the half of this they
                cannot get from the AI.
              </p>
            </CardContent>
          </Card>
        )}

        {otherUserId && (
          <PeerFeedbackForm
            sessionId={sessionId}
            toUserId={otherUserId}
            criteria={criteria}
            maxScore={maxScore}
            role={role}
          />
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardContent className="p-0">
          <Tabs defaultValue="case">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
              <TabsTrigger value="case" className="gap-1.5">
                <BookOpen className="size-3.5" />
                The case
              </TabsTrigger>
              {interviewerNotes && (
                <TabsTrigger value="notes" className="gap-1.5">
                  <Eye className="size-3.5" />
                  Your notes
                </TabsTrigger>
              )}
              <TabsTrigger value="rubric" className="gap-1.5">
                <ClipboardCheck className="size-3.5" />
                Rubric
              </TabsTrigger>
            </TabsList>

            <TabsContent value="case" className="max-h-[70vh] overflow-y-auto p-4">
              {scenario}
            </TabsContent>

            {interviewerNotes && (
              <TabsContent value="notes" className="max-h-[70vh] overflow-y-auto p-4">
                {interviewerNotes}
              </TabsContent>
            )}

            <TabsContent value="rubric" className="p-4">
              <p className="text-xs text-muted-foreground">
                Mark them on these, out of {maxScore}.
              </p>
              <ul className="mt-3 space-y-2">
                {Object.entries(criteria).map(([key, weight]) => (
                  <li key={key} className="flex items-baseline justify-between text-sm">
                    <span className="capitalize text-muted-foreground">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="tabular">{weight}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
