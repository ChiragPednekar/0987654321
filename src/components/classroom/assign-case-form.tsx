"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface CaseHit {
  id: string;
  title: string;
  href: string;
}

/** Teacher-only: search a case and set it for the cohort (spec §11). */
export function AssignCaseForm({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<CaseHit[]>([]);
  const [busy, setBusy] = React.useState(false);

  // Reuse the existing search endpoint rather than shipping 507 case titles
  // down to the browser.
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (!response.ok) return;
        const payload = await response.json();
        setHits((payload.cases ?? []).slice(0, 6));
      } catch {
        // A failed lookup just leaves the previous hits; not worth a toast.
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function assign(caseId: string, dueAt: string, maxMarks: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/assignments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          // Blank means practice only — the assignment carries no marks.
          max_marks: maxMarks ? Number(maxMarks) : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not assign.");
        return;
      }
      toast.success("Assigned.");
      setOpen(false);
      setQuery("");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Assign a case
      </Button>
    );
  }

  return (
    <Card className="w-full sm:max-w-sm">
      <CardContent className="space-y-3 p-4">
        <div>
          <Label htmlFor="case-search">Find a case</Label>
          <Input
            id="case-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="due">Due date</Label>
            <Input id="due" type="date" />
          </div>
          <div>
            <Label htmlFor="max-marks">Out of</Label>
            <Input id="max-marks" type="number" min={1} step="0.5" placeholder="20" />
            <p className="mt-1 text-xs text-muted-foreground">
              Blank = practice
            </p>
          </div>
        </div>

        <ul className="space-y-1">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const due = (document.getElementById("due") as HTMLInputElement)
                    ?.value;
                  const marks = (
                    document.getElementById("max-marks") as HTMLInputElement
                  )?.value;
                  void assign(hit.id, due, marks);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {hit.title}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
