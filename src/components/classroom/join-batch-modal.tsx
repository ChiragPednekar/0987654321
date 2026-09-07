"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinBatchModal({
  defaultCode = "",
  batchName = "",
}: {
  defaultCode?: string;
  batchName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState(defaultCode);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) {
      toast.error("Please enter your batch code.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/classrooms/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ join_code: clean }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Invalid batch code.");
        return;
      }

      toast.success("Joined batch successfully!");
      setOpen(false);
      router.push(`/classrooms/${payload.classroom_id}`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-7 text-xs gap-1"
      >
        <KeyRound className="size-3" />
        Join Batch
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {batchName ? `Join ${batchName}` : "Join Batch with Code"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter the 6-character code given by your teacher or professor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. C8BTZ6"
            maxLength={6}
            className="font-mono text-center text-lg uppercase tracking-widest"
            autoFocus
            required
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !code.trim()}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <ArrowRight className="size-3.5 mr-1.5" />
              )}
              Enroll now
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
