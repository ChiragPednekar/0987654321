"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The API deletes a case outright only when nothing references it; once there
 * are submissions it unpublishes instead, because a real delete would cascade
 * away students' answers and scores. The confirmation says which will happen,
 * so the outcome is never a surprise.
 */
export function DeleteCaseButton({
  caseId,
  title,
  submissionCount,
}: {
  caseId: string;
  title: string;
  submissionCount: number;
}) {
  const router = useRouter();
  const [working, setWorking] = React.useState(false);

  const willUnpublish = submissionCount > 0;

  async function onDelete() {
    const message = willUnpublish
      ? `"${title}" has ${submissionCount} submission${
          submissionCount === 1 ? "" : "s"
        }, so it will be unpublished and hidden from the library rather than deleted. Continue?`
      : `Permanently delete "${title}"? This cannot be undone.`;

    if (!window.confirm(message)) return;

    setWorking(true);
    const response = await fetch(`/api/admin/cases/${caseId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.error ?? "Could not delete case.");
      setWorking(false);
      return;
    }

    toast.success(willUnpublish ? "Case unpublished." : "Case deleted.");
    router.push("/admin/cases");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onDelete}
      disabled={working}
      className="text-destructive hover:text-destructive"
    >
      {working ? <Loader2 className="animate-spin" /> : <Trash2 />}
      {willUnpublish ? "Unpublish" : "Delete"}
    </Button>
  );
}
