"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clipboard, ExternalLink, Loader2, MessageSquare, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TeacherGdSessionActions({
  sessionId,
  topicTitle,
  batchName,
}: {
  sessionId: string;
  topicTitle: string;
  batchName?: string;
}) {
  const router = useRouter();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedMsg, setCopiedMsg] = React.useState(false);
  const [ending, setEnding] = React.useState(false);

  const meetingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/gd/${sessionId}`
    : `/gd/${sessionId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopiedLink(true);
      toast.success("Meeting link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  }

  async function copyInviteMessage() {
    const msg = [
      `Group Discussion on CaseCode: ${topicTitle}`,
      batchName ? `Batch: ${batchName}` : null,
      `Join link: ${meetingUrl}`,
      `Open on your phone or laptop (camera & mic ready). No proctoring.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(msg);
      setCopiedMsg(true);
      toast.success("Invite message copied for WhatsApp / Slack!");
      setTimeout(() => setCopiedMsg(false), 2000);
    } catch {
      toast.error("Could not copy invite text.");
    }
  }

  async function endSession() {
    if (!confirm("Are you sure you want to end this discussion meeting for all participants?")) return;
    setEnding(true);
    try {
      const response = await fetch(`/api/gd/sessions/${sessionId}/end`, { method: "POST" });
      if (!response.ok) {
        toast.error("Could not end the discussion.");
        return;
      }
      toast.success("Discussion meeting ended.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={copyLink} className="h-8 text-xs">
          {copiedLink ? <Check className="mr-1 size-3 text-emerald-600" /> : <Clipboard className="mr-1 size-3" />}
          {copiedLink ? "Copied" : "Copy link"}
        </Button>
        <Button variant="outline" size="sm" onClick={copyInviteMessage} className="h-8 text-xs">
          {copiedMsg ? <Check className="mr-1 size-3" /> : <MessageSquare className="mr-1 size-3" />}
          {copiedMsg ? "Copied" : "Invite text"}
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ink" size="sm" asChild className="h-8 text-xs">
          <Link href={`/gd/${sessionId}`}>
            <ExternalLink className="mr-1 size-3" />
            Join room
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={endSession}
          disabled={ending}
          className="h-8 text-xs text-destructive hover:bg-destructive/10"
        >
          {ending ? <Loader2 className="size-3 animate-spin" /> : <PhoneOff className="size-3" />}
        </Button>
      </div>
    </div>
  );
}
