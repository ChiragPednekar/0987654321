"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bell, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Notification preferences.
 *
 * This panel used to offer four toggles — assignments, group posts, a daily
 * streak reminder and a weekly performance digest — write all four to
 * localStorage, and answer "Notification preferences updated." to each.
 *
 * None of them reached the server. Worse, three described a product that does
 * not exist: nothing in the codebase creates a notification for a group post,
 * and the streak nudge and weekly digest both need a delivery channel and a
 * scheduled job that were never built. There is no mail provider in the
 * project at all — notifications are in-app only.
 *
 * So one toggle was ignored and three were fiction. What is left is the one
 * the product can honour, wired to the server. The rest are described honestly
 * below rather than offered as switches, because a control that can never take
 * effect teaches people that none of their settings matter.
 */
export function NotificationSettings({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  async function toggle() {
    const next = !enabled;
    // Optimistic, then reverted on failure — the switch should follow the
    // finger, but it must not keep a position the server rejected.
    setEnabled(next);
    setSaving(true);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_assignments: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save that.");
      toast.success(
        next
          ? "You'll be notified about assignments."
          : "Assignment notifications turned off.",
      );
    } catch (error) {
      setEnabled(!next);
      toast.error(
        error instanceof Error ? error.message : "Could not save that.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4 text-primary" />
          Notifications
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          CaseCode notifies you in the app, on the bell in the top bar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <GraduationCap className="size-3.5 text-muted-foreground" />
              Classroom &amp; assignment activity
            </span>
            <p className="text-xs text-muted-foreground">
              When a teacher sets an assignment, marks your work, or asks you to
              have another go.
            </p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={toggle}
            aria-label="Classroom and assignment activity"
            className="size-4 rounded border-border accent-primary cursor-pointer disabled:opacity-50"
          />
        </div>

        <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Notices about your account — being removed from a batch, or an account
          change — are always sent, and are not covered by this setting. CaseCode
          does not send email, so there are no email preferences to set here.
        </p>
      </CardContent>
    </Card>
  );
}
