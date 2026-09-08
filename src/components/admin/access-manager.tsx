"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { RoleGrantRow } from "@/lib/types/database";

const ROLES = [
  { value: "teacher", label: "Teacher", hint: "Batches, assignments, marking" },
  { value: "admin", label: "Admin", hint: "Everything, including licences" },
  { value: "recruiter", label: "Recruiter", hint: "Opted-in candidate profiles" },
] as const;

export function AccessManager({
  initial,
  registered,
}: {
  initial: RoleGrantRow[];
  registered: string[];
}) {
  const router = useRouter();
  const [grants, setGrants] = React.useState(initial);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<(typeof ROLES)[number]["value"]>("teacher");
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
      const response = await fetch("/api/admin/role-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, note: note || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save that.");

      toast.success(
        signedUp.has(email.trim().toLowerCase())
          ? `${email} is now a ${role}. They'll see it on their next page load.`
          : `${email} will be a ${role} when they sign up.`,
      );
      setEmail("");
      setNote("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(target: string) {
    setBusy(true);
    // Optimistic, reverted below if the server refuses — which it will for the
    // last remaining admin.
    const previous = grants;
    setGrants((g) => g.filter((row) => row.email !== target));
    try {
      const response = await fetch("/api/admin/role-grants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not revoke that.");
      toast.success(`${target} is a student again.`);
      router.refresh();
    } catch (error) {
      setGrants(previous);
      toast.error(error instanceof Error ? error.message : "Could not revoke that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={add} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <label htmlFor="grant-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="grant-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@university.edu"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="grant-role" className="text-sm font-medium">
                Role
              </label>
              <select
                id="grant-role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as (typeof ROLES)[number]["value"])
                }
                className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <label htmlFor="grant-note" className="text-sm font-medium">
                Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="grant-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Which campus, who asked"
              />
            </div>
            <Button type="submit" disabled={busy}>
              <UserPlus className="size-4" />
              Grant access
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            {ROLES.map((r) => `${r.label} — ${r.hint}`).join(" · ")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {grants.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nobody has elevated access. Every account is a student.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {grants.map((grant) => {
                const active = signedUp.has(grant.email.toLowerCase());
                return (
                  <li
                    key={grant.email}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <ShieldCheck
                      className={
                        grant.role === "admin"
                          ? "size-4 text-[var(--warning)]"
                          : "size-4 text-muted-foreground"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{grant.email}</p>
                      {grant.note && (
                        <p className="truncate text-xs text-muted-foreground">
                          {grant.note}
                        </p>
                      )}
                    </div>
                    <Badge variant={grant.role === "admin" ? "default" : "outline"}>
                      {grant.role}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {active ? "signed up" : "awaiting signup"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => revoke(grant.email)}
                      aria-label={`Revoke access for ${grant.email}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
