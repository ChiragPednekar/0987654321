"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Inline group creation with private group join code display. */
export function CreateGroupForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [createdGroup, setCreatedGroup] = React.useState<{
    slug: string;
    join_code?: string | null;
    name: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "") || undefined;
    const is_private = form.get("is_private") === "on";

    setBusy(true);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          is_private,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not create the group.");
        return;
      }

      if (payload.join_code) {
        // Show join code to creator before navigating
        setCreatedGroup({
          slug: payload.slug,
          join_code: payload.join_code,
          name,
        });
      } else {
        toast.success("Public group created.");
        setOpen(false);
        router.push(`/groups/${payload.slug}`);
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!createdGroup?.join_code) return;
    navigator.clipboard.writeText(createdGroup.join_code);
    setCopied(true);
    toast.success("Group code copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  }

  if (createdGroup?.join_code) {
    return (
      <Card className="w-full sm:max-w-md border-primary/40 bg-card shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="size-5" />
            <CardTitle className="text-base">Private Group Created!</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {createdGroup.name} is a private group. Pass this code to other people to join.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/60 px-4 py-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Invite Code
              </span>
              <p className="font-mono text-xl font-bold tracking-widest text-foreground">
                {createdGroup.join_code}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={copyCode} className="gap-1.5">
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy Code"}
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                const slug = createdGroup.slug;
                setCreatedGroup(null);
                setOpen(false);
                router.push(`/groups/${slug}`);
              }}
            >
              Go to group →
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="size-4" />
        New group
      </Button>
    );
  }

  return (
    <Card className="w-full sm:max-w-sm">
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} maxLength={80} placeholder="e.g. MBB Prep Circle" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} maxLength={500} placeholder="What will this group practice?" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="is_private" className="size-4 rounded border-border" />
            <span>Private (requires code to join)</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
