"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Optimistic bookmark toggle. The button flips immediately and rolls back if
 * the request fails — waiting on a round trip for a save-for-later control
 * makes the whole library feel sluggish.
 */
export function BookmarkButton({
  caseId,
  initiallySaved,
  signedIn,
  className,
}: {
  caseId: string;
  initiallySaved: boolean;
  signedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(initiallySaved);
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    if (!signedIn) {
      toast.error("Log in to save cases for later.");
      return;
    }

    const next = !saved;
    setSaved(next);
    setPending(true);

    try {
      const response = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });

      if (!response.ok) {
        setSaved(!next);
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.error ?? "Could not update bookmark.");
        return;
      }

      if (!next) {
        // Only removals get an undo: re-saving something is not a loss.
        toast("Removed from bookmarks", {
          action: {
            label: "Undo",
            onClick: async () => {
              setSaved(true);
              await fetch("/api/bookmarks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ case_id: caseId }),
              });
              router.refresh();
            },
          },
        });
      }

      router.refresh();
    } catch {
      setSaved(!next);
      toast.error("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove bookmark" : "Save for later"}
      className={cn(saved && "border-primary/40 text-primary", className)}
    >
      {saved ? <BookmarkCheck /> : <Bookmark />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
