"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Join/leave plus the post composer (spec §10). */
export function GroupActions({
  groupId,
  isMember,
  isOwner,
  isPrivate,
}: {
  groupId: string;
  isMember: boolean;
  isOwner: boolean;
  isPrivate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [body, setBody] = React.useState("");

  async function toggleMembership() {
    setBusy(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: isMember ? "DELETE" : "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not update membership.");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/posts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not post.");
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-3 sm:w-auto">
      {isOwner ? (
        <p className="text-xs text-muted-foreground">You own this group.</p>
      ) : isPrivate && !isMember ? (
        <p className="text-xs text-muted-foreground">Invite only.</p>
      ) : (
        <Button size="sm" variant={isMember ? "outline" : "default"} onClick={toggleMembership} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {isMember ? "Leave" : "Join"}
        </Button>
      )}

      {isMember ? (
        <div className="space-y-2 sm:w-80">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share something with the group…"
            rows={3}
            maxLength={5000}
            aria-label="New post"
          />
          <Button size="sm" onClick={post} disabled={busy || !body.trim()}>
            Post
          </Button>
        </div>
      ) : null}
    </div>
  );
}
