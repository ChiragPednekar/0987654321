"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

import { PI_KINDS } from "@/lib/pi";
import { cn } from "@/lib/utils";
import type { PiKind } from "@/lib/types/database";

/**
 * Background first, then the round.
 *
 * The background is what makes the interview worth sitting: without it the
 * interviewer can only ask questions any candidate could be asked, which is a
 * quiz rather than practice. It is saved so it is written once, not before
 * every attempt.
 */
export function PiLauncher({
  initialBackground,
  initialRole,
  initialFirms,
}: {
  initialBackground: string;
  initialRole: string;
  initialFirms: string;
}) {
  const router = useRouter();
  const [background, setBackground] = React.useState(initialBackground);
  const [role, setRole] = React.useState(initialRole);
  const [firms, setFirms] = React.useState(initialFirms);
  const [kind, setKind] = React.useState<PiKind>("hr_fit");
  const [firm, setFirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  const selected = PI_KINDS.find((k) => k.value === kind)!;
  const thin = background.trim().length < 80;

  async function saveProfile() {
    setSaving(true);
    try {
      const response = await fetch("/api/pi/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          background,
          target_role: role || null,
          target_firms: firms || null,
        }),
      });
      if (!response.ok) {
        toast.error("Could not save your background.");
        return false;
      }
      return true;
    } catch {
      toast.error("Network error.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function start() {
    // Saved before starting, always. The interview reads the stored profile,
    // so an unsaved edit in the box would be invisible to the interviewer and
    // the student would never know why the questions were generic.
    setStarting(true);
    if (!(await saveProfile())) {
      setStarting(false);
      return;
    }
    try {
      const response = await fetch("/api/pi/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          target_firm: selected.needsFirm ? firm || null : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not start the interview.");
        setStarting(false);
        return;
      }
      router.push(`/interview/${payload.id}`);
    } catch {
      toast.error("Network error.");
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <Label htmlFor="background">Your background</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              A few lines in your own words: education, work, one or two things
              you actually did. The interviewer will dig into whatever you put
              here, so a thin answer gets generic questions.
            </p>
            <Textarea
              id="background"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              rows={7}
              maxLength={6000}
              placeholder={
                "BTech in mechanical, 2 years at an auto components firm as a production planner. Cut changeover time on one line by 18% by resequencing the schedule. Led the placement committee's corporate outreach in first year — 40 companies contacted, 12 new recruiters signed. Now targeting operations consulting."
              }
              className="mt-2 text-[13px] leading-relaxed"
            />
            {thin && background.length > 0 && (
              <p className="mt-1 text-xs text-[var(--warning,#d97706)]">
                Short backgrounds produce generic interviews. Two or three more
                specifics will change the questions you get.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="role">Target role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Operations consulting"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="firms">Firms you are sitting for</Label>
              <Input
                id="firms"
                value={firms}
                onChange={(e) => setFirms(e.target.value)}
                placeholder="Accenture Strategy, TAS, ITC"
                className="mt-1"
              />
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save background
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Choose a round
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PI_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                kind === k.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent",
              )}
            >
              <p className="text-sm font-medium">{k.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.description}</p>
            </button>
          ))}
        </div>
      </div>

      {selected.needsFirm && (
        <div>
          <Label htmlFor="firm">Which firm is this interview for?</Label>
          <Input
            id="firm"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            placeholder="McKinsey & Company"
            className="mt-1 max-w-sm"
          />
        </div>
      )}

      <Button onClick={start} disabled={starting || (selected.needsFirm && !firm.trim())}>
        {starting ? <Loader2 className="animate-spin" /> : <Play />}
        {starting ? "Starting…" : "Start the interview"}
      </Button>
    </div>
  );
}
