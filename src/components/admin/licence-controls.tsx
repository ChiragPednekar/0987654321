"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

/** Suspend/resume a licence and attach placement staff. */
export function LicenceControls({
  institutionId,
  isSuspended,
  name,
}: {
  institutionId: string;
  isSuspended: boolean;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  async function toggleSuspend() {
    // Suspension cuts every student off immediately, so it is worth one beat
    // of friction rather than a bare toggle.
    if (!isSuspended && !confirm(`Suspend ${name}? Every student loses access at once.`)) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/institutions/${institutionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_suspended: !isSuspended }),
      });
      const b = await r.json();
      if (!r.ok) { toast.error(b.error ?? "Could not update."); return; }
      toast.success(isSuspended ? "Licence resumed." : "Licence suspended.");
      router.refresh();
    } catch { toast.error("Network error."); }
    finally { setBusy(false); }
  }

  async function addStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/institutions/${institutionId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: "staff" }),
      });
      const b = await r.json();
      if (!r.ok) { toast.error(b.error ?? "Could not add."); return; }
      toast.success("Staff added.");
      setAdding(false);
      router.refresh();
    } catch { toast.error("Network error."); }
    finally { setBusy(false); }
  }

  if (adding) {
    return (
      <Card className="w-full sm:w-80">
        <CardContent className="p-4">
          <form onSubmit={addStaff} className="space-y-2">
            <Input name="email" type="email" required placeholder="placement@college.ac.in" />
            <p className="text-xs text-muted-foreground">
              They must already have an account.
            </p>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}Add
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
        <UserPlus className="size-4" />
        Add staff
      </Button>
      <Button
        size="sm"
        variant={isSuspended ? "default" : "outline"}
        onClick={toggleSuspend}
        disabled={busy}
      >
        {busy ? <Loader2 className="animate-spin" />
          : isSuspended ? <Play className="size-4" /> : <Pause className="size-4" />}
        {isSuspended ? "Resume" : "Suspend"}
      </Button>
    </div>
  );
}
