"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

/** Create a team, or join one with a code. */
export function TeamSetup({
  slug,
  minTeamSize,
  maxTeamSize,
}: {
  slug: string;
  minTeamSize: number;
  maxTeamSize: number;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<string | null>(null);

  async function create() {
    setBusy(true);
    try {
      const response = await fetch(`/api/competitions/${slug}/teams`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not create the team.");
        return;
      }
      setCreated(payload.join_code);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    try {
      const response = await fetch(`/api/competitions/${slug}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ join_code: code }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not join.");
        return;
      }
      toast.success(`Joined ${payload.team_name}.`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <Users className="mx-auto size-7 text-muted-foreground" />
          <p className="text-sm">Team created. Share this code with your teammates.</p>
          <div className="flex items-center justify-center gap-2">
            <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-lg tracking-widest">
              {created}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(created);
                toast.success("Copied.");
              }}
            >
              <Copy />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You need {minTeamSize} to {maxTeamSize} members to submit.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-medium">Start a team</p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
            maxLength={60}
          />
          <Button onClick={create} disabled={busy || name.trim().length < 2} className="w-full">
            {busy ? <Loader2 className="animate-spin" /> : <Users />}
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-medium">Join a team</p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Join code"
            className="font-mono tracking-widest"
            maxLength={16}
          />
          <Button
            onClick={join}
            disabled={busy || code.trim().length < 4}
            variant="outline"
            className="w-full"
          >
            {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Join
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
