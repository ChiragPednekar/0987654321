"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function QuickJoinButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function join(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not join group.");
        return;
      }
      toast.success(`Joined ${groupName}!`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={join}
      disabled={busy}
      className="h-7 px-2.5 text-xs gap-1"
    >
      {busy ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <UserPlus className="size-3" />
      )}
      Join
    </Button>
  );
}
