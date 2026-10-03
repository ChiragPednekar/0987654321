"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AccessAllowlistRow } from "@/lib/types/database";

/**
 * The invite list.
 *
 * Deliberately a separate panel from the role grants above it: removing an
 * address here does not demote an account, it stops it seeing anything at all,
 * and conflating the two controls would make that easy to do by accident.
 */
export function AllowlistManager({
  initial,
  registered,
}: {
  initial: AccessAllowlistRow[];
  registered: string[];
}) {
  const router = useRouter();
  const [entries, setEntries] = React.useState(initial);
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const signedUp = React.useMemo(
    () => new Set(registered.map((e) => e.toLowerCase())),
    [registered],
  );

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/admin/access-allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note: note || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save that.");

      toast.success(`${email} can now sign in.`);
      setEmail("");
      setNote("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(target: string) {
    setBusy(true);
    const previous = entries;
    setEntries((rows) => rows.filter((row) => row.email !== target));
    try {
      const response = await fetch("/api/admin/access-allowlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove that.");
      toast.success(`${target} can no longer open anything.`);
      router.refresh();
    } catch (error) {
      // Reverted rather than left optimistic: the server refuses to strip
      // access from an admin, and the row must come back if it did.
      setEntries(previous);
      toast.error(error instanceof Error ? error.message : "Could not remove that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <KeyRound className="size-4" aria-hidden />
          Who may sign in at all
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CaseCode is invite-only. An address that is not listed here cannot
          create an account, and an account removed from this list stops seeing
          the questions on its next page load.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={add} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <label htmlFor="allow-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="allow-email"
                type="email"
                required
                placeholder="them@university.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <label htmlFor="allow-note" className="text-sm font-medium">
                Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="allow-note"
                placeholder="Batch of 2027"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Give access
            </Button>
          </form>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nobody is listed, so nobody can sign in.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((row) => (
            <Card key={row.email}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.email}</p>
                  {row.note && (
                    <p className="truncate text-xs text-muted-foreground">
                      {row.note}
                    </p>
                  )}
                </div>
                <Badge variant={signedUp.has(row.email.toLowerCase()) ? "default" : "outline"}>
                  {signedUp.has(row.email.toLowerCase()) ? "signed up" : "invited"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => remove(row.email)}
                  aria-label={`Remove access for ${row.email}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
