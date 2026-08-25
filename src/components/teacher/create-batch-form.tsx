"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

/** Creates a batch via the existing /api/classrooms endpoint. */
export function CreateBatchForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? "") || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not create the batch.");
        return;
      }
      toast.success(`Created. Join code ${body.join_code}`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New batch
      </Button>
    );
  }

  return (
    <Card className="w-full sm:max-w-sm">
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="name">Batch name</Label>
            <Input
              id="name" name="name" required minLength={2} maxLength={120}
              placeholder="MBA 2026 — Section A"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} maxLength={500} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Create
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
