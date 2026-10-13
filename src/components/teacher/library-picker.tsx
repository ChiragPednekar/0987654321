"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ClipboardPlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  clearPicks,
  togglePick,
  useIsPicked,
  usePicks,
  type PickKind,
} from "@/hooks/library-picker-store";

/**
 * Teachers pick from the library and add straight to a batch.
 *
 * `PickToggle` sits on each row of a library list (cases, paths, SQL, Excel,
 * aptitude questions) and only renders for a teacher. `LibraryPickerBar` is
 * mounted once in the app layout for teachers: it appears when anything is
 * picked, on whichever page the teacher is on, and opens the dialog that sends
 * the lot to /api/teacher/assignments/bulk.
 */

export function PickToggle({
  kind,
  id,
  title,
  className,
}: {
  kind: PickKind;
  id: string;
  title: string;
  className?: string;
}) {
  const picked = useIsPicked(kind, id);
  return (
    <button
      type="button"
      onClick={(e) => {
        // Rows are links; ticking must not open the item.
        e.preventDefault();
        e.stopPropagation();
        togglePick({ kind, id, title });
      }}
      aria-pressed={picked}
      aria-label={picked ? `Remove "${title}" from selection` : `Select "${title}" to add to a batch`}
      title={picked ? "Selected — click to remove" : "Select to add to a batch"}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded border transition-colors",
        picked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:border-primary hover:text-foreground",
        className,
      )}
    >
      {picked ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
    </button>
  );
}

const KIND_NOUN: Record<PickKind, [string, string]> = {
  case: ["case", "cases"],
  path: ["path", "paths"],
  sql: ["SQL exercise", "SQL exercises"],
  excel: ["Excel exercise", "Excel exercises"],
  aptitude: ["aptitude question", "aptitude questions"],
};

function summary(counts: Partial<Record<PickKind, number>>) {
  return (Object.keys(KIND_NOUN) as PickKind[])
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${KIND_NOUN[k][counts[k] === 1 ? 0 : 1]}`)
    .join(", ");
}

export function LibraryPickerBar() {
  const picks = usePicks();
  const [open, setOpen] = React.useState(false);
  if (picks.length === 0) return null;

  const counts: Partial<Record<PickKind, number>> = {};
  for (const p of picks) counts[p.kind] = (counts[p.kind] ?? 0) + 1;

  return (
    <>
      <div
        role="region"
        aria-label="Selected for a batch"
        className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(40rem,calc(100%-2rem))] items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg"
      >
        <ClipboardPlus className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{summary(counts)}</span>{" "}
          <span className="text-muted-foreground">selected</span>
        </p>
        <Button size="sm" variant="ghost" onClick={clearPicks}>
          Clear
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add to batch
        </Button>
      </div>
      <AddToBatchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function AddToBatchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const picks = usePicks();
  const [batches, setBatches] = React.useState<{ id: string; name: string }[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const aptitudeCount = picks.filter((p) => p.kind === "aptitude").length;

  // Fetched when the dialog opens: the bar lives on every page, and the batch
  // list is only worth a request once a teacher actually means to use it.
  React.useEffect(() => {
    if (!open || batches) return;
    let cancelled = false;
    fetch("/api/teacher/batches")
      .then((r) => (r.ok ? r.json() : { batches: [] }))
      .then((body: { batches?: { id: string; name: string }[] }) => {
        if (!cancelled) setBatches(body.batches ?? []);
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, batches]);

  async function submit(event: React.FormEvent<HTMLFormElement>, publish: boolean) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const due = String(f.get("due_at") ?? "");
    const marks = String(f.get("max_marks") ?? "").trim();
    const classroomId = String(f.get("classroom_id") ?? "");
    setBusy(true);
    try {
      const response = await fetch("/api/teacher/assignments/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classroom_id: classroomId,
          items: picks.map((p) => ({ kind: p.kind, id: p.id })),
          quiz_title: String(f.get("quiz_title") ?? "").trim() || null,
          instructions: String(f.get("instructions") ?? "").trim() || null,
          due_at: due ? new Date(due).toISOString() : null,
          max_marks: marks ? Number(marks) : null,
          is_published: publish,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        created?: number;
        skipped?: { title: string; reason: string }[];
        error?: string;
      };
      const skipped = body.skipped ?? [];
      if (!response.ok) {
        toast.error(body.error ?? "Could not add to the batch.", {
          description: skipped.map((s) => `${s.title} ${s.reason}`).join("\n") || undefined,
        });
        return;
      }
      const name = batches?.find((b) => b.id === classroomId)?.name ?? "the batch";
      toast.success(
        `${body.created} assignment${body.created === 1 ? "" : "s"} ${publish ? "published to" : "saved as drafts in"} ${name}.`,
        {
          description: skipped.length
            ? `Skipped: ${skipped.map((s) => `${s.title} ${s.reason}`).join("; ")}`
            : undefined,
          duration: skipped.length ? 12_000 : 5_000,
        },
      );
      clearPicks();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Add to a batch</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Each case, path step and exercise becomes its own assignment.
                {aptitudeCount > 0
                  ? ` The ${aptitudeCount} aptitude question${aptitudeCount === 1 ? "" : "s"} become one quiz.`
                  : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close className="text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
            {picks.map((p) => (
              <li key={`${p.kind}:${p.id}`} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{KIND_NOUN[p.kind][0]}</span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <button
                  type="button"
                  onClick={() => togglePick(p)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${p.title}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {batches === null ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading your batches…
            </p>
          ) : batches.length === 0 ? (
            <div className="mt-6 rounded-md border bg-muted/40 p-4 text-sm">
              <p>You don&apos;t teach a batch yet.</p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/teacher/batches" onClick={() => onOpenChange(false)}>
                  Create a batch
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => submit(e, true)} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="picker-batch">Batch</Label>
                <select
                  id="picker-batch"
                  name="classroom_id"
                  required
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {aptitudeCount > 0 && (
                <div>
                  <Label htmlFor="picker-quiz-title">Quiz title</Label>
                  <Input
                    id="picker-quiz-title"
                    name="quiz_title"
                    maxLength={200}
                    placeholder={`Aptitude quiz — ${aptitudeCount} question${aptitudeCount === 1 ? "" : "s"}`}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="picker-instructions">Instructions (optional)</Label>
                <Input
                  id="picker-instructions"
                  name="instructions"
                  maxLength={4000}
                  placeholder="Attempt before Monday's class."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="picker-due">Due (optional)</Label>
                  <Input id="picker-due" name="due_at" type="datetime-local" />
                </div>
                <div>
                  <Label htmlFor="picker-marks">Out of (optional)</Label>
                  <Input id="picker-marks" name="max_marks" type="number" min={1} step="0.5" placeholder="Practice only" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  Publish to students
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={(e) => {
                    const form = (e.currentTarget as HTMLElement).closest("form");
                    if (form) void submit({ preventDefault: () => {}, currentTarget: form } as never, false);
                  }}
                >
                  Save as drafts
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
