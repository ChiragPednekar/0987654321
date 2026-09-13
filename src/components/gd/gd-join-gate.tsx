"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The join step, which exists to do one thing before anyone is in the room:
 * find out whether this browser can transcribe, and tell the server.
 *
 * Asked here rather than discovered later because the answer decides whether
 * the student can be marked at all, and a student deserves to know that before
 * spending ten minutes in a discussion rather than after.
 */
export function GdJoinGate({
  sessionId,
  occupied,
  capacity,
}: {
  sessionId: string;
  occupied: number;
  capacity: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [supported, setSupported] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  async function join() {
    setBusy(true);
    try {
      const response = await fetch(`/api/gd/sessions/${sessionId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcription_ok: supported === true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not join.");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const full = occupied >= capacity;

  return (
    <Card>
      <CardContent className="space-y-4 p-8 text-center">
        <Users className="mx-auto size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {occupied} of {capacity} seats taken.
        </p>

        {supported === false && (
          <p className="mx-auto max-w-md text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              This browser cannot transcribe your speech.
            </span>{" "}
            You can join and take part, but your contribution will not be marked.
            Chrome or Edge on a laptop will work.
          </p>
        )}

        <Button onClick={join} disabled={busy || full}>
          {busy ? <Loader2 className="animate-spin" /> : <Users />}
          {full ? "Room is full" : "Join the discussion"}
        </Button>
      </CardContent>
    </Card>
  );
}
