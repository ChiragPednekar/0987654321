"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Publishes one of the viewer's own graded solutions to the Top Solutions tab.
 * Only offered once an attempt has been evaluated — sharing an ungraded answer
 * would put an unreviewed submission in front of other students.
 */
export function ShareToggle({
  submissionId,
  initialIsPublic,
}: {
  submissionId: string;
  initialIsPublic: boolean;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = React.useState(initialIsPublic);
  const [saving, setSaving] = React.useState(false);

  async function toggle() {
    const next = !isPublic;
    setSaving(true);
    setIsPublic(next);

    const response = await fetch(`/api/submissions/${submissionId}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_public: next }),
    });

    setSaving(false);

    if (!response.ok) {
      setIsPublic(!next); // roll back
      toast.error("Could not update sharing.");
      return;
    }

    toast.success(
      next
        ? "Shared. Your solution now appears under Top Solutions."
        : "Unshared. Your solution is private again.",
    );
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      aria-pressed={isPublic}
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors disabled:opacity-50",
        isPublic
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
      title={isPublic ? "Visible to other students" : "Only visible to you"}
    >
      {saving ? (
        <Loader2 className="size-3 animate-spin" />
      ) : isPublic ? (
        <Globe className="size-3" />
      ) : (
        <Lock className="size-3" />
      )}
      {isPublic ? "Shared" : "Share"}
    </button>
  );
}
