"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CaseHit { id: string; title: string }

/**
 * Create an assignment (spec §10).
 *
 * The case is chosen by searching rather than from a dropdown: 508 platform
 * cases plus a teacher's own will not fit in a select, and search is what a
 * teacher actually does — they know roughly what they want.
 */
export function AssignmentForm({
  batches,
  ownQuestions,
}: {
  batches: { id: string; name: string }[];
  ownQuestions: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<CaseHit[]>([]);
  const [picked, setPicked] = React.useState<CaseHit | null>(null);

  React.useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (!r.ok) return;
        const body = await r.json();
        setHits((body.cases ?? []).slice(0, 8));
      } catch {
        // A failed lookup leaves the previous hits; not worth a toast.
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function submit(event: React.FormEvent<HTMLFormElement>, publish: boolean) {
    event.preventDefault();
    if (!picked) {
      toast.error("Choose a case or one of your own questions first.");
      return;
    }
    const f = new FormData(event.currentTarget);
    const due = String(f.get("due_at") ?? "");
    const starts = String(f.get("starts_at") ?? "");
    const marks = String(f.get("max_marks") ?? "").trim();
    const attempts = String(f.get("max_attempts") ?? "").trim();

    setBusy(true);
    try {
      const response = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classroom_id: String(f.get("classroom_id") ?? ""),
          case_id: picked.id,
          title: String(f.get("title") ?? "") || picked.title,
          instructions: String(f.get("instructions") ?? "") || null,
          starts_at: starts ? new Date(starts).toISOString() : null,
          due_at: due ? new Date(due).toISOString() : null,
          max_marks: marks ? Number(marks) : null,
          allow_resubmission: f.get("allow_resubmission") === "on",
          max_attempts: attempts ? Number(attempts) : null,
          is_published: publish,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not create the assignment.");
        return;
      }
      toast.success(publish ? "Assignment published." : "Draft saved.");
      router.push(`/teacher/assignments/${body.id}`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => submit(e, true)} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          What and who
        </h2>

        <div>
          <Label htmlFor="classroom_id">Batch</Label>
          <select id="classroom_id" name="classroom_id" required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="case-search">Case</Label>
          {picked ? (
            <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-primary/40 px-3 py-2 text-sm">
              <span>{picked.title}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPicked(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <Input id="case-search" value={query} autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 508 platform cases by title…" />
              {hits.length > 0 ? (
                <ul className="mt-2 space-y-1 rounded-md border border-border p-1">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button type="button" onClick={() => { setPicked(h); setQuery(""); }}
                        className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                        {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {ownQuestions.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Your questions
                  </p>
                  <ul className="mt-1 space-y-1">
                    {ownQuestions.map((q) => (
                      <li key={q.id}>
                        <button type="button" onClick={() => setPicked(q)}
                          className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                          {q.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div>
          <Label htmlFor="title">Assignment title</Label>
          <Input id="title" name="title" maxLength={200}
            placeholder={picked ? picked.title : "Defaults to the case title"} />
        </div>

        <div>
          <Label htmlFor="instructions">Instructions for your students</Label>
          <Textarea id="instructions" name="instructions" rows={3} maxLength={4000}
            placeholder="Focus on the dilution trade-off. Show your working." />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Timing and marks
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="starts_at">Opens</Label>
            <Input id="starts_at" name="starts_at" type="datetime-local" />
            <p className="mt-1 text-xs text-muted-foreground">Blank means now.</p>
          </div>
          <div>
            <Label htmlFor="due_at">Due</Label>
            <Input id="due_at" name="due_at" type="datetime-local" />
            <p className="mt-1 text-xs text-muted-foreground">
              Late work is accepted and flagged.
            </p>
          </div>
          <div>
            <Label htmlFor="max_marks">Out of</Label>
            <Input id="max_marks" name="max_marks" type="number" min={1} step="0.5" placeholder="20" />
            <p className="mt-1 text-xs text-muted-foreground">Blank = practice only.</p>
          </div>
          <div>
            <Label htmlFor="max_attempts">Attempt limit</Label>
            <Input id="max_attempts" name="max_attempts" type="number" min={1} max={20} placeholder="unlimited" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allow_resubmission" defaultChecked className="size-4" />
          Allow resubmission
        </label>
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !picked}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Publish to students
        </Button>
        <Button type="button" variant="outline" disabled={busy || !picked}
          onClick={(e) => {
            const form = (e.currentTarget as HTMLElement).closest("form");
            if (form) submit({ preventDefault: () => {}, currentTarget: form } as never, false);
          }}>
          Save as draft
        </Button>
      </div>
      {!picked ? (
        <p className={cn("text-xs text-muted-foreground")}>
          Choose a case before publishing.
        </p>
      ) : null}
    </form>
  );
}
