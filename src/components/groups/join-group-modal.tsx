"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function JoinGroupModal() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) {
      toast.error("Please enter a group join code.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Invalid code or unable to join.");
        return;
      }

      toast.success(`Joined ${payload.name ?? "group"} successfully!`);
      setOpen(false);
      setCode("");
      router.push(`/groups/${payload.slug}`);
      router.refresh();
    } catch {
      toast.error("Network error while connecting to group.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <KeyRound className="size-3.5" />
        Join with code
      </Button>
    );
  }

  return (
    <Card className="w-full sm:max-w-sm border-primary/30 shadow-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <KeyRound className="size-4 text-primary" />
            <span>Join Private Group</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the 4 to 8 character invite code shared by the group owner (e.g. <span className="font-mono font-medium text-foreground">GRP-A1B2</span> or <span className="font-mono font-medium text-foreground">A1B2</span>).
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GRP-XXXX"
            className="font-mono tracking-wider text-center text-base uppercase"
            autoFocus
            required
            maxLength={16}
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
              Join group
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
