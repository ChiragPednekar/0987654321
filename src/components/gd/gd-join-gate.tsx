"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function GdJoinGate({
  sessionId,
  occupied,
  capacity,
  joinPolicy,
  initialStatus,
}: {
  sessionId: string;
  occupied: number;
  capacity: number;
  joinPolicy: "open" | "approval";
  initialStatus: "pending" | "approved" | "rejected" | null;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(initialStatus);
  const [busy, setBusy] = React.useState(false);
  const full = occupied >= capacity;

  React.useEffect(() => {
    if (status !== "pending") return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/gd/sessions/${sessionId}/join`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.admission_status === "approved") {
        setStatus("approved");
        router.refresh();
      } else if (data.admission_status === "rejected") {
        setStatus("rejected");
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [router, sessionId, status]);

  async function join() {
    setBusy(true);
    try {
      const response = await fetch(`/api/gd/sessions/${sessionId}/join`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not join this meeting.");
        return;
      }
      setStatus(data.admission_status);
      if (data.admission_status === "approved") router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        {joinPolicy === "approval" ? (
          <LockKeyhole className="size-6 text-muted-foreground" />
        ) : (
          <Users className="size-6 text-muted-foreground" />
        )}
        <h2 className="text-lg font-semibold">
          {status === "pending" ? "Waiting for the host" : status === "rejected" ? "Request not approved" : "Join this meeting"}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {status === "pending"
            ? "Your request has been sent. This page will join the meeting as soon as the host lets you in."
            : status === "rejected"
              ? "The host did not approve your last request. You can ask again."
              : joinPolicy === "approval"
                ? "This is a private meeting. Ask the host to admit you."
                : `${occupied} of ${capacity} people are in the meeting.`}
        </p>
        {status !== "pending" && (
          <Button onClick={join} disabled={busy || full}>
            {busy ? <Loader2 className="animate-spin" /> : <Users />}
            {full ? "Meeting is full" : joinPolicy === "approval" ? "Request to join" : "Join meeting"}
          </Button>
        )}
        {full && status !== "pending" && (
          <p className="text-xs text-muted-foreground">This meeting has reached its {capacity}-person limit.</p>
        )}
      </CardContent>
    </Card>
  );
}
