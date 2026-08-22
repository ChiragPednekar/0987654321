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

type Mode = "none" | "create" | "join";

/** Create-a-classroom and join-by-code, side by side (spec §11). */
export function ClassroomForms() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("none");
  const [busy, setBusy] = React.useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? "") || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not create the classroom.");
        return;
      }
      toast.success(`Created. Join code ${payload.join_code}`);
      setMode("none");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/classrooms/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ join_code: String(form.get("join_code") ?? "") }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not join.");
        return;
      }
      toast.success("Joined.");
      setMode("none");
      router.push(`/classrooms/${payload.classroom_id}`);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "none") {
    return (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setMode("create")}>
          <Plus className="size-4" />
          New classroom
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("join")}>
          Join with code
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full sm:max-w-sm">
      <CardContent className="p-4">
        {mode === "create" ? (
          <form onSubmit={create} className="space-y-3">
            <div>
              <Label htmlFor="name">Classroom name</Label>
              <Input id="name" name="name" required minLength={2} maxLength={120} />
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
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode("none")}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={join} className="space-y-3">
            <div>
              <Label htmlFor="join_code">Join code</Label>
              <Input
                id="join_code"
                name="join_code"
                required
                maxLength={6}
                placeholder="ABC234"
                className="font-mono uppercase"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Join
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode("none")}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
