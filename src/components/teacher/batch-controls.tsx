"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Rename or archive a batch.
 *
 * Archiving rather than deleting is the whole point: a batch holds a term's
 * assignments, marks and remarks, and deleting the row would take a student's
 * academic record with it. Archiving closes the join code and drops it out of
 * the working list, leaving everything readable.
 */
export function BatchControls({
  classroomId,
  name,
  archived,
}: {
  classroomId: string;
  name: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(name);
  const [busy, setBusy] = React.useState(false);

  async function patch(changes: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/classrooms", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classroom_id: classroomId, ...changes }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not save.");
        return false;
      }
      toast.success(success);
      router.refresh();
      return true;
    } catch {
      toast.error("Network error.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (trimmed.length < 2) {
            toast.error("Give the batch a name of at least two characters.");
            return;
          }
          if (await patch({ name: trimmed }, "Batch renamed.")) setEditing(false);
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={120}
          aria-label="Batch name"
          className="max-w-64"
          autoFocus
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(name);
            setEditing(false);
          }}
        >
          <X className="size-4" />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" />
        Rename
      </Button>
      <Button
        size="sm"
        variant={archived ? "default" : "outline"}
        disabled={busy}
        onClick={() => {
          // Archiving stops new students joining, so it is worth a beat of
          // friction. Restoring is harmless and asks for none.
          if (
            !archived &&
            !confirm(
              `Archive ${name}?\n\nThe join code stops working and the batch leaves your list. Assignments, marks and remarks are kept, and you can restore it at any time.`,
            )
          ) {
            return;
          }
          void patch(
            { archived: !archived },
            archived ? "Batch restored." : "Batch archived.",
          );
        }}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {archived ? "Restore" : "Archive"}
      </Button>
    </div>
  );
}
